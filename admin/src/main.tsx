import React from "react";
import ReactDOM from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  Outlet,
} from "react-router-dom";
import axios from "axios";
import { api, errorMessage } from "./lib/api";
import type { Admin } from "./types";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Shell } from "./components/Shell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Testimonials from "./pages/Testimonials";
import "./style.css";
const qc = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 20000 },
  },
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      error.config?.url !== "/auth/login"
    )
      qc.setQueryData(["me"], null);
    return Promise.reject(error);
  },
);
function Protected() {
  const q = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/auth/me")).data.data as Admin,
  });
  const client = useQueryClient();
  const logoutMutation = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      client.clear();
      client.setQueryData(["me"], null);
    },
    onError: (e) => alert(errorMessage(e)),
  });
  if (q.isLoading)
    return <div className="auth-loading">Checking secure session...</div>;
  if (
    q.isError &&
    !(axios.isAxiosError(q.error) && q.error.response?.status === 401)
  )
    return (
      <div className="auth-loading">
        <div role="alert">
          {errorMessage(q.error)}{" "}
          <button className="secondary-btn" onClick={() => q.refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  if (q.isError || !q.data) return <Navigate to="/login" replace />;
  return (
    <AuthProvider
      value={{
        admin: q.data,
        loading: false,
        logout: () => {
          logoutMutation.mutate();
        },
      }}
    >
      <Outlet />
    </AuthProvider>
  );
}
function HomeRoute() {
  const { admin } = useAuth();
  return admin?.role === "admin" ? (
    <Dashboard />
  ) : (
    <Navigate to="/orders" replace />
  );
}
function AdminOnly() {
  const { admin } = useAuth();
  return admin?.role === "admin" ? (
    <Outlet />
  ) : (
    <Navigate to="/orders" replace />
  );
}
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Protected />}>
          <Route element={<Shell />}>
            <Route index element={<HomeRoute />} />
            <Route path="orders" element={<Orders />} />
            <Route element={<AdminOnly />}>
              <Route path="products" element={<Products />} />
              <Route path="testimonials" element={<Testimonials />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
