import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { Product } from "../models/index.js";
import { ok, fail, asyncHandler, escapeRegex } from "../utils/http.js";
import { requireAdmin, requireRole } from "../middleware/auth.js";
import {
  configureCloudinary,
  uploadBuffer,
  cloudinary,
} from "../config/cloudinary.js";
import { fileTypeFromBuffer } from "file-type";
import { parseProduct } from "../services/product-input.js";
const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
});
async function uploadImages(files) {
  if (!files?.length) return [];
  if (!configureCloudinary())
    throw Object.assign(
      new Error("Image upload is unavailable: Cloudinary is not configured."),
      { status: 503 },
    );
  const uploaded = [];
  try {
    for (const f of files) {
      const type = await fileTypeFromBuffer(f.buffer);
      if (
        !type ||
        !["image/jpeg", "image/png", "image/webp"].includes(type.mime)
      )
        throw Object.assign(
          new Error("শুধু JPEG, PNG অথবা WebP ছবি আপলোড করুন।"),
          { status: 400 },
        );
      const result = await uploadBuffer(
        f.buffer,
        process.env.CLOUDINARY_FOLDER || "dolna/products",
      );
      uploaded.push({
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
      });
    }
    return uploaded;
  } catch (e) {
    for (const img of uploaded)
      try {
        await cloudinary.uploader.destroy(img.publicId);
      } catch {}
    throw e;
  }
}
async function deleteImages(images) {
  if (!configureCloudinary()) return;
  for (const img of images || [])
    try {
      await cloudinary.uploader.destroy(img.publicId);
    } catch (e) {
      console.error("Cloudinary deletion failed", e.message);
    }
}
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        collection: z.string().optional(),
        featured: z.enum(["true", "false"]).optional(),
        search: z.string().max(100).optional(),
        sort: z
          .enum(["newest", "price-asc", "price-desc", "popular"])
          .optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(24),
      })
      .parse(req.query);
    const filter = {};
    if (!req.admin) filter.isPublished = true;
    if (q.collection) filter.collectionName = q.collection;
    if (q.featured === "true") filter.isFeatured = true;
    if (q.search)
      filter.$or = [
        { name: { $regex: escapeRegex(q.search), $options: "i" } },
        { description: { $regex: escapeRegex(q.search), $options: "i" } },
      ];
    const sort =
      q.sort === "price-asc"
        ? { price: 1 }
        : q.sort === "price-desc"
          ? { price: -1 }
          : q.sort === "popular"
            ? { isFeatured: -1, sortOrder: 1 }
            : { sortOrder: 1, createdAt: -1 };
    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip((q.page - 1) * q.limit)
        .limit(q.limit),
      Product.countDocuments(filter),
    ]);
    ok(res, {
      items: items.map((p) => ({
        ...p.toObject(),
        collection: p.collectionName,
      })),
      page: q.page,
      limit: q.limit,
      total,
      pages: Math.ceil(total / q.limit),
    });
  }),
);
router.get(
  "/collections",
  asyncHandler(async (req, res) => {
    const rows = await Product.aggregate([
      { $match: { isPublished: true } },
      { $group: { _id: "$collectionName", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    ok(
      res,
      rows.map((x) => ({ name: x._id, count: x.count })),
    );
  }),
);
router.get(
  "/manage",
  requireAdmin,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const q = z
      .object({ search: z.string().max(100).optional() })
      .parse(req.query);
    const filter = q.search
      ? { name: { $regex: escapeRegex(q.search), $options: "i" } }
      : {};
    const items = await Product.find(filter).sort({ createdAt: -1 });
    ok(
      res,
      items.map((p) => ({ ...p.toObject(), collection: p.collectionName })),
    );
  }),
);
router.get(
  "/manage/:id",
  requireAdmin,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const p = await Product.findById(req.params.id);
    if (!p) return fail(res, "পণ্যটি পাওয়া যায়নি।", 404);
    ok(res, { ...p.toObject(), collection: p.collectionName });
  }),
);
router.get(
  "/:idOrSlug",
  asyncHandler(async (req, res) => {
    z.string().min(1).parse(req.params.idOrSlug);
    const p = await Product.findOne({
      $or: [
        { slug: req.params.idOrSlug },
        {
          _id: /^[a-f\d]{24}$/i.test(req.params.idOrSlug)
            ? req.params.idOrSlug
            : null,
        },
      ],
    });
    if (!p || (!p.isPublished && !req.admin))
      return fail(res, "পণ্যটি পাওয়া যায়নি।", 404);
    ok(res, { ...p.toObject(), collection: p.collectionName });
  }),
);
router.use(requireAdmin);
router.post(
  "/",
  requireRole("admin"),
  upload.array("images", 8),
  asyncHandler(async (req, res) => {
    const v = parseProduct(req.body);
    if (v.variants.some((variant) => variant._id)) return fail(res, "New variants must not contain existing IDs.", 400);
    const images = await uploadImages(req.files);
    try {
      const p = await Product.create({ ...v, images });
      ok(res, { ...p.toObject(), collection: p.collectionName }, 201);
    } catch (e) {
      await deleteImages(images);
      throw e;
    }
  }),
);
router.put(
  "/:id",
  requireRole("admin"),
  upload.array("images", 8),
  asyncHandler(async (req, res) => {
    const p = await Product.findById(req.params.id);
    if (!p) return fail(res, "পণ্যটি পাওয়া যায়নি।", 404);
    const v = parseProduct(req.body);
    const keep = v.keepImages ?? p.images.map((image) => image.publicId);
    if (new Set(keep).size !== keep.length || keep.some((id) => !p.images.some((image) => image.publicId === id)))
      return fail(res, "Retained images must belong to this product and cannot be repeated.", 400);
    if (keep.length + (req.files?.length || 0) > 8)
      return fail(res, "A product can have at most eight images.", 400);
    const variantIds = v.variants.map((variant) => variant._id).filter(Boolean);
    if (new Set(variantIds).size !== variantIds.length || variantIds.some((id) => !p.variants.id(id)))
      return fail(res, "Variant IDs must belong to this product and cannot be repeated.", 400);
    const old = keep
      .map((id) => p.images.find((i) => i.publicId === id))
      .filter(Boolean);
    const removed = p.images.filter((i) => !keep.includes(i.publicId));
    if (removed.length && !configureCloudinary())
      throw Object.assign(
        new Error(
          "Image deletion is unavailable: Cloudinary is not configured.",
        ),
        { status: 503 },
      );
    const added = await uploadImages(req.files);
    try {
      // Helpers from the multipart form are not document fields.
      const { keepImages, ...fields } = v;
      Object.assign(p, fields, { images: [...old, ...added] });
      await p.save();
    } catch (e) {
      await deleteImages(added);
      throw e;
    }
    await deleteImages(removed);
    ok(res, { ...p.toObject(), collection: p.collectionName });
  }),
);
router.patch(
  "/:id/publish",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const body = z.object({ isPublished: z.boolean() }).parse(req.body);
    const p = await Product.findByIdAndUpdate(
      req.params.id,
      { isPublished: body.isPublished },
      { new: true },
    );
    if (!p) return fail(res, "পণ্যটি পাওয়া যায়নি।", 404);
    ok(res, p);
  }),
);
router.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const p = await Product.findById(req.params.id);
    if (!p) return fail(res, "পণ্যটি পাওয়া যায়নি।", 404);
    if (p.images.length && !configureCloudinary())
      return fail(
        res,
        "Image deletion is unavailable: Cloudinary is not configured.",
        503,
      );
    await p.deleteOne();
    await deleteImages(p.images);
    ok(res, { deleted: true });
  }),
);
export default router;
