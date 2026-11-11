import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const base = `${process.env.TEST_BASE_URL || "http://localhost:5001"}/api`;
const email = process.env.TEST_ADMIN_EMAIL;
const password = process.env.TEST_ADMIN_PASSWORD;
const adminOrigin =
  process.env.ADMIN_ORIGIN?.split(",")[0] || "http://localhost:5173";
let cookie = "";
const adminHeaders = () => ({
  cookie,
  origin: adminOrigin,
  "X-Requested-With": "dolna-admin",
});
async function request(path, options = {}) {
  return fetch(`${base}${path}`, options);
}

// Run against a dedicated test database. The API must already be running against it.
test("Dolna end-to-end API order and stock flow", async () => {
  assert.ok(
    process.env.MONGODB_URI,
    "Set MONGODB_URI to a dedicated test database before running this test.",
  );
  assert.ok(
    email && password && password.length >= 10,
    "Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD (10+ characters) for this disposable test admin.",
  );
  const create = spawnSync(process.execPath, ["scripts/create-admin.js"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
    env: {
      ...process.env,
      ADMIN_EMAIL: email,
      ADMIN_PASSWORD: password,
      ADMIN_NAME: "Flow Test Admin",
    },
  });
  assert.equal(
    create.status,
    0,
    `create-admin failed: ${create.stderr || create.stdout}`,
  );

  const health = await request("/health");
  assert.equal(health.status, 200);

  const unauth = await request("/admin/stats");
  assert.equal(
    unauth.status,
    401,
    "admin endpoint must reject unauthenticated requests",
  );

  const login = await request("/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: adminOrigin,
      "X-Requested-With": "dolna-admin",
    },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200);
  const setCookies = login.headers.getSetCookie?.() || [
    login.headers.get("set-cookie") || "",
  ];
  cookie =
    setCookies
      .map((v) => v.split(";")[0])
      .find((v) => v.startsWith("dolna_session=")) || "";
  assert.ok(cookie, "login must set the httpOnly session cookie");
  assert.match(setCookies.join(";"), /HttpOnly/i);

  for (let index = 0; index < 15; index++) {
    const session = await request("/auth/me", { headers: adminHeaders() });
    assert.equal(
      session.status,
      200,
      "session checks must not exhaust the login rate limit",
    );
  }
  const foreignOrigin = await request("/products/manage", {
    headers: { ...adminHeaders(), origin: "https://untrusted.example" },
  });
  assert.equal(
    foreignOrigin.status,
    403,
    "CORS must reject unconfigured origins",
  );
  const noCsrf = await request("/products", {
    method: "POST",
    headers: {
      cookie,
      origin: adminOrigin,
      "content-type": "application/json",
    },
    body: "{}",
  });
  assert.equal(noCsrf.status, 403, "admin writes must require the CSRF header");

  const form = new FormData();
  for (const [k, v] of Object.entries({
    name: "Flow Test Dolna",
    slug: `flow-test-dolna-${Date.now()}`,
    collection: "Test Collection",
    shortDescription: "API verification item",
    description: "An item created only for API flow verification.",
    price: "100",
    stock: "2",
    features: "Strong frame\nSmooth finish",
    specs: "[]",
    variants: "[]",
    isPublished: "false",
    isFeatured: "false",
    sortOrder: "0",
    keepImages: "[]",
  }))
    form.append(k, v);
  const createProduct = await request("/products", {
    method: "POST",
    headers: adminHeaders(),
    body: form,
  });
  assert.equal(createProduct.status, 201, await createProduct.clone().text());
  const created = (await createProduct.json()).data;
  const productId = created._id;

  const jsonHeaders = { ...adminHeaders(), "content-type": "application/json" };
  const productBody = {
    name: "Variant Test Dolna",
    slug: `variant-test-${Date.now()}`,
    collection: "Test Collection",
    price: 100,
    isPublished: true,
    variants: [{ label: "Large", stock: 5, price: 125 }],
    specs: "",
  };
  const invalid = await request("/products", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ ...productBody, price: "" }),
  });
  assert.equal(invalid.status, 400);
  assert.ok(
    (await invalid.json()).errors.some((error) => error.path[0] === "price"),
  );
  const newVariant = await request("/products", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(productBody),
  });
  assert.equal(newVariant.status, 201, await newVariant.clone().text());
  const variantProduct = (await newVariant.json()).data;
  const variantId = variantProduct.variants[0]._id;
  const editedVariant = await request(`/products/${variantProduct._id}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify({
      ...productBody,
      variants: [
        { _id: variantId, label: "Large updated", stock: 5, price: 125 },
      ],
    }),
  });
  assert.equal(editedVariant.status, 200, await editedVariant.clone().text());
  assert.equal(
    (await editedVariant.json()).data.variants[0]._id,
    variantId,
    "editing must preserve variant IDs used by existing carts and orders",
  );
  const duplicateSlug = await request("/products", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(productBody),
  });
  assert.equal(duplicateSlug.status, 409);
  assert.match((await duplicateSlug.json()).message, /slug/i);
  const reviewBody = {
    name: "Test Customer",
    location: "Dhaka",
    text: "Excellent test product",
    rating: 5,
    isPublished: false,
    sortOrder: 0,
  };
  const reviewResponse = await request("/admin/testimonials", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(reviewBody),
  });
  assert.equal(reviewResponse.status, 201);
  const review = (await reviewResponse.json()).data;
  assert.ok(
    !(await (await request("/testimonials")).json()).data.some(
      (item) => item._id === review._id,
    ),
    "draft reviews must remain hidden from the website",
  );
  const publishReview = await request(`/admin/testimonials/${review._id}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify({ ...reviewBody, isPublished: true }),
  });
  assert.equal(publishReview.status, 200);
  assert.ok(
    (await (await request("/testimonials")).json()).data.some(
      (item) => item._id === review._id,
    ),
  );
  const hideReview = await request(
    `/admin/testimonials/${review._id}/publish`,
    {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ isPublished: false }),
    },
  );
  assert.equal(hideReview.status, 200);
  assert.ok(
    !(await (await request("/testimonials")).json()).data.some(
      (item) => item._id === review._id,
    ),
  );
  const republishReview = await request(
    `/admin/testimonials/${review._id}/publish`,
    {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ isPublished: true }),
    },
  );
  assert.equal(republishReview.status, 200);
  assert.ok(
    (await (await request("/testimonials")).json()).data.some(
      (item) => item._id === review._id,
    ),
  );
  assert.equal(
    (
      await request(`/admin/testimonials/${review._id}`, {
        method: "DELETE",
        headers: adminHeaders(),
      })
    ).status,
    200,
  );

  const publish = await request(`/products/${productId}/publish`, {
    method: "PATCH",
    headers: { ...adminHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ isPublished: true }),
  });
  assert.equal(publish.status, 200);
  const list = await request(
    `/products?search=${encodeURIComponent("Flow Test Dolna")}`,
  );
  assert.equal(list.status, 200);
  assert.ok((await list.json()).data.items.some((p) => p._id === productId));

  const orderBody = {
    items: [{ productId, quantity: 1, price: 1, unitPrice: 1 }],
    customer: {
      name: "Test Customer",
      phone: "01712345678",
      address: "House 10, Road 4, Dhanmondi, Dhaka",
    },
    deliveryZone: "dhaka",
    note: "",
  };
  const quote = await request("/orders/quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      items: [{ productId, quantity: 1 }],
      deliveryZone: "dhaka",
    }),
  });
  assert.equal(quote.status, 200);
  const quoteData = (await quote.json()).data;
  assert.equal(
    quoteData.subtotal,
    100,
    "quote must calculate the server-side product price",
  );
  assert.ok(
    quoteData.total >= 100,
    "quote total must include delivery when applicable",
  );
  const orderHeaders = {
    "content-type": "application/json",
    "Idempotency-Key": "dolna-flow-idempotency-key",
  };
  const orderResponse = await request("/orders", {
    method: "POST",
    headers: orderHeaders,
    body: JSON.stringify(orderBody),
  });
  assert.equal(orderResponse.status, 201, await orderResponse.clone().text());
  const order = (await orderResponse.json()).data;
  assert.equal(order.paymentMethod, "cod");
  assert.equal(
    order.items[0].unitPrice,
    100,
    "server must ignore client-sent price",
  );
  assert.equal(order.items[0].lineTotal, 100);

  const repeated = await request("/orders", {
    method: "POST",
    headers: orderHeaders,
    body: JSON.stringify(orderBody),
  });
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).data.orderNumber, order.orderNumber);
  const changedRetry = await request("/orders", {
    method: "POST",
    headers: orderHeaders,
    body: JSON.stringify({
      ...orderBody,
      customer: { ...orderBody.customer, phone: "01812345678" },
    }),
  });
  assert.equal(
    changedRetry.status,
    409,
    "an idempotency key cannot retrieve a different customer's order",
  );
  const duplicateLines = await request("/orders/quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      items: [
        { productId, quantity: 1 },
        { productId, quantity: 1 },
      ],
      deliveryZone: "dhaka",
    }),
  });
  assert.equal(
    duplicateLines.status,
    409,
    "stock validation must combine repeated product lines",
  );

  const duplicate = await request("/orders", {
    method: "POST",
    headers: { ...orderHeaders, "Idempotency-Key": "dolna-flow-second-key" },
    body: JSON.stringify(orderBody),
  });
  assert.equal(
    duplicate.status,
    409,
    "same phone/cart within ten minutes must be blocked",
  );

  const overstock = await request("/orders", {
    method: "POST",
    headers: { ...orderHeaders, "Idempotency-Key": "dolna-flow-overstock-key" },
    body: JSON.stringify({ ...orderBody, items: [{ productId, quantity: 3 }] }),
  });
  assert.equal(
    overstock.status,
    409,
    "ordering more than available stock must fail",
  );
  const afterFailure = await request(`/products/${productId}`);
  assert.equal(
    (await afterFailure.json()).data.stock,
    1,
    "failed order must not change stock",
  );

  const cancel = await request(`/orders/${order._id}/status`, {
    method: "PATCH",
    headers: { ...adminHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ status: "cancelled" }),
  });
  assert.equal(cancel.status, 200);
  const afterCancel = await request(`/products/${productId}`);
  assert.equal(
    (await afterCancel.json()).data.stock,
    2,
    "cancelling must restore reserved stock",
  );
  const reopen = await request(`/orders/${order._id}/status`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify({
      status: "confirmed",
      adminNote: "Private verification note",
    }),
  });
  assert.equal(reopen.status, 200);
  assert.equal(
    (await (await request(`/products/${productId}`)).json()).data.stock,
    1,
  );
  const lookup = await request(
    `/orders/${order.orderNumber}?phone=01712345678`,
  );
  assert.equal(lookup.status, 200);
  const lookupData = (await lookup.json()).data;
  assert.equal(
    lookupData.adminNote,
    undefined,
    "customer lookup must not expose private admin notes",
  );
  assert.equal(lookupData.idempotencyKey, undefined);
  assert.equal(lookupData.statusHistory, undefined);
  const invalidDate = await request("/orders?from=invalid-date", {
    headers: adminHeaders(),
  });
  assert.equal(invalidDate.status, 400);
  const stats = await request("/admin/stats", { headers: adminHeaders() });
  assert.equal(stats.status, 200);
  const csv = await request("/orders/export/csv", { headers: adminHeaders() });
  assert.equal(csv.status, 200);
  assert.match(await csv.text(), /DLN-/);
  const removeOrder = await request(`/orders/${order._id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
  assert.equal(removeOrder.status, 200);
  assert.equal(
    (await (await request(`/products/${productId}`)).json()).data.stock,
    2,
  );
  assert.equal(
    (
      await request(`/products/${variantProduct._id}`, {
        method: "DELETE",
        headers: adminHeaders(),
      })
    ).status,
    200,
  );

  const remove = await request(`/products/${productId}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
  assert.equal(
    remove.status,
    200,
    "product deletion must succeed; this test product has no Cloudinary images",
  );

  const logout = await request("/auth/logout", {
    method: "POST",
    headers: adminHeaders(),
  });
  assert.equal(logout.status, 200);
});
