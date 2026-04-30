"use client";
import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/api/auth/password-reset/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setMessage(
          "If an account exists with this email, you will receive a reset link shortly.",
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch (err) {
      setError("Connection to server failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 font-sans text-zinc-900">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] border border-zinc-200 shadow-xl p-10">
        <div className="mb-8">
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">
            Security
          </span>
          <h1 className="text-3xl font-bold text-zinc-900 mt-2">
            Reset Password
          </h1>
          <p className="text-zinc-500 text-sm mt-2 font-medium">
            Enter your email and we&apos;ll send you a link to get back into your
            account.
          </p>
        </div>

        {message ? (
          <div className="p-6 bg-blue-50 border border-blue-100 text-blue-700 rounded-2xl text-center">
            <p className="font-bold text-sm">Check your inbox!</p>
            <p className="text-[10px] mt-1">{message}</p>
            <Link
              href="/login"
              className="block mt-4 text-[10px] font-black uppercase text-blue-600 hover:underline"
            >
              Return to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">
                Email Address
              </label>
              <input
                type="email"
                required
                className="w-full mt-1.5 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-zinc-800 font-medium transition-all"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-600 text-[10px] font-bold rounded-xl italic">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-2xl transition-all shadow-lg shadow-zinc-200 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>

            <p className="text-center text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
              Remembered it?{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
                Log In
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
