import { useState, useRef, useCallback } from "react";

export interface PendingUpdate {
    id: string;
    filePath: string;
    originalContent: string;
    suggestedContent: string;
    status: "pending" | "accepted" | "declined";
    appliedBy?: string;
}

interface UseAgentStreamResult {
    streamingText: string;
    isStreaming: boolean;
    pendingUpdate: PendingUpdate | null;
    sendInstruction: (params: {
        token: string;
        projectId: string;
        filePath: string;
        fileContent: string;
        instruction: string;
    }) => Promise<void>;
    clearPending: () => void;
}

/**
 * Parses the accumulated buffer for a complete <suggested_change> block.
 * Returns the parsed update or null if not yet complete.
 */
function parseSuggestedChange(buffer: string): PendingUpdate | null {
    const startTag = "<suggested_change";
    const endTag = "</suggested_change>";

    const startIdx = buffer.indexOf(startTag);
    const endIdx = buffer.indexOf(endTag);
    if (startIdx === -1 || endIdx === -1) return null;

    const block = buffer.slice(startIdx, endIdx + endTag.length);

    // Extract file attribute
    const fileMatch = block.match(/file="([^"]+)"/);
    const filePath = fileMatch?.[1] ?? "unknown";

    // Extract <original>
    const origMatch = block.match(/<original>([\s\S]*?)<\/original>/);
    const originalContent = origMatch?.[1]?.trim() ?? "";

    // Extract <suggested>
    const suggMatch = block.match(/<suggested>([\s\S]*?)<\/suggested>/);
    const suggestedContent = suggMatch?.[1]?.trim() ?? "";

    return {
        id: crypto.randomUUID(),
        filePath,
        originalContent,
        suggestedContent,
        status: "pending",
    };
}

export function useAgentStream(): UseAgentStreamResult {
    const [streamingText, setStreamingText] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const clearPending = useCallback(() => setPendingUpdate(null), []);

    const sendInstruction = useCallback(async ({
        token,
        projectId,
        filePath,
        fileContent,
        instruction,
    }: {
        token: string;
        projectId: string;
        filePath: string;
        fileContent: string;
        instruction: string;
    }) => {
        // Cancel any in-flight stream
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setStreamingText("");
        setPendingUpdate(null);
        setIsStreaming(true);

        try {
            const res = await fetch("http://localhost:3000/api/agent/suggest", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ projectId, filePath, fileContent, instruction }),
                signal: controller.signal,
            });

            if (!res.ok || !res.body) {
                const err = await res.text();
                setStreamingText(`❌ Agent error: ${err}`);
                setIsStreaming(false);
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = ""; // raw accumulated full text
            let sseBuffer = ""; // partial SSE chunk buffer

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                sseBuffer += decoder.decode(value, { stream: true });

                // Split by SSE line boundaries
                const lines = sseBuffer.split("\n");
                sseBuffer = lines.pop() ?? ""; // keep incomplete line

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const data = line.slice(6).trim();
                    if (data === "[DONE]") break;

                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed?.choices?.[0]?.delta?.content ?? "";
                        if (!delta) continue;

                        buffer += delta;
                        setStreamingText(buffer);

                        // Check if we have a complete suggested_change block
                        if (!pendingUpdate && buffer.includes("</suggested_change>")) {
                            const update = parseSuggestedChange(buffer);
                            if (update) {
                                // Override filePath with the actual active file if not matched
                                if (update.filePath === "unknown" || update.filePath === "FILENAME") {
                                    update.filePath = filePath;
                                }
                                setPendingUpdate(update);
                            }
                        }
                    } catch {
                        // skip malformed chunks
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== "AbortError") {
                setStreamingText((prev) => prev + `\n\n❌ Stream error: ${err.message}`);
            }
        } finally {
            setIsStreaming(false);
        }
    }, [pendingUpdate]);

    return { streamingText, isStreaming, pendingUpdate, sendInstruction, clearPending };
}
