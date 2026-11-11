import axios from "axios";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api",
  withCredentials: true,
  headers: { "X-Requested-With": "dolna-admin" },
});
export const money = (n: number) => `৳${Math.round(n).toLocaleString("en-BD")}`;
export const errorMessage = (e: unknown) =>
  axios.isAxiosError(e)
    ? e.response?.data?.message || "সার্ভারে সমস্যা হয়েছে।"
    : "একটি সমস্যা হয়েছে।";
