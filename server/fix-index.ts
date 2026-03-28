import mongoose from "mongoose";

async function fix() {
    console.log("Connecting to mongo:", process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI as string);
    try {
        await mongoose.connection.collection("projects").dropIndex("ownerName_1_repoUrl_1");
        console.log("Index dropped successfully!");
    } catch (e: any) {
        console.log("Error dropping index:", e.message);
    }
    await mongoose.disconnect();
}

fix();
