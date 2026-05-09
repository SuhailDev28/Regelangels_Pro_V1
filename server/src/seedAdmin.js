import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "./db.js";

import User from "./models/User.js";
import Academy from "./models/Academy.js";

const DEMO_USERS = [
  {
    name: "Super Admin",
    email: "superadmin@demo.com",
    password: "Admin@12345",
    role: "SUPER_ADMIN",
    academyCode: null,
    isActive: true,
  },
  {
    name: "Rebel Angels Admin",
    email: "admin@rebelangels.local",
    password: "Admin@12345",
    role: "ADMIN",
    academyCode: "REBEL",
    isActive: true,
  },
  {
    name: "Rebel Angels Judge",
    email: "judge@rebelangels.local",
    password: "Judge@12345",
    role: "JUDGE",
    academyCode: "REBEL",
    isActive: true,
  },
  {
    name: "Demo Participant",
    email: "child1@demo.com",
    password: "Child@12345",
    role: "PARTICIPANT",
    academyCode: "REBEL",
    isActive: true,
  },
  {
    name: "Demo Parent",
    email: "parent@test.com",
    password: "Parent@12345",
    role: "PARENT",
    academyCode: "REBEL",
    isActive: true,
  },
  {
    name: "Future Stars Admin",
    email: "admin@futurestars.local",
    password: "Admin@12345",
    role: "ADMIN",
    academyCode: "FUTURE",
    isActive: true,
  },
];

const DEMO_ACADEMIES = [
  {
    name: "Rebel Angels",
    slug: "rebel-angels",
    code: "REBEL",
    academyCode: "REBEL",
    email: "info@rebelangels.local",
    phone: "+97400000001",
    address: "Doha, Qatar",
    status: "ACTIVE",
    primaryColor: "#e11d2e",
    secondaryColor: "#0f172a",
  },
  {
    name: "Future Stars",
    slug: "future-stars",
    code: "FUTURE",
    academyCode: "FUTURE",
    email: "info@futurestars.local",
    phone: "+97400000002",
    address: "Doha, Qatar",
    status: "ACTIVE",
    primaryColor: "#2563eb",
    secondaryColor: "#0f172a",
  },
];

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function upsertAcademy(academyData) {
  const slug = academyData.slug || slugify(academyData.name);

  let academy = await Academy.findOne({
    $or: [
      { slug },
      { academyCode: academyData.academyCode },
      { code: academyData.code },
      { name: academyData.name },
    ],
  });

  if (academy) {
    academy.name = academyData.name;
    academy.slug = slug;
    academy.academyCode = academyData.academyCode || academy.academyCode;
    academy.code = academyData.code || academy.code;
    academy.email = academyData.email || academy.email;
    academy.phone = academyData.phone || academy.phone;
    academy.address = academyData.address || academy.address;
    academy.status = academyData.status || academy.status;
    academy.primaryColor = academyData.primaryColor || academy.primaryColor;
    academy.secondaryColor =
      academyData.secondaryColor || academy.secondaryColor;
    await academy.save();
    console.log(`↺ Updated academy: ${academy.name}`);
    return academy;
  }

  academy = await Academy.create({
    ...academyData,
    slug,
  });

  console.log(`✅ Created academy: ${academy.name}`);
  return academy;
}

async function upsertUser(userData, academyMap) {
  const email = normalizeEmail(userData.email);
  const existing = await User.findOne({ email });
  const passwordHash = await bcrypt.hash(String(userData.password), 10);

  let academyId = null;
  if (userData.role !== "SUPER_ADMIN") {
    const academy = academyMap.get(userData.academyCode);
    if (!academy?._id) {
      throw new Error(
        `Academy not found for user ${email} with academyCode ${userData.academyCode}`,
      );
    }
    academyId = academy._id;
  }

  const payload = {
    name: userData.name,
    email,
    passwordHash,
    role: userData.role,
    academyId,
    isActive: userData.isActive ?? true,
  };

  if (existing) {
    existing.name = payload.name;
    existing.email = payload.email;
    existing.passwordHash = payload.passwordHash;
    existing.role = payload.role;
    existing.academyId = payload.academyId;
    existing.isActive = payload.isActive;
    await existing.save();
    console.log(`↺ Updated user: ${email}`);
    return existing;
  }

  const created = await User.create(payload);
  console.log(`✅ Created user: ${email}`);
  return created;
}

async function main() {
  try {
    await connectDB(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected");

    const academyMap = new Map();

    for (const academyData of DEMO_ACADEMIES) {
      const academy = await upsertAcademy(academyData);
      academyMap.set(academyData.academyCode, academy);
    }

    for (const userData of DEMO_USERS) {
      await upsertUser(userData, academyMap);
    }

    console.log("🎉 Seed completed successfully");

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    try {
      await mongoose.connection.close();
    } catch {}
    process.exit(1);
  }
}

main();
