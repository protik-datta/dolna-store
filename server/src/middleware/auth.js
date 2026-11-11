import jwt from "jsonwebtoken";
import { Admin } from "../models/index.js";
import { fail, asyncHandler } from "../utils/http.js";
import { adminOrigins } from "../config/origins.js";
export const requireAdmin = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.dolna_session;
  if (!token) return fail(res, "অনুগ্রহ করে লগইন করুন।", 401);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return fail(res, "সেশন শেষ হয়েছে। আবার লগইন করুন।", 401);
  }
  const admin = await Admin.findById(payload.sub);
  if (!admin || !admin.active)
    return fail(res, "এই অ্যাকাউন্টের প্রবেশাধিকার নেই।", 401);
  req.admin = admin;
  next();
});
export const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.admin?.role)
      ? next()
      : fail(res, "এই কাজের অনুমতি নেই।", 403);
export const csrf = (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    const allowed = adminOrigins();
    if (
      req.get("x-requested-with") !== "dolna-admin" ||
      !origin ||
      !allowed.includes(origin)
    )
      return fail(res, "CSRF validation failed.", 403);
  }
  next();
};
