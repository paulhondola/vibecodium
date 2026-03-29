import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/vibecodium";

// Track connection promise to avoid parallel reconnect attempts
let connectionPromise: Promise<void> | null = null;

mongoose.connection.on("disconnected", () => {
    console.log("=> MongoDB disconnected, will reconnect on next request");
    connectionPromise = null;
});

mongoose.connection.on("error", () => {
    connectionPromise = null;
});

export const connectMongo = async () => {
    const state = mongoose.connection.readyState;
    // 1 = connected, 2 = connecting
    if (state === 1) return;
    if (state === 2 && connectionPromise) return connectionPromise;

    connectionPromise = mongoose
        .connect(MONGO_URI, {
            serverSelectionTimeoutMS: 8000,
            connectTimeoutMS: 8000,
        })
        .then(() => {
            console.log("=> MongoDB connected successfully");
        })
        .catch((error) => {
            connectionPromise = null;
            console.error("=> Error connecting to MongoDB:", error.message);
            throw error;
        });

    return connectionPromise;
};
