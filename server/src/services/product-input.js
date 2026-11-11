import { z } from "zod";

const jsonArray = (schema, label) =>
  z.preprocess((value, ctx) => {
    if (typeof value !== "string") return value;
    if (!value.trim()) return [];
    try {
      return JSON.parse(value);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} must be valid JSON.`,
      });
      return z.NEVER;
    }
  }, z.array(schema));
const optionalPrice = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().finite().min(0).optional(),
);
const flag = z.preprocess(
  (value) => (value === "true" ? true : value === "false" ? false : value),
  z.boolean().default(false),
);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid variant ID.");
const productInput = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(140)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use English letters, numbers and hyphens for the URL slug.",
    ),
  collection: z.string().trim().min(2).max(80),
  shortDescription: z.string().max(300).default(""),
  description: z.string().max(10000).default(""),
  price: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().finite().min(0),
  ),
  compareAtPrice: optionalPrice,
  stock: z.coerce.number().int().min(0).default(0),
  features: z.union([z.string(), z.array(z.string())]).default(""),
  specs: jsonArray(
    z.object({
      label: z.string().trim().min(1),
      value: z.string().trim().min(1),
    }),
    "Specifications",
  ).default([]),
  variants: jsonArray(
    z.object({
      _id: objectId.optional(),
      label: z.string().trim().min(1),
      sku: z.string().optional(),
      price: optionalPrice,
      stock: z.coerce.number().int().min(0),
    }),
    "Variants",
  ).default([]),
  isPublished: flag,
  isFeatured: flag,
  sortOrder: z.coerce.number().finite().default(0),
  keepImages: jsonArray(z.string(), "Retained images").optional(),
});

export function parseProduct(body) {
  const { collection, features, ...values } = productInput.parse(body);
  return {
    ...values,
    collectionName: collection,
    features: (typeof features === "string" ? features.split("\n") : features)
      .map((value) => value.trim())
      .filter(Boolean),
  };
}
