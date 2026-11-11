export function parseOrigins(value = "") {
  return value
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function adminOrigins() {
  return parseOrigins(
    process.env.ADMIN_ORIGIN ||
      (process.env.NODE_ENV !== "production"
        ? "http://localhost:5173,http://127.0.0.1:5173"
        : ""),
  );
}

export function allowedOrigins() {
  return [
    ...new Set([
      ...adminOrigins(),
      ...parseOrigins(
        process.env.CLIENT_ORIGIN ||
          (process.env.NODE_ENV !== "production"
            ? "http://localhost:5174,http://127.0.0.1:5174"
            : ""),
      ),
    ]),
  ];
}
