import mongoose from "mongoose";

const AcademySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    slug: { type: String, unique: true },

    logoUrl: String,

    primaryColor: { type: String, default: "#e11d2e" },
    secondaryColor: { type: String, default: "#111827" },

    contactEmail: String,
    phone: String,
    address: String,

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  { timestamps: true },
);

export default mongoose.model("Academy", AcademySchema);
