import { connectMongo } from "../db/mongoose";
import { UserToken } from "../db/models/UserToken";

export async function getUserTokens(auth0Id: string) {
    await connectMongo();
    const tokens = await UserToken.findOne({ auth0Id });
    if (!tokens) {
        return { githubToken: null, vercelToken: null };
    }
    return {
        githubToken: tokens.githubToken,
        vercelToken: tokens.vercelToken,
    };
}

