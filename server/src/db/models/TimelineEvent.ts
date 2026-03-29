import mongoose, { Schema, Document } from "mongoose";

export interface ITimelineEvent extends Document {
    projectId: string;
    filePath: string;
    eventType: "code_update" | "agent_accepted";
    // userId is ws.data.clientId — Auth0 sub + session suffix, e.g. "auth0|xxx_sessionUUID"
    // If you need the pure Auth0 sub, strip everything after the last underscore.
    userId: string;
    userName: string;
    userColor: string; // hex from COLORS[] in index.ts
    content: string;   // full file content snapshot at this point in time
    cursorPosition?: {
        lineNumber: number;
        column: number;
    };
    isCheckpoint: boolean; // true every 50th event per projectId::filePath (approximate — resets on server restart)
    createdAt: Date;
}

const TimelineEventSchema: Schema = new Schema(
    {
        projectId: { type: String, required: true },
        filePath:  { type: String, required: true },
        eventType: { type: String, enum: ["code_update", "agent_accepted"], required: true },
        userId:    { type: String, required: true },
        userName:  { type: String, required: true },
        userColor: { type: String, required: true },
        content:   { type: String, required: true, default: "" },
        cursorPosition: {
            lineNumber: { type: Number },
            column:     { type: Number },
        },
        isCheckpoint: { type: Boolean, default: false },
        createdAt:    { type: Date, required: true },
    },
    { timestamps: false }
);

// Compound index: powers timeline range queries (project + file, time-ordered)
TimelineEventSchema.index({ projectId: 1, filePath: 1, createdAt: 1 });
// Sparse index for fast checkpoint-only seeks
TimelineEventSchema.index({ isCheckpoint: 1 }, { sparse: true });

export const TimelineEvent =
    mongoose.models.TimelineEvent ||
    mongoose.model<ITimelineEvent>("TimelineEvent", TimelineEventSchema);
