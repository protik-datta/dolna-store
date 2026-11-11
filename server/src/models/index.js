import mongoose from "mongoose";
const { Schema, model } = mongoose;
const adminSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "staff"], default: "admin" },
    active: { type: Boolean, default: true },
    failedAttempts: { type: Number, default: 0 },
    lockUntil: Date,
    lastLoginAt: Date,
  },
  { timestamps: true },
);
const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    width: Number,
    height: Number,
  },
  { _id: false },
);
const variantSchema = new Schema(
  {
    label: { type: String, required: true },
    sku: String,
    price: Number,
    stock: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);
const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    collectionName: { type: String, required: true, trim: true },
    shortDescription: String,
    description: String,
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    images: [imageSchema],
    variants: [variantSchema],
    stock: { type: Number, default: 0, min: 0 },
    features: [String],
    specs: [{ label: String, value: String }],
    isPublished: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);
productSchema.index({
  name: "text",
  description: "text",
  shortDescription: "text",
});
const orderSchema = new Schema(
  {
    orderNumber: { type: String, unique: true, required: true },
    items: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        variantId: Schema.Types.ObjectId,
        name: String,
        variantLabel: String,
        image: String,
        unitPrice: Number,
        quantity: Number,
        lineTotal: Number,
      },
    ],
    customer: { name: String, phone: String, address: String },
    deliveryZone: { type: String, enum: ["dhaka", "outside"], required: true },
    note: String,
    paymentMethod: { type: String, enum: ["manual", "cod"], default: "manual" },
    subtotal: Number,
    deliveryCharge: Number,
    total: Number,
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    statusHistory: [
      {
        status: String,
        note: String,
        at: { type: Date, default: Date.now },
        by: String,
      },
    ],
    adminNote: String,
    stockReserved: { type: Boolean, default: true },
    idempotencyKey: String,
    dedupeKey: String,
    requestHash: String,
  },
  { timestamps: true },
);
orderSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  },
);
orderSchema.index({ dedupeKey: 1, createdAt: -1 });
const testimonialSchema = new Schema(
  {
    name: { type: String, required: true },
    location: String,
    text: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    isPublished: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);
export const Admin = model("Admin", adminSchema);
export const Product = model("Product", productSchema);
export const Order = model("Order", orderSchema);
export const Testimonial = model("Testimonial", testimonialSchema);
