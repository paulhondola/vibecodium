import { Hono } from "hono";
import { supabase } from "../db/supabase";
import { authMiddleware } from "../middleware/authMiddleware";
import { broadcastToMatch } from "../ws/matchMessaging";

type Variables = { user: { sub: string; [key: string]: any } };
const router = new Hono<{ Variables: Variables }>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchedPair(a: string, b: string): [string, string] {
	return a < b ? [a, b] : [b, a];
}

// ── POST /api/match/swipe ─────────────────────────────────────────────────────
router.post("/swipe", authMiddleware, async (c) => {
	try {
		const currentUser = c.get("user");
		const body = await c.req.json<{
			swipedId: string;
			direction: "left" | "right";
		}>();

		if (!body.swipedId || !["left", "right"].includes(body.direction)) {
			return c.json({ success: false, error: "Invalid request" }, 400);
		}

		// Upsert swipe (handles duplicate swipe gracefully)
		const { error: swipeError } = await supabase
			.from("swipes")
			.upsert(
				{
					swiper_id: currentUser.sub,
					swiped_id: body.swipedId,
					direction: body.direction,
				},
				{ onConflict: "swiper_id,swiped_id" },
			);

		if (swipeError) throw swipeError;

		if (body.direction !== "right") {
			return c.json({ success: true, matched: false });
		}

		// Check if the other person already swiped right on us
		const { data: reciprocal } = await supabase
			.from("swipes")
			.select("id")
			.eq("swiper_id", body.swipedId)
			.eq("swiped_id", currentUser.sub)
			.eq("direction", "right")
			.maybeSingle();

		if (!reciprocal) {
			return c.json({ success: true, matched: false });
		}

		// Mutual right swipe → create match (consistent ordering: smaller UUID first)
		const [userA, userB] = matchedPair(currentUser.sub, body.swipedId);
		const { data: match, error: matchError } = await supabase
			.from("matches")
			.upsert(
				{ user_a_id: userA, user_b_id: userB, is_active: true },
				{ onConflict: "user_a_id,user_b_id" },
			)
			.select("id")
			.single();

		if (matchError) throw matchError;

		return c.json({ success: true, matched: true, matchId: match?.id });
	} catch (error: any) {
		console.error("[match/swipe]", error);
		return c.json({ success: false, error: "Failed to record swipe" }, 500);
	}
});

// ── DELETE /api/match/swipe/last ──────────────────────────────────────────────
router.delete("/swipe/last", authMiddleware, async (c) => {
	try {
		const currentUser = c.get("user");

		const { data: lastSwipe } = await supabase
			.from("swipes")
			.select("id, swiped_id, direction")
			.eq("swiper_id", currentUser.sub)
			.order("created_at", { ascending: false })
			.limit(1)
			.maybeSingle();

		if (!lastSwipe) {
			return c.json({ success: false, error: "No swipe to undo" }, 404);
		}

		await supabase.from("swipes").delete().eq("id", lastSwipe.id);

		// If it was a right swipe, also remove any resulting match row
		if (lastSwipe.direction === "right") {
			const [userA, userB] = matchedPair(currentUser.sub, lastSwipe.swiped_id);
			await supabase
				.from("matches")
				.delete()
				.eq("user_a_id", userA)
				.eq("user_b_id", userB);
		}

		return c.json({ success: true });
	} catch (error: any) {
		console.error("[match/swipe/last DELETE]", error);
		return c.json({ success: false, error: "Failed to undo swipe" }, 500);
	}
});

// ── GET /api/match/matches ────────────────────────────────────────────────────
router.get("/matches", authMiddleware, async (c) => {
	try {
		const currentUser = c.get("user");
		const userId = currentUser.sub;

		const { data: matches, error } = await supabase
			.from("matches")
			.select(
				"id, user_a_id, user_b_id, created_at, is_active, user_a_last_read, user_b_last_read",
			)
			.or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
			.eq("is_active", true)
			.order("created_at", { ascending: false });

		if (error) throw error;

		const enriched = await Promise.all(
			(matches ?? []).map(async (match) => {
				const partnerId =
					match.user_a_id === userId ? match.user_b_id : match.user_a_id;
				const isUserA = match.user_a_id === userId;
				const myLastRead: string | null = isUserA
					? match.user_a_last_read
					: match.user_b_last_read;

				const [partnerResult, lastMsgResult, unreadResult] = await Promise.all([
					supabase
						.from("users")
						.select("id, name, picture")
						.eq("id", partnerId)
						.maybeSingle(),
					supabase
						.from("messages")
						.select("body, sender_id, created_at")
						.eq("match_id", match.id)
						.order("created_at", { ascending: false })
						.limit(1)
						.maybeSingle(),
					myLastRead
						? supabase
								.from("messages")
								.select("id", { count: "exact", head: true })
								.eq("match_id", match.id)
								.neq("sender_id", userId)
								.gt("created_at", myLastRead)
						: supabase
								.from("messages")
								.select("id", { count: "exact", head: true })
								.eq("match_id", match.id)
								.neq("sender_id", userId),
				]);

				return {
					id: match.id,
					partner: partnerResult.data,
					lastMessage: lastMsgResult.data,
					unreadCount: unreadResult.count ?? 0,
					createdAt: match.created_at,
				};
			}),
		);

		return c.json({ success: true, matches: enriched });
	} catch (error: any) {
		console.error("[match/matches GET]", error);
		return c.json({ success: false, error: "Failed to fetch matches" }, 500);
	}
});

// ── GET /api/match/:matchId/messages ─────────────────────────────────────────
router.get("/:matchId/messages", authMiddleware, async (c) => {
	try {
		const currentUser = c.get("user");
		const matchId = c.req.param("matchId");
		const cursor = c.req.query("cursor");
		const limit = Math.min(Number(c.req.query("limit") ?? "50"), 100);

		// Verify membership
		const { data: match } = await supabase
			.from("matches")
			.select("id, user_a_id, user_b_id")
			.eq("id", matchId)
			.or(`user_a_id.eq.${currentUser.sub},user_b_id.eq.${currentUser.sub}`)
			.maybeSingle();

		if (!match)
			return c.json({ success: false, error: "Match not found" }, 404);

		let query = supabase
			.from("messages")
			.select("id, sender_id, body, created_at")
			.eq("match_id", matchId)
			.order("created_at", { ascending: false })
			.limit(limit + 1);

		if (cursor) {
			query = query.lt("created_at", cursor);
		}

		const { data: messages, error } = await query;
		if (error) throw error;

		const hasMore = (messages?.length ?? 0) > limit;
		const items = (messages ?? []).slice(0, limit).reverse();

		// Mark as read
		const isUserA = match.user_a_id === currentUser.sub;
		const readField = isUserA ? "user_a_last_read" : "user_b_last_read";
		await supabase
			.from("matches")
			.update({ [readField]: new Date().toISOString() })
			.eq("id", matchId);

		return c.json({
			success: true,
			messages: items,
			meta: {
				hasMore,
				nextCursor: hasMore && items[0] ? items[0].created_at : null,
			},
		});
	} catch (error: any) {
		console.error("[match/:matchId/messages GET]", error);
		return c.json({ success: false, error: "Failed to fetch messages" }, 500);
	}
});

// ── POST /api/match/:matchId/messages ────────────────────────────────────────
router.post("/:matchId/messages", authMiddleware, async (c) => {
	try {
		const currentUser = c.get("user");
		const matchId = c.req.param("matchId");
		const { body } = await c.req.json<{ body: string }>();

		if (!body?.trim()) {
			return c.json({ success: false, error: "Message body is required" }, 400);
		}

		// Verify membership + active
		const { data: match } = await supabase
			.from("matches")
			.select("id, user_a_id, user_b_id, is_active")
			.eq("id", matchId)
			.or(`user_a_id.eq.${currentUser.sub},user_b_id.eq.${currentUser.sub}`)
			.maybeSingle();

		if (!match || !match.is_active) {
			return c.json(
				{ success: false, error: "Match not found or inactive" },
				404,
			);
		}

		const { data: message, error } = await supabase
			.from("messages")
			.insert({
				match_id: matchId,
				sender_id: currentUser.sub,
				body: body.trim(),
			})
			.select()
			.single();

		if (error) throw error;

		// Update sender's last_read so they don't see their own message as unread
		const isUserA = match.user_a_id === currentUser.sub;
		const readField = isUserA ? "user_a_last_read" : "user_b_last_read";
		await supabase
			.from("matches")
			.update({ [readField]: new Date().toISOString() })
			.eq("id", matchId);

		// Fan-out to WebSocket subscribers
		broadcastToMatch(matchId, { type: "new_message", message });

		return c.json({ success: true, message }, 201);
	} catch (error: any) {
		console.error("[match/:matchId/messages POST]", error);
		return c.json({ success: false, error: "Failed to send message" }, 500);
	}
});

// ── DELETE /api/match/:matchId ────────────────────────────────────────────────
router.delete("/:matchId", authMiddleware, async (c) => {
	try {
		const currentUser = c.get("user");
		const matchId = c.req.param("matchId");

		const { data: match } = await supabase
			.from("matches")
			.select("id")
			.eq("id", matchId)
			.or(`user_a_id.eq.${currentUser.sub},user_b_id.eq.${currentUser.sub}`)
			.maybeSingle();

		if (!match)
			return c.json({ success: false, error: "Match not found" }, 404);

		// Soft delete — keeps swipe record so profile won't reappear in feed
		await supabase
			.from("matches")
			.update({ is_active: false })
			.eq("id", matchId);

		return c.json({ success: true });
	} catch (error: any) {
		console.error("[match/:matchId DELETE]", error);
		return c.json({ success: false, error: "Failed to unmatch" }, 500);
	}
});

export default router;
