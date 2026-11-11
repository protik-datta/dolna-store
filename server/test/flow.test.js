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
