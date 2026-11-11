import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, errorMessage } from "../lib/api";
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const nav = useNavigate();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async () => api.post("/auth/login", { email, password }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      nav("/");
    },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <div className="login-page">
      <form
        className="login-card"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          m.mutate();
        }}
      >
        <div className="admin-brand">
          <span>দো</span>
          <div>
            <b>DOLNA</b>
            <small>STORE MANAGEMENT</small>
          </div>
        </div>
        <h1>Welcome back</h1>
        <p>Sign in to manage your store.</p>
        <label>
          Email address
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <div className="alert">{error}</div>}
        <button className="primary-btn" disabled={m.isPending}>
          {m.isPending ? "Signing in..." : "Sign in"}
        </button>
        <small className="login-foot">
          Secure administrator access · Dolna
        </small>
      </form>
    </div>
  );
}
