import { db } from "../db";
import { user_tokens } from "../db/schema";
import { eq } from "drizzle-orm";

export async function getUserTokens(auth0Id: string) {
    const [token] = await db.select().from(user_tokens).where(eq(user_tokens.auth0Id, auth0Id));
    if (!token) {
        return { githubToken: null, vercelToken: null };
    }
    return {
        githubToken: token.githubToken,
        vercelToken: token.vercelToken,
    };
}
