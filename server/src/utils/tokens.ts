import { supabase } from "../db/supabase";

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

/**
 * Upserts a user into public.users (fire-and-forget safe to call from middleware).
 */
export async function upsertUser(payload: {
  sub: string;
  email?: string;
  name?: string;
  nickname?: string;
  picture?: string;
}): Promise<void> {
  const { error } = await supabase.from("users").upsert(
    {
      id: payload.sub,
      name: payload.name || payload.nickname || "Anonymous Coder",
      email: payload.email || "no-email@vibecodium.com",
      picture:
        payload.picture ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          payload.name || payload.email || "U"
        )}&background=0D8ABC&color=fff`,
      bio: FUN_BIOS[Math.floor(Math.random() * FUN_BIOS.length)],
      language: LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)],
      location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
      created_at: Date.now(),
    },
    { onConflict: "id", ignoreDuplicates: false }
  );
  if (error) console.error("[upsertUser]", error.message);
}

/**
 * Returns the stored GitHub / Vercel tokens for a user.
 */
export async function getUserTokens(
  userId: string
): Promise<{ githubToken: string | null; vercelToken: string | null }> {
  const { data, error } = await supabase
    .from("user_tokens")
    .select("github_token, vercel_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) console.error("[getUserTokens]", error.message);

  return {
    githubToken: data?.github_token ?? null,
    vercelToken: data?.vercel_token ?? null,
  };
}
