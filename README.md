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

- Node.js 18+ (Node 20 or 22 recommended)
- npm 9+
- MongoDB local instance or MongoDB Atlas database
- Cloudinary account for production image uploads
- Three terminals for the API, storefront and admin dashboard

## Local setup

1. Copy each example environment file:
   - `server/.env.example` → `server/.env`
   - `client/.env.example` → `client/.env`
   - `admin/.env.example` → `admin/.env`
2. Set `MONGODB_URI` and a randomly generated `JWT_SECRET` of at least 32 characters in `server/.env`. Set `CLIENT_ORIGIN=http://localhost:5174` and `ADMIN_ORIGIN=http://localhost:5173`.
3. Add Cloudinary credentials to `server/.env` for image uploads. The store can run without Cloudinary, but uploads return HTTP 503 until configured.
4. Install dependencies in each app:

   ```bash
   cd server && npm install
   cd ../client && npm install
   cd ../admin && npm install
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

   Health check: `GET http://localhost:5001/api/health`.

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
| `VITE_API_URL` | API base URL, e.g. `http://localhost:5001/api` |
| `VITE_SITE_URL` | Public canonical site URL |
| `VITE_WHATSAPP_NUMBER` | WhatsApp number in international digits, without `+` |
| `VITE_META_PIXEL_ID` | Optional Meta Pixel ID; no customer PII is sent |

### Admin (`admin/.env`)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API base URL, e.g. `http://localhost:5001/api` |

No admin credentials, JWT secret, or Cloudinary secret belongs in either Vite environment.

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
| GET | `/api/admin/stats` | Admin/staff | Store KPIs, status counts, low stock and revenue series |
| GET | `/api/products/manage` | Admin/staff | Product management list |
| GET | `/api/products/manage/:id` | Admin/staff | Get a product including unpublished fields |
| POST | `/api/products` | Admin | Create product and upload images |
| PUT | `/api/products/:id` | Admin | Update product and reconcile images |
| PATCH | `/api/products/:id/publish` | Admin | Publish/unpublish |
| DELETE | `/api/products/:id` | Admin | Delete product and its Cloudinary images |
| GET | `/api/orders` | Admin/staff | Search and filter orders |
| GET | `/api/orders/export/csv` | Admin | CSV export with spreadsheet formula neutralization |
| PATCH | `/api/orders/:id/status` | Admin/staff | Update status and stock reservation |
| DELETE | `/api/orders/:id` | Admin | Delete order and release reserved stock when required |
| GET | `/api/admin/testimonials` | Admin/staff | List all testimonials |
| POST/PUT/DELETE | `/api/admin/testimonials` | Admin | Testimonial CRUD |
| GET | `/sitemap.xml` | Public | Dynamic sitemap including published product URLs |

## Security and order rules

- Admin sessions use a signed HS256 JWT in an `httpOnly` cookie. The token is never returned in JSON or stored in browser local storage.
- Admin write requests require `X-Requested-With: dolna-admin` and an allowed `Origin`. Admin routes reload the admin from MongoDB on each request, so deactivation takes effect immediately. Staff accounts are limited to viewing orders and updating order status; product, testimonial, dashboard, export and destructive actions require the `admin` role.
- Login is rate-limited and locks an account for 15 minutes after five consecutive failures. Passwords are bcrypt-hashed with cost 12.
- CORS uses explicit `CLIENT_ORIGIN` and `ADMIN_ORIGIN` allow-lists. Helmet, request-size limits, API rate limits and Zod validation are enabled.
- The order API accepts product IDs, variant IDs and quantities only. It calculates prices, delivery and totals from MongoDB; client-submitted prices are ignored.
- Stock is reserved with conditional MongoDB updates. A partial reservation is compensated if another cart line cannot be reserved. Cancelling releases stock; reopening a cancelled order reserves it again.
- `Idempotency-Key` protects retries. A matching phone/cart is also blocked for ten minutes.
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

No product images are stored on the application filesystem or committed to Git. When editing a product, the admin sends `keepImages` in the desired retained order plus any new files. Removed Cloudinary images are deleted after the MongoDB update succeeds. Cloudinary delete failures are logged. If Cloudinary credentials are absent, upload requests return HTTP 503.

## Verification

### Build commands

```bash
cd client && npm install && npm run build
cd ../admin && npm install && npm run build
cd ../server && npm install
```

### API flow test

Use a dedicated, empty test database. Start the API against that database, then run:

```bash
cd server
MONGODB_URI='mongodb://127.0.0.1:27017/dolna_flow_test' \
TEST_BASE_URL='http://localhost:5001' \
ADMIN_ORIGIN='http://localhost:5173' \
TEST_ADMIN_EMAIL="$TEST_ADMIN_EMAIL" TEST_ADMIN_PASSWORD="$TEST_ADMIN_PASSWORD" npm run test:flow
```

The test invokes the `create-admin` CLI and exercises login cookie creation, unauthorized admin rejection, product create/publish/public listing, tampered-price rejection, idempotency, ten-minute duplicate blocking, oversell rejection without stock loss, cancellation stock restoration, and product deletion. It creates an admin and product in the configured database; use a disposable database only.

## Deployment

### Render (API)

1. Create a Web Service from the repository with **Root Directory** `server`.
2. Build command: `npm install`. Start command: `npm start`.
3. Add all required server environment variables. Use a strong random `JWT_SECRET`, Atlas `MONGODB_URI`, and Cloudinary credentials.
4. Set `CLIENT_ORIGIN` and `ADMIN_ORIGIN` to the deployed Vercel storefront/admin origins. For cross-site cookies, production cookies use `SameSite=None; Secure`.
5. Set the health check path to `/api/health`. Add the Render outbound IP/network access to the MongoDB Atlas allow-list as required by your Atlas configuration.

### Vercel (storefront and admin)

Deploy `client` and `admin` as two separate Vercel projects with their respective root directories. Set `VITE_API_URL` in both to the Render API URL plus `/api`. Set `VITE_SITE_URL` and `VITE_WHATSAPP_NUMBER` in the storefront. The SPA rewrite preserves `robots.txt` and `sitemap.xml` requests. Replace `https://dolna.example` in `client/public/robots.txt` with the real public domain and set the server `CLIENT_ORIGIN` to that domain so the dynamic `/sitemap.xml` uses the correct host.

Because the storefront, admin and API may be on different domains, ensure production cookie attributes remain `SameSite=None; Secure`, CORS allows both exact origins, and all admin writes carry the CSRF header and allowed Origin.

## Troubleshooting

- **CORS error:** confirm exact scheme, hostname and port in `CLIENT_ORIGIN` / `ADMIN_ORIGIN`; do not use `*` with credentials. On macOS, Control Center/AirPlay can occupy port `5000`, so requests to that port may receive a 403 without CORS headers. Set the API `PORT=5001` and `VITE_API_URL=http://localhost:5001/api` in both `client/.env` and `admin/.env`. Restart Vite after editing either `.env` file.
- **Cookie not set in production:** confirm HTTPS, `SameSite=None; Secure`, credentials enabled in Axios and CORS, and that the browser accepts the cross-site cookie policy.
- **Cloudinary 503:** set all three Cloudinary credentials in the server environment and restart the API.
- **Product uploads rejected:** use JPEG, PNG or WebP; each file must be no larger than 5 MB and no more than eight files per request.
- **Order stock conflict:** the API is authoritative; ask the customer to refresh the cart and retry with available stock.
- **MongoDB startup failure:** verify `MONGODB_URI`, database network access and credentials. The API intentionally fails fast when the database URI or a sufficiently long JWT secret is missing.

## Current implementation notes

This codebase is delivered with the API, storefront and admin source. The build sandbox could not resolve `registry.npmjs.org` (DNS/network access was unavailable), so the included `package-lock.json` files currently preserve each app's root manifest but do not contain a fully resolved transitive dependency tree. Run `npm install` with registry access in each app before using `npm ci` or deploying; npm will populate the complete lockfiles. The TypeScript/TSX source passed a compiler syntax-transpile check and server JavaScript passed `node --check`, but full Vite builds, the API integration flow, MongoDB runtime, Cloudinary upload, browser walkthrough and screenshots were not verified in this environment. Runtime integration, live Cloudinary credentials, real MongoDB deployment and Vercel/Render deployment also depend on services and credentials not included in the project. Do not treat the source checks as proof that those external services have been configured.
