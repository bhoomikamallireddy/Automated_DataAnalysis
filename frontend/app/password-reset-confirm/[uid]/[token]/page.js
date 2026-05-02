"use client";
import { useState } from "react";
import { useRouter, useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
export default function PasswordResetConfirmPage() {
  const { uid, token } = useParams(); // Automatically grabs [uid] and [token] from the URL
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Note: You will need a matching endpoint in Django for this (Step 2 below)
      const response = await fetch(
        `${API_URL}/api/auth/password-reset-confirm/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid,
            token,
            new_password: newPassword,
          }),
        },
      );

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => router.push("/login"), 3000);
      } else {
        const data = await response.json();
        setError(
          data.detail || "Link expired or invalid. Please request a new one.",
        );
      }
    } catch (err) {
      console.error("Password reset confirmation failed:", err);
      setError("Connection failed. Check your internet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] border border-zinc-200 shadow-xl p-10">
        <div className="mb-8">
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">
            Security
          </span>
          <h1 className="text-3xl font-bold text-zinc-900 mt-2">
            New Password
          </h1>
          <p className="text-zinc-500 text-sm mt-2 font-medium">
            Please enter your new secure password below.
          </p>
        </div>

        {success ? (
          <div className="p-6 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl text-center animate-in zoom-in-95">
            <p className="font-bold text-sm">Success!</p>
            <p className="text-[10px] mt-1">
              Your password has been reset. Redirecting to login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="new-password"
                className="text-[10px] font-bold text-zinc-400 uppercase ml-1"
              >
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                required
                className="w-full mt-1.5 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-zinc-800 font-medium"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="confirm-new-password"
                className="text-[10px] font-bold text-zinc-400 uppercase ml-1"
              >
                Confirm New Password
              </label>
              <input
                id="confirm-new-password"
                type="password"
                required
                className="w-full mt-1.5 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-zinc-800 font-medium"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-2xl transition-all shadow-lg disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
