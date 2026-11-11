export class HttpError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}
export const ok = (res, data, status = 200) =>
  res.status(status).json({ success: true, data });
export const fail = (res, message, status = 400, errors) =>
  res
    .status(status)
    .json({ success: false, message, ...(errors ? { errors } : {}) });
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
export const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const toEnglishDigits = (value) =>
  value.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
export function normalizePhone(raw) {
  let p = toEnglishDigits(String(raw || "").replace(/[\s-]/g, ""));
  if (p.startsWith("+880")) p = "0" + p.slice(4);
  else if (p.startsWith("880")) p = "0" + p.slice(3);
  return p;
}
