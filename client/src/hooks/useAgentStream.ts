import { useState, useRef, useCallback } from "react";
import { API_BASE } from "@/lib/config";

export interface PendingUpdate {
    id: string;
    filePath: string;
    originalContent: string;
    suggestedContent: string;
    status: "pending" | "accepted" | "declined";
    appliedBy?: string;
}

export interface AgentFileAction {
    id: string;
    type: "create_file" | "delete_file" | "rename_file";
    filePath: string;
    content?: string;  // for create_file
    newPath?: string;  // for rename_file
}

interface UseAgentStreamResult {
    streamingText: string;
    isStreaming: boolean;
    pendingUpdate: PendingUpdate | null;
    fileActions: AgentFileAction[];
    sendInstruction: (params: {
        token: string;
        projectId: string;
        filePath: string;
        fileContent: string;
        instruction: string;
    }) => Promise<void>;
    clearPending: () => void;
    clearFileActions: () => void;
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

    const fileMatch = block.match(/file="([^"]+)"/);
    const filePath = fileMatch?.[1] ?? "unknown";

    const origMatch = block.match(/<original>([\s\S]*?)<\/original>/);
    const originalContent = origMatch?.[1]?.trim() ?? "";

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

/**
 * Parses file management actions from the buffer.
 * Returns only newly seen actions (using seenKeys to deduplicate).
 */
function parseNewFileActions(buffer: string, seenKeys: Set<string>): AgentFileAction[] {
    const actions: AgentFileAction[] = [];

    // <create_file file="PATH">content</create_file>
    const createRe = /<create_file\s+file="([^"]+)">([\s\S]*?)<\/create_file>/g;
    let m: RegExpExecArray | null;
    while ((m = createRe.exec(buffer)) !== null) {
        const key = `create:${m[1]}`;
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            actions.push({ id: crypto.randomUUID(), type: "create_file", filePath: m[1], content: m[2].trim() });
        }
    }

    // <delete_file file="PATH" />
    const deleteRe = /<delete_file\s+file="([^"]+)"\s*\/>/g;
    while ((m = deleteRe.exec(buffer)) !== null) {
        const key = `delete:${m[1]}`;
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            actions.push({ id: crypto.randomUUID(), type: "delete_file", filePath: m[1] });
        }
    }

    // <rename_file from="OLD" to="NEW" />
    const renameRe = /<rename_file\s+from="([^"]+)"\s+to="([^"]+)"\s*\/>/g;
    while ((m = renameRe.exec(buffer)) !== null) {
        const key = `rename:${m[1]}:${m[2]}`;
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            actions.push({ id: crypto.randomUUID(), type: "rename_file", filePath: m[1], newPath: m[2] });
        }
    }

    return actions;
}

export function useAgentStream(): UseAgentStreamResult {
    const [streamingText, setStreamingText] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);
    const [fileActions, setFileActions] = useState<AgentFileAction[]>([]);
    const abortRef = useRef<AbortController | null>(null);
    const seenActionKeysRef = useRef<Set<string>>(new Set());

    const clearPending = useCallback(() => setPendingUpdate(null), []);
    const clearFileActions = useCallback(() => {
        setFileActions([]);
        seenActionKeysRef.current.clear();
    }, []);

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
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setStreamingText("");
        setPendingUpdate(null);
        setFileActions([]);
        seenActionKeysRef.current.clear();
        setIsStreaming(true);

        try {
            const res = await fetch(`${API_BASE}/api/agent/suggest`, {
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
            let buffer = "";
            let sseBuffer = "";
            let pendingSet = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                sseBuffer += decoder.decode(value, { stream: true });

                const lines = sseBuffer.split("\n");
                sseBuffer = lines.pop() ?? "";

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

                        // Detect suggested_change (only first one)
                        if (!pendingSet && buffer.includes("</suggested_change>")) {
                            const update = parseSuggestedChange(buffer);
                            if (update) {
                                if (update.filePath === "unknown" || update.filePath === "FILENAME") {
                                    update.filePath = filePath;
                                }
                                setPendingUpdate(update);
                                pendingSet = true;
                            }
                        }

                        // Detect file management actions as they complete
                        const newActions = parseNewFileActions(buffer, seenActionKeysRef.current);
                        if (newActions.length > 0) {
                            setFileActions(prev => [...prev, ...newActions]);
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
    }, []);

    return { streamingText, isStreaming, pendingUpdate, fileActions, sendInstruction, clearPending, clearFileActions };
}
