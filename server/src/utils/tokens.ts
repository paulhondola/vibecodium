import { db } from "../db";
import { user_tokens } from "../db/schema";
import { eq } from "drizzle-orm";

export async function getUserTokens(auth0Id: string) {
    const tokens = await db.select().from(user_tokens).where(eq(user_tokens.auth0Id, auth0Id));
    if (tokens.length === 0) {
        return { githubToken: null, vercelToken: null };
    }
    return {
        githubToken: tokens[0].githubToken,
        vercelToken: tokens[0].vercelToken,
    };
}
