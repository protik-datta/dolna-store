import { createContext, useContext } from "react";
import type { Admin } from "../types";
interface AuthValue {
  admin: Admin | null;
  loading: boolean;
  logout: () => void;
}
const C = createContext<AuthValue | null>(null);
export const AuthProvider = C.Provider;
export function useAuth() {
  const v = useContext(C);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}
