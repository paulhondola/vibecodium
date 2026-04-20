/**
 * authMiddleware — Supabase JWT verification.
 *
 * Replaces the previous Auth0 /userinfo approach.
 * Uses `jose` (already a dependency) to verify the Supabase access token
 * locally with the SUPABASE_JWT_SECRET — zero HTTP round-trips, much faster.
 *
 * Normalised user shape set on context (c.set("user", ...)):
 *   sub       — Supabase user UUID (was Auth0 sub)          ← unchanged across all routes
 *   email     — primary email                               ← unchanged
 *   nickname  — GitHub username (user_metadata.user_name)   ← compat shim for existing routes
 *   name      — full name (user_metadata.full_name)         ← unchanged field name
 *   picture   — avatar URL (user_metadata.avatar_url)       ← unchanged field name
 *   user_metadata — full raw Supabase user_metadata object
 */

import { createMiddleware } from "hono/factory";
import { jwtVerify } from "jose";
import { upsertUser } from "../utils/tokens";

const FUN_BIOS = [
  "I use Arch btw.",
  "Looking for a partner to rewrite my Node backend in Rust.",
  "React developer. Swipe left if no functional components.",
  "I like long walks on the beach and abstractSingletonProxyFactoryBeans.",
  "Python enthusiast. My code is indent-pendent.",
  "If you don't write tests, we already share a philosophy.",
];
const LANGUAGES = ["Rust", "TypeScript", "Java", "Python", "Go", "C++", "JavaScript", "HTML (yes, it's a language)"];
const LOCATIONS = ["2 miles away", "5 miles away", "Right behind you", "In your node_modules", "Localhost", "Cloud9"];

// ──────────────────────────────────────────────────────────────────────────────
// In-memory token cache (avoids re-verifying the same JWT on every request)
// ──────────────────────────────────────────────────────────────────────────────
interface CachedUser {
  user: Record<string, any>;
  expiresAt: number; // epoch ms
}

if (!(globalThis as any).__supabaseTokenCache) {
  (globalThis as any).__supabaseTokenCache = new Map<string, CachedUser>();
}
const tokenCache = (globalThis as any).__supabaseTokenCache as Map<string, CachedUser>;

// ──────────────────────────────────────────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────────────────────────────────────────

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  if (!token) {
    return c.json({ error: "Malformed authorization header" }, 401);
  }

  try {
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("SUPABASE_JWT_SECRET is not set in server/.env");
    }

    // ── 1. Check in-memory cache ──────────────────────────────────────────────
    const now = Date.now();
    const cached = tokenCache.get(token);
    if (cached && cached.expiresAt > now) {
      c.set("user", cached.user);
      return await next();
    }

    // ── 2. Verify JWT with jose ───────────────────────────────────────────────
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret, {
      // Supabase issues HS256 JWTs signed with the JWT secret
      algorithms: ["HS256"],
    });

    // ── 3. Normalise payload — keep compat shim for existing routes ───────────
    const meta = (payload.user_metadata ?? {}) as Record<string, any>;
    const userPayload: Record<string, any> = {
      // Standard OIDC / existing route fields
      sub: payload.sub,
      email: payload.email ?? meta.email ?? "",
      // Compat shims — existing routes use user.nickname / user.name / user.picture
      nickname: meta.user_name ?? meta.preferred_username ?? (payload.email as string | undefined)?.split("@")[0] ?? "",
      name: meta.full_name ?? meta.name ?? "",
      picture: meta.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(meta.full_name ?? payload.email ?? "U")}&background=0D8ABC&color=fff`,
      // Raw metadata for anything that needs it
      user_metadata: meta,
      // Pass through everything else in the JWT payload
      ...payload,
    };

    // ── 4. Cache for 15 minutes (well within Supabase's 1-hour token TTL) ─────
    const expMs = typeof payload.exp === "number"
      ? payload.exp * 1000          // use token's own expiry if available
      : now + 15 * 60 * 1000;
    tokenCache.set(token, { user: userPayload, expiresAt: Math.min(expMs, now + 15 * 60 * 1000) });

    // ── 5. Upsert user in Supabase (fire-and-forget, non-blocking) ─────────────
    upsertUser(userPayload as Parameters<typeof upsertUser>[0]).catch((e) => console.error("[auth] upsertUser failed:", e));

    c.set("user", userPayload);
    await next();
  } catch (error: any) {
    // JWT verification errors (expired, invalid signature, etc.)
    console.error("[auth] Token verification failed:", error.message);
    return c.json({ error: "Unauthorized", details: error.message }, 401);
  }
});
