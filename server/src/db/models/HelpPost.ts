import mongoose, { Schema, Document } from "mongoose";

export interface IHelpPost extends Document {
    title: string;
    description: string;
    repoUrl: string;
    userName: string;
    auth0_id: string;
    createdAt: Date;
}

const HelpPostSchema: Schema = new Schema(
    {
        title: { type: String, required: true },
        description: { type: String, required: true },
        repoUrl: { type: String, required: true },
        userName: { type: String, required: true },
        auth0_id: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
    },
    {
        timestamps: true,
    }
);

export const HelpPost = mongoose.models.HelpPost || mongoose.model<IHelpPost>("HelpPost", HelpPostSchema);
