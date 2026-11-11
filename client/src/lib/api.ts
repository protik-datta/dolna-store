import axios from "axios";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api",
  withCredentials: true,
  timeout: 20000,
});
export const money = (n: number) => `৳${Math.round(n).toLocaleString("en-BD")}`;
export const imageUrl = (url: string, w = 900) =>
  url.includes("res.cloudinary.com")
    ? url.replace("/upload/", "/upload/f_auto,q_auto,w_" + w + "/")
    : url;
export function errorMessage(e: unknown) {
  if (axios.isAxiosError(e))
    return e.response?.data?.message || "সার্ভারে সংযোগ করা যায়নি।";
  return "একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।";
}
