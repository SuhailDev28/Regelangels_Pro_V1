// server/src/middleware/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// main middleware
export async function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    const user = await User.findById(decoded.sub)
      .populate("academyId", "name code logoUrl status")
      .lean();

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid user" });
    }

    if (user.role !== "SUPER_ADMIN" && user.academyId?.status === "INACTIVE") {
      return res.status(403).json({ message: "Academy is inactive" });
    }

    req.user = {
      id: user._id.toString(),
      _id: user._id.toString(),
      sub: user._id.toString(),
      role: user.role,
      name: user.name,
      email: user.email,
      mustChangePassword: !!user.mustChangePassword,

      academyId: user.academyId?._id?.toString() || null,
      academyName: user.academyId?.name || null,
      academyCode: user.academyId?.code || null,
      academyLogo: user.academyId?.logoUrl || null,
    };

    req.academyId = req.user.academyId;

    next();
  } catch (_err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export const requireAuth = auth;

export function requireRole(...allowed) {
  return (req, res, next) => {
    const role = req.user?.role;

    if (!role) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!allowed.includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
}
