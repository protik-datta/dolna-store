import { Router } from "express";
import { z } from "zod";
import { Order, Product } from "../models/index.js";
import {
  ok,
  fail,
  asyncHandler,
  normalizePhone,
  escapeRegex,
} from "../utils/http.js";
import { requireAdmin, requireRole, csrf } from "../middleware/auth.js";
import { reserveItems, releaseItems } from "../services/stock.js";
import rateLimit from "express-rate-limit";
import { createHash, randomBytes } from "node:crypto";
const router = Router();
const orderLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many order requests. Please try again in a few minutes.",
  },
});
const orderBody = z.object({
  items: z
    .array(
      z.object({
        productId: z
          .string()
          .regex(/^[a-f\d]{24}$/i)
          .toLowerCase(),
        variantId: z
          .string()
          .regex(/^[a-f\d]{24}$/i)
          .toLowerCase()
          .optional(),
        quantity: z.coerce.number().int().min(1).max(30),
      }),
    )
    .min(1)
    .max(20)
    .transform((items) => {
      const merged = new Map();
      for (const item of items) {
        const key = `${item.productId}:${item.variantId || ""}`;
        const existing = merged.get(key);
        if (existing) existing.quantity += item.quantity;
        else merged.set(key, { ...item });
      }
      return [...merged.values()];
    })
    .refine(
      (items) => items.every((item) => item.quantity <= 30),
      "Maximum quantity per product variant is 30.",
    ),
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().min(8).max(20),
    address: z.string().trim().min(8).max(1000),
  }),
  deliveryZone: z.enum(["dhaka", "outside"]),
  paymentMethod: z.enum(["manual", "cod"]).default("cod"),
  note: z.string().max(1000).optional().default(""),
});
function makeNumber() {
  const d = new Date(),
    date = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `DLN-${date}-${randomBytes(4).toString("hex").toUpperCase()}`;
}
function requestHash(value) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        customer: {
          ...value.customer,
          phone: normalizePhone(value.customer.phone),
        },
        items: value.items
          .map(
            (item) =>
              `${item.productId}:${item.variantId || ""}:${item.quantity}`,
          )
          .sort(),
        deliveryZone: value.deliveryZone,
        paymentMethod: value.paymentMethod,
        note: value.note,
      }),
    )
    .digest("hex");
}
function publicOrder(order) {
  const {
    adminNote,
    statusHistory,
    idempotencyKey,
    dedupeKey,
    requestHash,
    ...data
  } = order.toObject();
  return data;
}
function deliveryFor(subtotal, zone) {
  const threshold = Number(process.env.FREE_DELIVERY_ABOVE || 0);
  if (threshold > 0 && subtotal >= threshold) return 0;
  return Number(
    zone === "dhaka"
      ? process.env.DELIVERY_CHARGE_DHAKA || 80
      : process.env.DELIVERY_CHARGE_OUTSIDE || 150,
  );
}
router.post(
  "/quote",
  asyncHandler(async (req, res) => {
    const v = z
      .object({
        items: orderBody.shape.items,
        deliveryZone: z.enum(["dhaka", "outside"]),
      })
      .parse(req.body);
    const products = await Product.find({
      _id: { $in: v.items.map((i) => i.productId) },
      isPublished: true,
    });
    const map = new Map(products.map((p) => [p.id, p]));
    const lines = [];
    for (const line of v.items) {
      const p = map.get(line.productId);
      if (!p) return fail(res, "একটি পণ্য আর উপলভ্য নেই।", 409);
      const variant = line.variantId ? p.variants.id(line.variantId) : null;
      if (line.variantId && !variant)
        return fail(res, "পণ্যের ভ্যারিয়েন্ট পাওয়া যায়নি।", 409);
      if (p.variants.length && !variant)
        return fail(res, "পণ্যের ভ্যারিয়েন্ট নির্বাচন করুন।", 400);
      const stock = variant ? variant.stock : p.stock;
      if (stock < line.quantity)
        return fail(res, `${p.name}-এর পর্যাপ্ত স্টক নেই।`, 409);
      const unitPrice = variant?.price ?? p.price;
      lines.push({
        productId: p.id,
        variantId: variant?.id,
        name: p.name,
        variantLabel: variant?.label || "",
        image: p.images[0]?.url || "",
        unitPrice,
        quantity: line.quantity,
        lineTotal: unitPrice * line.quantity,
      });
    }
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const deliveryCharge = deliveryFor(subtotal, v.deliveryZone);
    ok(res, {
      items: lines,
      subtotal,
      deliveryCharge,
      total: subtotal + deliveryCharge,
    });
  }),
);
router.post(
  "/",
  orderLimit,
  asyncHandler(async (req, res) => {
    const v = orderBody.parse(req.body);
    const phone = normalizePhone(v.customer.phone);
    if (!/^01[3-9]\d{8}$/.test(phone))
      return fail(res, "সঠিক বাংলাদেশি মোবাইল নম্বর দিন।", 400);
    const key = z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .parse(req.get("Idempotency-Key"));
    const hash = requestHash(v);
    if (key) {
      const old = await Order.findOne({ idempotencyKey: key });
      if (old) {
        if (old.requestHash !== hash)
          return fail(
            res,
            "This request key was already used for a different order. Refresh checkout and try again.",
            409,
          );
        return ok(res, publicOrder(old), 200);
      }
    }
    const ids = v.items.map((i) => i.productId);
    const products = await Product.find({
      _id: { $in: ids },
      isPublished: true,
    });
    const map = new Map(products.map((p) => [p.id, p]));
    const snapshots = [];
    for (const line of v.items) {
      const p = map.get(line.productId);
      if (!p) return fail(res, "একটি পণ্য আর উপলভ্য নেই।", 409);
      const variant = line.variantId ? p.variants.id(line.variantId) : null;
      if (line.variantId && !variant)
        return fail(res, "পণ্যের ভ্যারিয়েন্ট পাওয়া যায়নি।", 409);
      if (p.variants.length && !variant)
        return fail(res, "পণ্যের ভ্যারিয়েন্ট নির্বাচন করুন।", 400);
      const unitPrice = variant?.price ?? p.price;
      snapshots.push({
        product: p._id,
        variantId: variant?._id,
        name: p.name,
        variantLabel: variant?.label || "",
        image: p.images[0]?.url || "",
        unitPrice,
        quantity: line.quantity,
        lineTotal: unitPrice * line.quantity,
      });
    }
    const dedupeKey =
      phone +
      ":" +
      snapshots
        .map((i) => `${i.product}-${i.variantId || ""}-${i.quantity}`)
        .sort()
        .join("|");
    const duplicate = await Order.findOne({
      dedupeKey,
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
    });
    if (duplicate)
      return fail(
        res,
        "এই পণ্যগুলো দিয়ে আপনার একটি অর্ডার ইতিমধ্যে গ্রহণ করা হয়েছে।",
        409,
      );
    const subtotal = snapshots.reduce((s, i) => s + i.lineTotal, 0);
    const deliveryCharge = deliveryFor(subtotal, v.deliveryZone);
    await reserveItems(snapshots);
    try {
      const order = await Order.create({
        orderNumber: makeNumber(),
        items: snapshots,
        customer: { ...v.customer, phone },
        deliveryZone: v.deliveryZone,
        paymentMethod: v.paymentMethod,
        note: v.note,
        subtotal,
        deliveryCharge,
        total: subtotal + deliveryCharge,
        status: "pending",
        statusHistory: [
          {
            status: "pending",
            note: "অর্ডারের অনুরোধ গ্রহণ করা হয়েছে। পেমেন্ট ও অর্ডার দোকান থেকে নিশ্চিত করা হবে।",
            by: "system",
          },
        ],
        stockReserved: true,
        idempotencyKey: key || undefined,
        requestHash: hash,
        dedupeKey,
      });
      return ok(res, publicOrder(order), 201);
    } catch (e) {
      await releaseItems(snapshots);
      if (e.code === 11000 && key) {
        const old = await Order.findOne({ idempotencyKey: key });
        if (old?.requestHash === hash) return ok(res, publicOrder(old));
        if (old)
          return fail(
            res,
            "This request key was already used for a different order.",
            409,
          );
      }
      throw e;
    }
  }),
);
router.get(
  "/:id([0-9a-fA-F]{24})",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) return fail(res, "অর্ডার পাওয়া যায়নি।", 404);
    ok(res, order);
  }),
);
router.get(
  "/:orderNumber",
  asyncHandler(async (req, res) => {
    const q = z.object({ phone: z.string().min(8) }).parse(req.query);
    const order = await Order.findOne({
      orderNumber: req.params.orderNumber,
      "customer.phone": normalizePhone(q.phone),
    });
    if (!order)
      return fail(res, "অর্ডারটি পাওয়া যায়নি। ফোন নম্বর যাচাই করুন।", 404);
    ok(res, publicOrder(order));
  }),
);
router.use(requireAdmin, csrf);
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        search: z.string().max(100).optional(),
        status: z
          .enum(["pending", "confirmed", "shipped", "delivered", "cancelled"])
          .optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        from: z.string().date().optional(),
        to: z.string().date().optional(),
      })
      .parse(req.query);
    const f = {};
    if (q.status) f.status = q.status;
    if (q.search) {
      const s = escapeRegex(q.search);
      f.$or = [
        { orderNumber: { $regex: s, $options: "i" } },
        { "customer.name": { $regex: s, $options: "i" } },
        { "customer.phone": { $regex: s, $options: "i" } },
      ];
    }
    if (q.from || q.to)
      f.createdAt = {
        ...(q.from ? { $gte: new Date(q.from) } : {}),
        ...(q.to ? { $lte: new Date(q.to + "T23:59:59.999Z") } : {}),
      };
    const [items, total] = await Promise.all([
      Order.find(f)
        .sort({ createdAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit),
      Order.countDocuments(f),
    ]);
    ok(res, { items, total, page: q.page, pages: Math.ceil(total / q.limit) });
  }),
);
router.get(
  "/export/csv",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(5000);
    const safe = (v) => {
      const s = String(v ?? "").replace(/[\r\n]/g, " ");
      return /^[=+\-@]/.test(s) ? "'" + s : s;
    };
    const rows = [
      [
        "Order",
        "Date",
        "Name",
        "Phone",
        "Address",
        "Status",
        "Subtotal",
        "Delivery",
        "Total",
      ],
      ...orders.map((o) => [
        o.orderNumber,
        o.createdAt.toISOString(),
        o.customer.name,
        o.customer.phone,
        o.customer.address,
        o.status,
        o.subtotal,
        o.deliveryCharge,
        o.total,
      ]),
    ];
    res
      .type("text/csv")
      .attachment("dolna-orders.csv")
      .send(
        "\uFEFF" +
          rows
            .map((r) =>
              r.map((v) => '"' + safe(v).replace(/"/g, '""') + '"').join(","),
            )
            .join("\n"),
      );
  }),
);
router.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const v = z
      .object({
        status: z.enum([
          "pending",
          "confirmed",
          "shipped",
          "delivered",
          "cancelled",
        ]),
        adminNote: z.string().max(1000).optional(),
      })
      .parse(req.body);
    const o = await Order.findById(req.params.id);
    if (!o) return fail(res, "অর্ডার পাওয়া যায়নি।", 404);
    if (
      v.status === "cancelled" &&
      o.status !== "cancelled" &&
      o.stockReserved
    ) {
      await releaseItems(o.items);
      o.stockReserved = false;
    } else if (
      o.status === "cancelled" &&
      v.status !== "cancelled" &&
      !o.stockReserved
    ) {
      await reserveItems(o.items);
      o.stockReserved = true;
    }
    o.status = v.status;
    if (v.adminNote !== undefined) o.adminNote = v.adminNote;
    o.statusHistory.push({
      status: v.status,
      by: req.admin.name,
      note: v.adminNote,
    });
    await o.save();
    ok(res, o);
  }),
);
router.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const o = await Order.findById(req.params.id);
    if (!o) return fail(res, "অর্ডার পাওয়া যায়নি।", 404);
    if (o.status !== "cancelled" && o.stockReserved)
      await releaseItems(o.items);
    await o.deleteOne();
    ok(res, { deleted: true });
  }),
);
export default router;
