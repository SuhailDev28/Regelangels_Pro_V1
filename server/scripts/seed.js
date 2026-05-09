import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

import User from "../src/models/User.js";
import Academy from "../src/models/Academy.js";

dotenv.config();

const MONGO =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL ||
  "";

async function run() {
  try {
    if (!MONGO) {
      throw new Error(
        "Mongo connection string missing. Add MONGO_URI (or MONGODB_URI / DATABASE_URL) to server/.env",
      );
    }

    await mongoose.connect(MONGO);
    console.log("Mongo connected");

    await User.deleteMany({});
    await Academy.deleteMany({});
    console.log("Old data cleared");

    const rebel = await Academy.create({
      name: "Rebel Angels",
      code: "RAGA",
      slug: "rebel-angels",
      logoUrl: "",
      primaryColor: "#e11d2e",
      secondaryColor: "#111827",
      contactEmail: "admin@rebelangels.local",
      phone: "",
      address: "",
      status: "ACTIVE",
    });

    const future = await Academy.create({
      name: "Future Stars Academy",
      code: "FSA",
      slug: "future-stars-academy",
      logoUrl: "",
      primaryColor: "#2563eb",
      secondaryColor: "#111827",
      contactEmail: "admin@futurestars.local",
      phone: "",
      address: "",
      status: "ACTIVE",
    });

    console.log("Academies created");

    const adminHash = await bcrypt.hash("Admin@12345", 10);
    const judgeHash = await bcrypt.hash("Judge@12345", 10);
    const childHash = await bcrypt.hash("Child@12345", 10);

    await User.insertMany([
      {
        name: "Super Admin",
        email: "superadmin@demo.com",
        passwordHash: adminHash,
        role: "SUPER_ADMIN",
        academyId: null,
        isActive: true,
      },
      {
        name: "Rebel Angels Admin",
        email: "admin@rebelangels.local",
        passwordHash: adminHash,
        role: "ADMIN",
        academyId: rebel._id,
        isActive: true,
      },
      {
        name: "Rebel Angels Judge",
        email: "judge@rebelangels.local",
        passwordHash: judgeHash,
        role: "JUDGE",
        academyId: rebel._id,
        isActive: true,
      },
      {
        name: "Future Stars Admin",
        email: "admin@futurestars.local",
        passwordHash: adminHash,
        role: "ADMIN",
        academyId: future._id,
        isActive: true,
      },
      {
        name: "Demo Participant",
        email: "child1@demo.com",
        passwordHash: childHash,
        role: "PARTICIPANT",
        academyId: rebel._id,
        isActive: true,
      },
    ]);

    console.log("Users created");
    console.log("");
    console.log("==================================");
    console.log("SYSTEM SEEDED SUCCESSFULLY");
    console.log("==================================");
    console.log("Super Admin: superadmin@demo.com / Admin@12345");
    console.log("Rebel Angels Admin: admin@rebelangels.local / Admin@12345");
    console.log("Rebel Angels Judge: judge@rebelangels.local / Judge@12345");
    console.log("Future Stars Admin: admin@futurestars.local / Admin@12345");
    console.log("Participant: child1@demo.com / Child@12345");

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
