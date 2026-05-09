import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("❌ Missing MONGO_URI or MONGODB_URI");
  process.exit(1);
}

const PLAN = {
  users: {
    drop: ["email_1"],
    create: [
      {
        keys: { academyId: 1, email: 1 },
        options: {
          unique: true,
          partialFilterExpression: { email: { $type: "string" } },
          name: "academyId_1_email_1",
        },
      },
    ],
  },

  participants: {
    drop: ["userId_1", "academyId_1_bibNo_1", "academyId_1_userId_1"],
    create: [
      {
        keys: { academyId: 1, userId: 1 },
        options: { unique: true, name: "academyId_1_userId_1" },
      },
      {
        keys: { academyId: 1, bibNo: 1 },
        options: {
          unique: true,
          partialFilterExpression: { bibNo: { $type: "string", $ne: "" } },
          name: "academyId_1_bibNo_1",
        },
      },
    ],
  },

  groups: {
    drop: ["academyId_1_name_1_level_1"],
    create: [
      {
        keys: { academyId: 1, name: 1, level: 1 },
        options: { unique: true, name: "academyId_1_name_1_level_1" },
      },
    ],
  },

  activities: {
    drop: ["academyId_1_name_1"],
    create: [
      {
        keys: { academyId: 1, name: 1 },
        options: { unique: true, name: "academyId_1_name_1" },
      },
    ],
  },

  events: {
    drop: ["code_1", "academyId_1_code_1"],
    create: [
      {
        keys: { academyId: 1, code: 1 },
        options: {
          unique: true,
          partialFilterExpression: { code: { $type: "string", $ne: "" } },
          name: "academyId_1_code_1",
        },
      },
    ],
  },

  eventenrollments: {
    drop: [
      "eventId_1_participantId_1",
      "academyId_1_eventId_1_participantId_1",
      "eventId_1_bibNo_1",
    ],
    create: [
      {
        keys: { academyId: 1, eventId: 1, participantId: 1 },
        options: {
          unique: true,
          name: "academyId_1_eventId_1_participantId_1",
        },
      },
      {
        keys: { eventId: 1, bibNo: 1 },
        options: {
          unique: true,
          partialFilterExpression: { bibNo: { $type: "string", $ne: "" } },
          name: "eventId_1_bibNo_1",
        },
      },
    ],
  },

  judgeassignments: {
    drop: [
      "eventId_1_judgeUserId_1_activityId_1_groupId_1_level_1",
      "academyId_1_eventId_1_judgeUserId_1_activityId_1_groupId_1_level_1",
    ],
    create: [
      {
        keys: {
          academyId: 1,
          eventId: 1,
          judgeUserId: 1,
          activityId: 1,
          groupId: 1,
          level: 1,
        },
        options: {
          unique: true,
          partialFilterExpression: {
            eventId: { $exists: true },
            judgeUserId: { $exists: true },
            activityId: { $exists: true },
            academyId: { $exists: true },
          },
          name: "academyId_1_eventId_1_judgeUserId_1_activityId_1_groupId_1_level_1",
        },
      },
    ],
  },

  scores: {
    drop: [
      "eventId_1_participantId_1_judgeUserId_1_activityId_1",
      "academyId_1_eventId_1_participantId_1_judgeUserId_1_activityId_1",
    ],
    create: [
      {
        keys: {
          academyId: 1,
          eventId: 1,
          participantId: 1,
          judgeUserId: 1,
          activityId: 1,
        },
        options: {
          unique: true,
          name: "academyId_1_eventId_1_participantId_1_judgeUserId_1_activityId_1",
        },
      },
    ],
  },

  awards: {
    drop: [
      "eventId_1_participantId_1_type_1",
      "academyId_1_eventId_1_participantId_1_type_1",
    ],
    create: [
      {
        keys: { academyId: 1, eventId: 1, participantId: 1, type: 1 },
        options: {
          unique: true,
          name: "academyId_1_eventId_1_participantId_1_type_1",
        },
      },
    ],
  },

  certificates: {
    drop: ["serialNo_1", "academyId_1_serialNo_1"],
    create: [
      {
        keys: { academyId: 1, serialNo: 1 },
        options: { unique: true, name: "academyId_1_serialNo_1" },
      },
    ],
  },
};

async function connect() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Mongo connected");
}

async function disconnect() {
  await mongoose.disconnect();
  console.log("✅ Mongo disconnected");
}

async function dropIndexIfExists(collection, indexName) {
  const indexes = await collection.indexes();
  const exists = indexes.some((i) => i.name === indexName);
  if (!exists) {
    console.log(
      `ℹ️  ${collection.collectionName}: index not found: ${indexName}`,
    );
    return;
  }
  await collection.dropIndex(indexName);
  console.log(`✅ ${collection.collectionName}: dropped ${indexName}`);
}

async function createIndex(collection, keys, options) {
  await collection.createIndex(keys, options);
  console.log(`✅ ${collection.collectionName}: created ${options.name}`);
}

async function run() {
  await connect();

  try {
    const db = mongoose.connection.db;

    for (const [collectionName, spec] of Object.entries(PLAN)) {
      const collection = db.collection(collectionName);

      for (const name of spec.drop || []) {
        await dropIndexIfExists(collection, name);
      }

      for (const def of spec.create || []) {
        await createIndex(collection, def.keys, def.options);
      }
    }

    console.log("✅ Index cleanup complete");
  } catch (err) {
    console.error("❌ Index cleanup failed:", err);
    process.exitCode = 1;
  } finally {
    await disconnect();
  }
}

run();
