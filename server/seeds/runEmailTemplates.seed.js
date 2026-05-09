// server/seeds/runEmailTemplates.seed.js
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/db.js";
import { seedDefaultEmailTemplates } from "./emailTemplates.seed.js";

async function run() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("Missing MONGO_URI or MONGODB_URI in server/.env");
  }

  await connectDB(mongoUri);

  const result = await seedDefaultEmailTemplates({ overwrite: true });
  console.log("✅ Email templates seeded:", result);

  await mongoose.connection.close();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("❌ Seed failed:", err);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
