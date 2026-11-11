import axios from "axios";
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 60000,
  headers: { "X-Requested-With": "dolna-admin" },
});
export const money = (n: number) => `৳${Math.round(n).toLocaleString("en-BD")}`;
export function errorMessage(e: unknown): string {
  if (!axios.isAxiosError(e)) return e instanceof Error ? e.message : "একটি সমস্যা হয়েছে।";
  if (!e.response) return "Cannot reach the API. Check that the server is running, then try again.";
  const data = e.response.data;
  if (Array.isArray(data?.errors)) {
    const details = data.errors.map((issue: { path?: (string | number)[]; message?: string } | string) =>
      typeof issue === "string" ? issue : `${issue.path?.join(".") || "Form"}: ${issue.message || "Invalid value"}`,
    );
    return details.join("; ");
  }
  return data?.message || `Request failed (${e.response.status}). Please try again.`;
}
