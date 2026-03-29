import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
    auth0Id: string;
    name: string;
    email: string;
    picture?: string;
    bio?: string;
    language?: string;
    location?: string;
    createdAt: number;
}

const UserSchema: Schema = new Schema(
    {
        auth0Id: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        email: { type: String, required: true },
        picture: { type: String },
        bio: { type: String },
        language: { type: String },
        location: { type: String },
        createdAt: { type: Number, required: true },
    },
    {
        timestamps: true,
    }
);

export const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
