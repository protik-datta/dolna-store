import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db.js";
import { configureCloudinary } from "./config/cloudinary.js";
import { allowedOrigins } from "./config/origins.js";
import auth from "./routes/auth.js";
import products from "./routes/products.js";
import orders from "./routes/orders.js";
import admin from "./routes/admin.js";
import settings from "./routes/settings.js";
import { csrf } from "./middleware/auth.js";
import { notFound, errorHandler } from "./middleware/errors.js";
import { asyncHandler } from "./utils/http.js";
import { Product, Testimonial } from "./models/index.js";
import { z } from "zod";
const app = express();
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin(origin, callback) {
      callback(origin && !allowedOrigins().includes(origin) ? new Error("CORS origin denied") : null, true);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(
  "/api",
  (req, res, next) => { res.set("Cache-Control", "no-store"); next(); },
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests. Please try again in a few minutes." },
  }),
);
app.get("/api/health", (req, res) =>
  res.json({ success: true, data: { status: "ok" } }),
);
app.use(
  "/api/auth",
  csrf,
  auth,
);
app.use("/api/products", csrf, products);
app.use(
  "/api/orders",
  orders,
);
app.get("/api/testimonials", (req, res, next) => {
  try {
    z.object({}).parse(req.query);
    Testimonial.find({ isPublished: true })
      .sort({ sortOrder: 1, createdAt: -1 })
      .then((items) => res.json({ success: true, data: items }))
      .catch(next);
  } catch (e) {
    next(e);
  }
});
app.use("/api/settings", settings);
app.use("/api/admin", csrf, admin);
app.get(
  "/sitemap.xml",
  asyncHandler(async (req, res) => {
    const base = (process.env.CLIENT_ORIGIN || "https://dolna.example").split(
      ",",
    )[0];
    const products = await Product.find({ isPublished: true })
      .select("slug")
      .lean();
    res
      .type("application/xml")
      .send(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc></url>${products.map((p) => `<url><loc>${base}/product/${p.slug}</loc></url>`).join("")}</urlset>`,
      );
  }),
);
app.use(notFound);
app.use(errorHandler);
const port = Number(process.env.PORT || 5001);
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  throw new Error("JWT_SECRET must be at least 32 characters");
await connectDB(process.env.MONGODB_URI);
configureCloudinary();
app.listen(port, () => console.log(`Dolna API listening on ${port}`));
