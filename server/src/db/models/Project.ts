import mongoose, { Schema, Document } from "mongoose";

export interface IProject extends Document {
    userId: string;
    repoUrl: string;
    name: string;
    createdAt: Date;
    // `_id` and virtual `id` are provided by Mongoose automatically
}

const ProjectSchema: Schema = new Schema(
    {
        userId: { type: String, required: true, index: true },
        repoUrl: { type: String, required: true },
        name: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
    },
    {
        // Enforce the inclusion of the virtual properties natively when converting to JSON
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

export const Project = mongoose.models.Project || mongoose.model<IProject>("Project", ProjectSchema);
