import axios from "axios";
export const api = axios.create({
  baseURL: "/api",
  timeout: 60000,
});
// Keep open catalogue pages up to date after changes in the separate admin app.
export const catalogQueryOptions = {
  staleTime: 0,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchInterval: 30_000,
} as const;
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
