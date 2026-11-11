import test from "node:test";
import assert from "node:assert/strict";
import { parseProduct } from "../src/services/product-input.js";
import { csrf } from "../src/middleware/auth.js";
import { parseOrigins } from "../src/config/origins.js";
import { normalizePhone } from "../src/utils/http.js";

const product = {
  name: "Test Dolna",
  slug: "test-dolna",
  collection: "Swings",
  price: "100",
};

test("multipart product input accepts unused JSON fields and converts form values", () => {
  const value = parseProduct({
    ...product,
    specs: "",
    variants: "",
    features: "Strong\n\nSmooth",
    isPublished: "true",
    compareAtPrice: "",
  });
  assert.deepEqual(value.variants, []);
  assert.deepEqual(value.specs, []);
  assert.deepEqual(value.features, ["Strong", "Smooth"]);
  assert.equal(value.price, 100);
  assert.equal(value.isPublished, true);
  assert.equal(value.compareAtPrice, undefined);
  assert.equal(value.collectionName, "Swings");
  assert.equal("collection" in value, false);
  assert.equal(
    value.keepImages,
    undefined,
    "omitting retained images must preserve the current images on edit",
  );
});

test("JSON product input retains existing variant IDs and accepts native arrays and booleans", () => {
  const id = "507f1f77bcf86cd799439011";
  const value = parseProduct({
    ...product,
    variants: [{ _id: id, label: "Large", stock: 2, price: null }],
    specs: [],
    isPublished: true,
  });
  assert.equal(value.variants[0]._id, id);
  assert.equal(value.variants[0].price, undefined);
  assert.equal(value.isPublished, true);
});

test("invalid product fields report the field name instead of silently saving", () => {
  for (const [field, value] of [
    ["price", ""],
    ["stock", -1],
    ["variants", "broken JSON"],
    ["specs", "{}"],
    ["isPublished", "yes"],
  ]) {
    assert.throws(
      () => parseProduct({ ...product, [field]: value }),
      (error) => {
        assert.equal(error.name, "ZodError");
        assert.ok(error.issues.some((issue) => issue.path[0] === field));
        return true;
      },
    );
  }
});

test("CSRF allows configured origins with trailing slashes and rejects foreign origins", () => {
  const original = process.env.ADMIN_ORIGIN;
  process.env.ADMIN_ORIGIN =
    " https://admin.example/ , http://localhost:5173/ ";
  try {
    assert.deepEqual(parseOrigins(process.env.ADMIN_ORIGIN), [
      "https://admin.example",
      "http://localhost:5173",
    ]);
    for (const [origin, header, accepted] of [
      ["https://admin.example", "dolna-admin", true],
      ["http://localhost:5173", "dolna-admin", true],
      ["https://foreign.example", "dolna-admin", false],
      ["https://admin.example", "", false],
    ]) {
      let next = false,
        status;
      csrf(
        { method: "POST", get: (key) => (key === "origin" ? origin : header) },
        {
          status(code) {
            status = code;
            return this;
          },
          json() {},
        },
        () => {
          next = true;
        },
      );
      assert.equal(next, accepted);
      if (!accepted) assert.equal(status, 403);
    }
  } finally {
    if (original === undefined) delete process.env.ADMIN_ORIGIN;
    else process.env.ADMIN_ORIGIN = original;
  }
});

test("Bangladeshi phones normalize Bengali digits and international prefixes", () => {
  for (const phone of [
    "01712345678",
    "+880 1712-345678",
    "৮৮০১৭১২৩৪৫৬৭৮",
    "০১৭১২৩৪৫৬৭৮",
  ])
    assert.equal(normalizePhone(phone), "01712345678");
});
