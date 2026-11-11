# Dolna (দোলনা) — E-commerce Platform

A Bengali-first furniture storefront for Dolna swings, baby cradles, hanging chairs and related home-comfort products. The project is split into a public React storefront, a cookie-authenticated admin dashboard, and an Express/MongoDB API.

## Project structure

```text
dolna-store/
  client/                 Public storefront (React 18, Vite, TypeScript)
    public/               robots.txt and static assets
    src/{components,pages,hooks,lib,types,context}/
  admin/                  Separate admin dashboard (React 18, Vite, TypeScript)
    src/{components,pages,lib,types,context}/
  server/                 Express REST API (ES modules)
    src/{config,models,controllers,routes,middleware,services,utils}/
    scripts/              create-admin and optional seed scripts
    test/                 API flow test
  README.md
  .gitignore
```

## Prerequisites

- Node.js 22+ (required by the image validation dependency)
- npm 9+
- MongoDB local instance or MongoDB Atlas database
- Cloudinary account for production image uploads
- Three terminals for the API, storefront and admin dashboard

## Local setup

1. Copy each example environment file:
   - `server/.env.example` → `server/.env`
   - `client/.env.example` → `client/.env`
   - `admin/.env.example` → `admin/.env`
2. Set `NODE_ENV=development`, `MONGODB_URI`, and a randomly generated `JWT_SECRET` of at least 32 characters in `server/.env`. Set `CLIENT_ORIGIN=http://localhost:5174` and `ADMIN_ORIGIN=http://localhost:5173`. Keep these local values separate from the production settings in Render.
3. Add Cloudinary credentials to `server/.env` for image uploads. The store can run without Cloudinary, but uploads return HTTP 503 until configured.
4. Install dependencies in each app:

   ```bash
   cd server && npm ci
   cd ../client && npm ci
   cd ../admin && npm ci
   ```

5. Create the first administrator. Credentials are read only from the server environment; there are no default credentials:

   ```bash
   cd server
   # Set ADMIN_EMAIL, ADMIN_PASSWORD (10+ chars), ADMIN_NAME in server/.env
   npm run create-admin
   ```

6. Optionally add a small set of image-free development products and a testimonial:

   ```bash
   cd server && npm run seed
   ```

   The seed script never creates an administrator and does not add placeholder product photos.

7. Start each application:

   ```bash
   # Terminal 1
   cd server && npm start                 # API: http://localhost:5001

   # Terminal 2
   cd client && npm run dev               # Storefront: http://localhost:5174

   # Terminal 3
   cd admin && npm run dev                # Admin: http://localhost:5173
   ```

   Health check: `GET http://localhost:5001/api/health`. Both frontends call their own `/api` path. Vite forwards those requests to `API_PROXY_TARGET` (default `http://127.0.0.1:5001`), so local development uses the local API.

## Environment variables

### Server (`server/.env`)

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development` or `production` |
| `PORT` | API port; defaults to 5001 |
| `MONGODB_URI` | MongoDB connection string; required |
| `JWT_SECRET` | HS256 signing secret; at least 32 characters |
| `JWT_EXPIRES_IN` | JWT lifetime, e.g. `7d` |
| `CLIENT_ORIGIN` | Comma-separated allowed storefront origins |
| `ADMIN_ORIGIN` | Comma-separated allowed admin origins and CSRF origin allow-list |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret; server only |
| `CLOUDINARY_FOLDER` | Upload folder; defaults to `dolna/products` |
| `DELIVERY_CHARGE_DHAKA` | Dhaka delivery charge in BDT |
| `DELIVERY_CHARGE_OUTSIDE` | Outside Dhaka delivery charge in BDT |
| `FREE_DELIVERY_ABOVE` | Free-delivery subtotal threshold; `0` disables it |
| `ADMIN_EMAIL` | Initial administrator email for the CLI only |
| `ADMIN_PASSWORD` | Initial administrator password for the CLI only (10+ chars) |
| `ADMIN_NAME` | Initial administrator display name for the CLI only |

### Storefront (`client/.env`)

| Variable | Purpose |
|---|---|
| `API_PROXY_TARGET` | API origin for Vite development/preview; defaults to `http://127.0.0.1:5001` |
| `VITE_SITE_URL` | Public canonical site URL |
| `VITE_WHATSAPP_NUMBER` | WhatsApp number in international digits, without `+` |
| `VITE_META_PIXEL_ID` | Optional Meta Pixel ID; no customer PII is sent |

### Admin (`admin/.env`)

| Variable | Purpose |
|---|---|
| `API_PROXY_TARGET` | API origin for Vite development/preview; defaults to `http://127.0.0.1:5001` |

Browser API requests always use `/api`; the old `VITE_API_URL` setting is no longer used. Production forwarding is configured in each app's `vercel.json`. No admin credentials, JWT secret, or Cloudinary secret belongs in either Vite environment.

## API reference

All API responses use `{ success, data }` or `{ success: false, message, errors? }`.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/health` | Public | Health check |
| GET | `/api/products` | Public | Published products; collection, featured, search, sort and pagination filters |
| GET | `/api/products/collections` | Public | Published collection names and counts |
| GET | `/api/products/:idOrSlug` | Public | Published product details |
| GET | `/api/testimonials` | Public | Published customer reviews |
| GET | `/api/settings/delivery` | Public | Delivery charges and free-delivery threshold |
| POST | `/api/orders/quote` | Public | Revalidate cart prices, stock and delivery before checkout |
| POST | `/api/orders` | Public | Create COD order; server calculates prices and reserves stock |
| GET | `/api/orders/:orderNumber?phone=` | Public | Order lookup; phone must match the order |
| GET | `/api/orders/:id` | Admin/staff | Order details by database ID |
| POST | `/api/auth/login` | Public, rate limited | Login and set an httpOnly cookie |
| POST | `/api/auth/logout` | Authenticated | Clear the session cookie |
| GET | `/api/auth/me` | Authenticated | Current admin session |
| GET | `/api/admin/stats` | Admin | Store KPIs, status counts, low stock and revenue series |
| GET | `/api/products/manage` | Admin | Product management list |
| GET | `/api/products/manage/:id` | Admin | Get a product including unpublished fields |
| POST | `/api/products` | Admin | Create product and upload images |
| PUT | `/api/products/:id` | Admin | Update product and reconcile images |
| PATCH | `/api/products/:id/publish` | Admin | Publish/unpublish |
| DELETE | `/api/products/:id` | Admin | Delete product and its Cloudinary images |
| GET | `/api/orders` | Admin/staff | Search and filter orders |
| GET | `/api/orders/export/csv` | Admin | CSV export with spreadsheet formula neutralization |
| PATCH | `/api/orders/:id/status` | Admin/staff | Update status and stock reservation |
| DELETE | `/api/orders/:id` | Admin | Delete order and release reserved stock when required |
| GET | `/api/admin/testimonials` | Admin | List all testimonials |
| POST/PUT/DELETE | `/api/admin/testimonials` | Admin | Testimonial CRUD |
| GET | `/sitemap.xml` | Public | Dynamic sitemap including published product URLs |

## Security and order rules

- Admin sessions use a signed HS256 JWT in an `httpOnly` cookie. The token is never returned in JSON or stored in browser local storage.
- Admin write requests require `X-Requested-With: dolna-admin` and an allowed `Origin`. Admin routes reload the admin from MongoDB on each request, so deactivation takes effect immediately. Staff accounts are limited to viewing orders and updating order status; product, testimonial, dashboard, export and destructive actions require the `admin` role.
- Failed login requests are rate-limited independently of session checks and logout. The API locks an account for 15 minutes after five consecutive failures. Passwords are bcrypt-hashed with cost 12.
- CORS uses explicit `CLIENT_ORIGIN` and `ADMIN_ORIGIN` allow-lists. Helmet, request-size limits, API rate limits and Zod validation are enabled.
- The order API accepts product IDs, variant IDs and quantities only. It calculates prices, delivery and totals from MongoDB; client-submitted prices are ignored.
- Stock is reserved with conditional MongoDB updates. A partial reservation is compensated if another cart line cannot be reserved. Cancelling releases stock; reopening a cancelled order reserves it again.
- `Idempotency-Key` protects matching retries and rejects reuse for a different order. Customer responses exclude private admin notes and internal request keys. A matching phone/cart is also blocked for ten minutes.
- Bangladeshi phone numbers are normalized (including Bengali digits and `+880` / `880` prefixes) and validated before order creation.

## Image upload flow

```text
Admin device
   │ multipart/form-data (up to 8 images, 5 MB each)
   ▼
Express + Multer memory storage
   │ magic-byte validation (JPEG / PNG / WebP)
   ▼
Cloudinary upload_stream → dolna/products
   │ secure_url + public_id + dimensions
   ▼
MongoDB Product.images[]
```

Products accept both multipart form fields and JSON. Blank optional specifications/variants are treated as empty arrays. Existing variant `_id` values must be retained on edit so carts and order stock references remain valid. Product validation errors include field names and appear inside the editor. Each product can have up to eight images in total. Omitting `keepImages` during an API edit preserves existing images.

No product images are stored on the application filesystem or committed to Git. When editing a product, the admin sends `keepImages` in the desired retained order plus any new files. Removed Cloudinary images are deleted after the MongoDB update succeeds. Cloudinary delete failures are logged. If Cloudinary credentials are absent, upload requests return HTTP 503.

## Verification

### Build commands

```bash
cd client && npm ci && npm run build
cd ../admin && npm ci && npm run build
cd ../server && npm ci
```

### Regression and API flow tests

```bash
cd server
npm test
# Creates a fresh dolna_verify_* database and removes it after the test.
TEST_MONGODB_URI='mongodb://127.0.0.1:27017/?authSource=admin' npm run test:isolated
```

For Atlas, set `TEST_MONGODB_URI` to a connection with permission to create and remove a temporary database. The runner replaces the database name, preserves the authentication database, starts a separate API, generates test administrator credentials, and cleans up afterward. It never uses the normal store database. The API flow covers admin authorization and CSRF, repeated session checks, multipart and JSON products, validation, duplicate slugs, variant ID preservation, publishing, testimonials, checkout quotes, server-calculated prices, COD orders, idempotency, duplicate carts, oversell rejection, cancellation/reopening/deletion stock restoration, private-note protection, dashboard statistics, CSV export, and logout.

`npm run test:flow` remains available for an already running API. That mode requires `MONGODB_URI`, `TEST_BASE_URL`, `ADMIN_ORIGIN`, `TEST_ADMIN_EMAIL`, and `TEST_ADMIN_PASSWORD`, and must target a disposable empty database.

## Deployment

### Render (API)

1. Create a Web Service from the repository with **Root Directory** `server`.
2. Build command: `npm ci`. Start command: `npm start`.
3. Add all required server environment variables. Use a strong random `JWT_SECRET`, Atlas `MONGODB_URI`, and Cloudinary credentials.
4. Set `CLIENT_ORIGIN` and `ADMIN_ORIGIN` to the deployed Vercel storefront/admin origins. For cross-site cookies, production cookies use `SameSite=None; Secure`.
5. Use Node.js 22 or newer. Set the health check path to `/api/health`. Add the Render outbound IP/network access to the MongoDB Atlas allow-list as required by your Atlas configuration.

### Vercel (storefront and admin)

Deploy `client` and `admin` as two separate Vercel projects with their respective root directories. Both `vercel.json` files forward `/api/:path*` to `https://dolna-store.onrender.com/api/:path*` before the SPA fallback. If the API hostname changes, update both files. The storefront also forwards `/sitemap.xml` to the API. Set `VITE_SITE_URL` and `VITE_WHATSAPP_NUMBER` in the storefront. The current robots file uses `https://dolna-shop.vercel.app/sitemap.xml`; update it and the server `CLIENT_ORIGIN` if the public domain changes.

The browser now sends admin requests to the admin website's own `/api` URL, and Vercel forwards them to Render. This keeps the session cookie on the admin website and avoids depending on third-party cookies. Production cookies remain `HttpOnly; SameSite=None; Secure`. Render must still allow the exact admin/storefront origins, and admin writes carry the CSRF header and browser Origin. API responses are marked `Cache-Control: no-store`.

After applying these changes, redeploy the Render API and both Vercel projects, then sign in again. Keep Render `NODE_ENV=production`, `ADMIN_ORIGIN=https://admin-panel-delta-pearl.vercel.app`, and `CLIENT_ORIGIN=https://dolna-shop.vercel.app`. Local `.env` changes are ignored by Git and do not update hosting settings.

## Troubleshooting

- **Local admin cannot save:** start the API on port 5001, keep local `NODE_ENV=development`, and ensure `ADMIN_ORIGIN` includes the exact local admin origin. `API_PROXY_TARGET` is an API origin without `/api`. Use the matching `localhost` or `127.0.0.1` origin throughout. Restart the API and Vite after environment changes.
- **Production API requests return HTML or 404:** redeploy the updated Vercel projects; `/api` rewrites must precede the SPA fallback. Confirm the rewrite destination is the correct Render host.
- **Cannot sign in:** the login screen now checks `/auth/me` before navigating. Confirm the API is reachable and the hosting origins match. A sleeping Render instance can take time to wake up; frontend requests allow 60 seconds.
- **Product will not save:** the editor displays the exact invalid fields. Slugs must be unique and contain English letters, numbers, and hyphens. Optional JSON fields can be left empty or set to `[]`. Variants require a label and nonnegative integer stock. Keep existing variant `_id` values when editing.
- **Cloudinary 503:** set all three Cloudinary credentials in the server environment and restart the API.
- **Product uploads rejected:** use JPEG, PNG or WebP; each file must be no larger than 5 MB and a product can have at most eight retained/new images combined.
- **Order stock conflict:** refresh the cart and retry with available stock. The API combines repeated cart lines when checking stock.
- **Checkout confirmation:** a successful checkout clears the bag and keeps the order receipt open. The empty-bag redirect only applies before an order is completed.
- **MongoDB startup failure:** verify the URI, database network access and credentials. The API fails fast if the URI or a sufficiently long JWT secret is missing.

## Verified on 11 November 2026

Both production frontend builds, five server regression tests, and the isolated API flow passed. A headless Chrome walkthrough using the same-origin Vite proxy and third-party cookie restrictions passed login, visible validation/duplicate-slug errors, product creation with a real Cloudinary image, editing while preserving variant IDs/images, storefront COD checkout, order confirmation/cancellation and stock restoration, testimonial publishing, product deletion, and logout. Chrome reported no page runtime errors. Temporary databases and uploaded images were removed. Dependency installation reported zero known vulnerabilities in all three applications after updating the affected packages.

The existing deployed API, MongoDB connection, administrator access, and Cloudinary credentials were checked. The changed source and routing configuration still need to be redeployed before the live websites receive these fixes.
