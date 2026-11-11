import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { Admin } from "../models/index.js";
import { ok, fail, asyncHandler } from "../utils/http.js";
import { requireAdmin } from "../middleware/auth.js";
const router = Router();
const dummyHash =
  "$2a$12$C6UzMDM.H6dfI/f/IKcEe.4Bq8w4q7G9Z8xK2vKz3wQmX9mJ7kQ2e";
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: z.string().email().max(254),
        password: z.string().min(1).max(200),
      })
      .parse(req.body);
    const admin = await Admin.findOne({
      email: body.email.toLowerCase(),
    }).select("+passwordHash");
    const locked = admin?.lockUntil && admin.lockUntil > Date.now();
    const valid = await bcrypt.compare(
      body.password,
      admin?.passwordHash || dummyHash,
    );
    if (!admin || !valid || !admin.active || locked) {
      if (admin && !locked) {
        admin.failedAttempts += 1;
        if (admin.failedAttempts >= 5) {
          admin.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
          admin.failedAttempts = 0;
        }
        await admin.save();
      }
      return fail(res, "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।", 401);
    }
    admin.failedAttempts = 0;
    admin.lockUntil = undefined;
    admin.lastLoginAt = new Date();
    await admin.save();
    const token = jwt.sign({ sub: admin.id }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });
    res.cookie("dolna_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });
    ok(res, {
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  }),
);
router.post("/logout", (req, res) => {
  res.clearCookie("dolna_session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });
  ok(res, { loggedOut: true });
});
router.get("/me", requireAdmin, (req, res) =>
  ok(res, {
    id: req.admin.id,
    name: req.admin.name,
    email: req.admin.email,
    role: req.admin.role,
  }),
);
export default router;
