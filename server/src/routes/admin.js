import { Router } from "express";
import { z } from "zod";
import { Order, Product, Testimonial } from "../models/index.js";
import { ok, fail, asyncHandler } from "../utils/http.js";
import { requireAdmin, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAdmin);

router.get(
  "/stats",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [totalOrders, revenue, byStatus, today, lowStock, topProducts, last] =
      await Promise.all([
        Order.countDocuments(),
        Order.aggregate([
          { $match: { status: { $ne: "cancelled" } } },
          { $group: { _id: null, total: { $sum: "$total" } } },
        ]),
        Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Order.countDocuments({ createdAt: { $gte: start } }),
        Product.find({
          isPublished: true,
          $or: [
            { stock: { $lte: 5 }, variants: { $size: 0 } },
            { "variants.stock": { $lte: 5 } },
          ],
        }).limit(10),
        Order.aggregate([
          { $match: { status: { $ne: "cancelled" } } },
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.name",
              quantity: { $sum: "$items.quantity" },
              revenue: { $sum: "$items.lineTotal" },
            },
          },
          { $sort: { quantity: -1 } },
          { $limit: 5 },
        ]),
        Order.aggregate([
          {
            $match: {
              createdAt: { $gte: new Date(Date.now() - 30 * 86400000) },
              status: { $ne: "cancelled" },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              revenue: { $sum: "$total" },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);
    ok(res, {
      totalOrders,
      revenue: revenue[0]?.total || 0,
      byStatus,
      today,
      lowStock: lowStock.map((p) => ({
        ...p.toObject(),
        collection: p.collectionName,
      })),
      topProducts,
      last30Days: last,
    });
  }),
);

router.get(
  "/testimonials",
  requireRole("admin"),
  asyncHandler(async (req, res) =>
    ok(res, await Testimonial.find().sort({ sortOrder: 1, createdAt: -1 })),
  ),
);
router.post(
  "/testimonials",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const v = z
      .object({
        name: z.string().min(2),
        location: z.string().optional(),
        text: z.string().min(5),
        rating: z.number().int().min(1).max(5),
        isPublished: z.boolean().default(false),
        sortOrder: z.number().default(0),
      })
      .parse(req.body);
    ok(res, await Testimonial.create(v), 201);
  }),
);
router.put(
  "/testimonials/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const v = z
      .object({
        name: z.string().min(2),
        location: z.string().optional(),
        text: z.string().min(5),
        rating: z.number().int().min(1).max(5),
        isPublished: z.boolean(),
        sortOrder: z.number(),
      })
      .parse(req.body);
    const t = await Testimonial.findByIdAndUpdate(req.params.id, v, {
      new: true,
      runValidators: true,
    });
    if (!t) return fail(res, "রিভিউ পাওয়া যায়নি।", 404);
    ok(res, t);
  }),
);
router.delete(
  "/testimonials/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const t = await Testimonial.findByIdAndDelete(req.params.id);
    if (!t) return fail(res, "রিভিউ পাওয়া যায়নি।", 404);
    ok(res, { deleted: true });
  }),
);
export default router;
