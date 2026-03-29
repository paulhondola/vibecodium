import mongoose, { Schema, Document } from "mongoose";

export interface IUserToken extends Document {
    auth0Id: string;
    githubToken?: string;
    vercelToken?: string;
}

const UserTokenSchema: Schema = new Schema(
    {
        auth0Id: { type: String, required: true, unique: true },
        githubToken: { type: String },
        vercelToken: { type: String },
    },
    {
        timestamps: true,
    }
);

export const UserToken = mongoose.models.UserToken || mongoose.model<IUserToken>("UserToken", UserTokenSchema);
