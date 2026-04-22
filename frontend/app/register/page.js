"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const LOGIN_REDIRECT_DELAY_MS = 1500;
const DEFAULT_REGISTER_ERROR = "Registration failed. Please try again.";
const CLIENT_ERROR_MESSAGE =
  "A client-side error occurred. Check if the backend is reachable.";
const PASSWORD_PLACEHOLDER = "********";

const getPasswordHints = (password) => {
  const hints = [];

  if (password.length > 0 && password.length < 8) {
    hints.push("Must be at least 8 characters");
  }

  if (/^\d+$/.test(password) && password.length > 0) {
    hints.push("Can't be entirely numeric");
  }

  const commonPasswords = ["password", "12345678", "password123"];
  if (commonPasswords.includes(password.toLowerCase())) {
    hints.push("Password is too common");
  }

  return hints;
};

const getRegisterErrorMessage = (data) => {
  if (!data) {
    return DEFAULT_REGISTER_ERROR;
  }

  const messages = Object.entries(data)
    .map(([field, value]) => {
      const label = field === "non_field_errors" ? "" : `${field}: `;
      const text = Array.isArray(value) ? value.join(" ") : String(value);
      return `${label}${text}`;
    })
    .join(" | ");

  return messages || DEFAULT_REGISTER_ERROR;
};

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirm_password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordHints, setPasswordHints] = useState([]);
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("access_token")) {
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    let redirectTimeoutId;

    if (success) {
      redirectTimeoutId = setTimeout(() => {
        router.push("/login");
      }, LOGIN_REDIRECT_DELAY_MS);
    }

    return () => {
      if (redirectTimeoutId) {
        clearTimeout(redirectTimeoutId);
      }
    };
  }, [router, success]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));

    if (name === "password") {
      setPasswordHints(getPasswordHints(value));
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          confirm_password: formData.confirm_password,
        }),
      });

      const isJsonResponse = response.headers
        .get("content-type")
        ?.includes("application/json");
      const data = isJsonResponse ? await response.json() : null;

      if (response.ok) {
        setSuccess(true);
      } else {
        setError(getRegisterErrorMessage(data));
      }
    } catch {
      setError(CLIENT_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] border border-zinc-200 shadow-xl p-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 mt-2">
            Create Account
          </h1>
          <p className="text-zinc-500 text-sm mt-2 font-medium">
            Start your automated data analysis journey.
          </p>
        </div>

        {success ? (
          <div className="p-6 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl text-center">
            <p className="font-bold">Registration Successful!</p>
            <p className="text-xs mt-1">Redirecting you to login...</p>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="text-[10px] font-bold text-zinc-400 uppercase ml-1"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="w-full mt-1.5 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-zinc-800 font-medium"
                onChange={handleChange}
                placeholder="Unique username"
                autoComplete="username"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="text-[10px] font-bold text-zinc-400 uppercase ml-1"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full mt-1.5 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-zinc-800 font-medium"
                onChange={handleChange}
                placeholder="email@example.com"
                autoComplete="email"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="password"
                  className="text-[10px] font-bold text-zinc-400 uppercase ml-1"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="w-full mt-1.5 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-zinc-800 font-medium"
                  onChange={handleChange}
                  placeholder={PASSWORD_PLACEHOLDER}
                  autoComplete="new-password"
                />
                {passwordHints.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {passwordHints.map((hint) => (
                      <li
                        key={hint}
                        className="flex items-center gap-1.5 text-[10px] text-amber-600 font-semibold"
                      >
                        <span>!</span> {hint}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label
                  htmlFor="confirm_password"
                  className="text-[10px] font-bold text-zinc-400 uppercase ml-1"
                >
                  Confirm
                </label>
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  required
                  className="w-full mt-1.5 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-zinc-800 font-medium"
                  onChange={handleChange}
                  placeholder={PASSWORD_PLACEHOLDER}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold rounded-xl italic">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-2xl transition-all shadow-lg shadow-zinc-200 disabled:opacity-50 mt-4"
            >
              {loading ? "Creating Account..." : "Get Started"}
            </button>

            <p className="text-center text-zinc-400 text-[10px] font-bold uppercase tracking-widest mt-6">
              Already a member?{" "}
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
