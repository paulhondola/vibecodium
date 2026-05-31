import { supabase } from "../db/supabase";

/**
 * Per project+file event counter for checkpoint marking.
 * NOTE: resets on server restart — checkpoints are cosmetic anchors, not exact.
 */
export const timelineEventCounters = new Map<string, number>(); // key: `${projectId}::${filePath}`

/** Only persist every Nth code_update to avoid flooding Supabase. */
export const TIMELINE_SAVE_INTERVAL = 7;

/**
 * Fire-and-forget Supabase timeline logger.
 * Saves every Nth code_update to avoid flooding. agent_accepted events always saved.
 */
export function logTimelineEvent(
	projectId: string,
	filePath: string,
	content: string,
	eventType: "code_update" | "agent_accepted",
	userId: string,
	userName: string,
	userColor: string,
): void {
	if (content.length > 500_000) return;
	(async () => {
		try {
			const key = `${projectId}::${filePath}`;
			const count = (timelineEventCounters.get(key) ?? 0) + 1;
			timelineEventCounters.set(key, count);

			if (eventType === "code_update" && count % TIMELINE_SAVE_INTERVAL !== 0) return;

			await supabase.from("timeline_events").insert({
				project_id: projectId,
				file_path: filePath,
				event_type: eventType,
				user_id: userId,
				user_name: userName,
				user_color: userColor,
				content,
				is_checkpoint: count % 50 === 0,
				created_at: new Date().toISOString(),
			});
		} catch (e) {
			console.error("[Timeline log error]:", e);
		}
	})();
}
