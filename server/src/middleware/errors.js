import multer from "multer";
export function notFound(req, res) {
  res.status(404).json({ success: false, message: "রিসোর্স পাওয়া যায়নি।" });
}
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  let status = err.status || 500;
  let message = err.message || "সার্ভারে সমস্যা হয়েছে।";
  let errors = err.errors;
  if (err.name === "ZodError") {
    status = 400;
    message = "তথ্য সঠিক নয়।";
    errors = err.issues;
  } else if (err.name === "ValidationError") {
    status = 400;
    message = "তথ্য যাচাই করা যায়নি।";
    errors = Object.values(err.errors).map((e) => e.message);
  } else if (err.name === "CastError") {
    status = 400;
    message = "সঠিক আইডি দিন।";
  } else if (err.code === 11000) {
    status = 409;
    message = err.keyPattern?.slug ? "This URL slug is already used. Choose a different slug." : "এই তথ্যটি আগে থেকেই আছে।";
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message = err.message;
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Invalid JSON body.";
  } else if (err.message === "CORS origin denied") {
    status = 403;
    message = "Origin not allowed.";
  }
  if (status >= 500) console.error(err);
  res
    .status(status)
    .json({ success: false, message, ...(errors ? { errors } : {}) });
}
