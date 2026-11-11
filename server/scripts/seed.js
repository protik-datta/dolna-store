import "dotenv/config";
import mongoose from "mongoose";
import { Product, Testimonial } from "../src/models/index.js";
await mongoose.connect(
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/dolna",
);
if ((await Product.countDocuments()) === 0) {
  await Product.insertMany([
    {
      name: "শিশুর কাঠের দোলনা",
      slug: "shishur-kather-dolna",
      collectionName: "Baby Cradle দোলনা",
      shortDescription: "মজবুত কাঠের তৈরি আরামদায়ক ক্রেডল।",
      description: "শিশুর জন্য যত্ন নিয়ে তৈরি কাঠের দোলনা।",
      price: 8500,
      compareAtPrice: 9900,
      stock: 12,
      features: ["মজবুত কাঠের ফ্রেম", "মসৃণ ফিনিশ", "সহজে পরিষ্কার করা যায়"],
    },
    {
      name: "র‍্যাটান হ্যাঙ্গিং সুইং",
      slug: "rattan-hanging-swing",
      collectionName: "Rattan/Cane Dolna",
      shortDescription: "ঘরের কোণে প্রাকৃতিক সৌন্দর্য।",
      description: "হাতে বোনা র‍্যাটান স্টাইলের হ্যাঙ্গিং সুইং।",
      price: 12500,
      stock: 6,
      features: ["হাতে বোনা টেক্সচার", "ইনডোর ব্যবহারের উপযোগী"],
    },
  ]);
}
if ((await Testimonial.countDocuments()) === 0)
  await Testimonial.create({
    name: "সুমাইয়া রহমান",
    location: "ঢাকা",
    text: "দোলনাটি দেখতে সুন্দর এবং ফিনিশিংও খুব ভালো।",
    rating: 5,
    isPublished: true,
  });
console.log("Seed complete (no images or admin credentials created).");
await mongoose.disconnect();
