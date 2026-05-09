import fs from "fs";
import path from "path";
import multer from "multer";
import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js"; // adjust to your project

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const TEMPLATE_PATH = path.join(UPLOAD_DIR, "certificate-template.pdf");
const META_PATH = path.join(UPLOAD_DIR, "certificate-template.json");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") return cb(new Error("Only PDF allowed"));
    cb(null, true);
  },
});

router.get("/info", requireAuth, requireAdmin, (req, res) => {
  if (!fs.existsSync(TEMPLATE_PATH)) return res.json({ exists: false });
  let meta = { exists: true, filename: "certificate-template.pdf", updatedAt: null };
  try {
    if (fs.existsSync(META_PATH)) meta = { ...meta, ...JSON.parse(fs.readFileSync(META_PATH, "utf8")) };
  } catch {}
  res.json(meta);
});

router.post("/upload", requireAuth, requireAdmin, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("Missing file");
  fs.writeFileSync(TEMPLATE_PATH, req.file.buffer);

  const meta = {
    exists: true,
    filename: req.file.originalname || "certificate-template.pdf",
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));

  res.json({ ok: true, ...meta });
});

router.get("/pdf", requireAuth, requireAdmin, (req, res) => {
  if (!fs.existsSync(TEMPLATE_PATH)) return res.status(404).send("Template not found");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="certificate-template.pdf"`);
  fs.createReadStream(TEMPLATE_PATH).pipe(res);
});

export default router;