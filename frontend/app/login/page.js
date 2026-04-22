"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const DEFAULT_LOGIN_ERROR = "Invalid username or password";
const SERVER_CONNECTION_ERROR =
  "Connection to server failed. Is Django running?";

const getLoginErrorMessage = (data) => {
  if (!data || typeof data !== "object") {
    return DEFAULT_LOGIN_ERROR;
  }

  if (typeof data.detail === "string" && data.detail.trim()) {
    return data.detail;
  }

  const firstError = Object.values(data).flat()[0];
  return typeof firstError === "string" && firstError.trim()
    ? firstError
    : DEFAULT_LOGIN_ERROR;
};

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Track if the component has mounted to avoid hydration mismatch
  const [isMounted, setIsMounted] = useState(false);

  const router = useRouter();

  useEffect(() => {
    setIsMounted(true); // Signal that we are now on the client side
    const token = localStorage.getItem("access_token");
    if (token) {
      router.push("/");
    }
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // 1. Store tokens in localStorage
        localStorage.setItem("access_token", data.access);
        localStorage.setItem("refresh_token", data.refresh);
        // FIX: Clear the old job ID so the dashboard doesn't try to fetch
        // a job from a previous session or a different user.
        localStorage.removeItem("last_active_job_id");
        // 2. Redirect to the main dashboard
        router.push("/");
      } else {
        setError(getLoginErrorMessage(data));
      }
    } catch {
      setError(SERVER_CONNECTION_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameChange = (event) => {
    setUsername(event.target.value);
    if (error) {
      setError("");
    }
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
    if (error) {
      setError("");
    }
  };

  // Instead of checking localStorage globally, we check isMounted.
  // This prevents the hydration mismatch and the "null" race condition.
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-zinc-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] border border-zinc-200 shadow-xl p-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 mt-2">
            Welcome Back
          </h1>
          <p className="text-zinc-500 text-sm mt-2 font-medium">
            Log in to manage your data analysis jobs.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label
              htmlFor="username"
              className="text-[10px] font-bold text-zinc-400 uppercase ml-1"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              className="w-full mt-2 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-zinc-800 font-medium"
              value={username}
              onChange={handleUsernameChange}
              placeholder="Enter your username"
              autoComplete="username"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="text-[10px] font-bold text-zinc-400 uppercase ml-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              className="w-full mt-2 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-zinc-800 font-medium"
              value={password}
              onChange={handlePasswordChange}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0"></div>
              <p className="text-[11px] font-black uppercase tracking-tight">
                {error}
              </p>
            </div>
          )}
          <div className="flex justify-end mb-4">
            <Link
              href="/forgot-password"
              size="sm"
              className="text-[10px] font-bold text-zinc-400 hover:text-blue-600 transition-colors uppercase tracking-widest"
            >
              Forgot Password?
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-2xl transition-all shadow-lg shadow-zinc-200 disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
          <p className="text-center text-zinc-400 text-[10px] font-bold uppercase tracking-widest mt-6">
            New here?{" "}
            <Link href="/register" className="text-blue-600 hover:underline">
              Create Account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
