import "dotenv/config";
import mongoose from "mongoose";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";

if (!process.env.TEST_MONGODB_URI)
  throw new Error(
    "Set TEST_MONGODB_URI. This runner creates and removes its own temporary database on that MongoDB server.",
  );
const uri = new URL(process.env.TEST_MONGODB_URI);
const authenticationDatabase =
  uri.searchParams.get("authSource") ||
  (uri.protocol === "mongodb+srv:"
    ? "admin"
    : uri.pathname.slice(1) || "admin");
const database = `dolna_verify_${Date.now()}_${randomBytes(4).toString("hex")}`;
uri.pathname = `/${database}`;
// Keep the authentication database stable when replacing the data database.
if (!uri.searchParams.has("authSource"))
  uri.searchParams.set("authSource", authenticationDatabase);
async function availablePort() {
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}
const browserTest = process.argv.includes("--browser");
const port = await availablePort();
const adminPort = browserTest ? await availablePort() : 5173;
const clientPort = browserTest ? await availablePort() : 5174;
const env = {
  ...process.env,
  NODE_ENV: "development",
  PORT: String(port),
  MONGODB_URI: uri.toString(),
  JWT_SECRET: randomBytes(32).toString("hex"),
  ADMIN_ORIGIN: `http://localhost:${adminPort}`,
  CLIENT_ORIGIN: `http://localhost:${clientPort}`,
  TEST_BASE_URL: `http://127.0.0.1:${port}`,
  TEST_ADMIN_EMAIL: "flow-test@example.test",
  TEST_ADMIN_PASSWORD: randomBytes(24).toString("hex"),
};
let logs = "";
const frontends = [];
const api = spawn(process.execPath, ["src/index.js"], {
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
api.stdout.on("data", (chunk) => {
  logs += chunk;
});
api.stderr.on("data", (chunk) => {
  logs += chunk;
});
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("API startup timed out")),
      30000,
    );
    const check = () => {
      if (logs.includes("Dolna API listening")) {
        clearTimeout(timeout);
        resolve();
      }
    };
    api.stdout.on("data", check);
    api.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`API exited: ${code}`));
    });
    check();
  });
  if (browserTest) {
    for (const [app, appPort] of [
      ["admin", adminPort],
      ["client", clientPort],
    ]) {
      const frontend = spawn(
        process.execPath,
        [
          "node_modules/vite/bin/vite.js",
          "--host",
          "127.0.0.1",
          "--port",
          String(appPort),
        ],
        {
          cwd: new URL(`../../${app}/`, import.meta.url),
          env: { ...env, API_PROXY_TARGET: env.TEST_BASE_URL },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      frontends.push(frontend);
      frontend.stdout.on("data", (chunk) => {
        logs += chunk;
      });
      frontend.stderr.on("data", (chunk) => {
        logs += chunk;
      });
    }
  }
  const tests = spawn(
    process.execPath,
    [
      "--test",
      browserTest ? "test/publishing.browser.js" : "test/flow.test.js",
    ],
    {
      env,
      stdio: "inherit",
    },
  );
  const [code] = await once(tests, "exit");
  process.exitCode = code || 0;
} catch (error) {
  console.error(error.message);
  console.error(
    logs.replace(/mongodb(\+srv)?:\/\/[^\s]+/g, "[database connection]"),
  );
  process.exitCode = 1;
} finally {
  api.kill("SIGTERM");
  frontends.forEach((frontend) => frontend.kill("SIGTERM"));
  await mongoose.connect(uri.toString(), { serverSelectionTimeoutMS: 15000 });
  if (
    mongoose.connection.name !== database ||
    !database.startsWith("dolna_verify_")
  )
    throw new Error("Refusing to clean up a non-test database.");
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log("Temporary verification database removed.");
}
