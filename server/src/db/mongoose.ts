import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/vibecodium";

let isConnected = false;

export const connectMongo = async () => {
    if (isConnected) {
        console.log("=> using existing database connection");
        return;
    }

    try {
        const db = await mongoose.connect(MONGO_URI);
        isConnected = db.connections[0]?.readyState === 1;
        console.log("=> MongoDB connected successfully");
    } catch (error) {
        console.error("=> Error connecting to MongoDB:", error);
        throw error;
    }
};
