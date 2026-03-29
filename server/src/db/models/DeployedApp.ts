import mongoose, { Schema, Document } from "mongoose";

export interface IDeployedApp extends Document {
    auth0_id: string;
    title: string;
    project_repo: string;
    project_link: string;
    createdAt: Date;
}

const DeployedAppSchema: Schema = new Schema(
    {
        auth0_id: { type: String, required: true, index: true },
        title: { type: String, required: true },
        project_repo: { type: String, required: true },
        project_link: { type: String, required: true },
    },
    { timestamps: true }
);

export const DeployedApp =
    mongoose.models.DeployedApp ||
    mongoose.model<IDeployedApp>("DeployedApp", DeployedAppSchema);
