import mongoose, { Schema, Document } from "mongoose";

export interface IProject extends Document {
    userId: string;
    repoUrl: string;
    projectName: string;
    status: "cloning" | "ready" | "error";
    localPath?: string;
    createdAt: Date;
}

const ProjectSchema: Schema = new Schema(
    {
        userId: { type: String, required: true, index: true },
        repoUrl: { type: String, required: true },
        projectName: { type: String, required: true },
        status: { type: String, enum: ["cloning", "ready", "error"], default: "cloning" },
        localPath: { type: String },
        createdAt: { type: Date, default: Date.now },
    },
    {
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

export const Project = mongoose.models.Project || mongoose.model<IProject>("Project", ProjectSchema);
