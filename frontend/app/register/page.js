"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Guard: If already logged in, go to dashboard
  useEffect(() => {
    if (localStorage.getItem('access_token')) {
      router.push('/');
    }
  }, [router]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError('');

  if (formData.password !== formData.confirmPassword) {
    setError("Passwords do not match");
    setLoading(false);
    return;
  }

  try {
    const response = await fetch('http://127.0.0.1:8000/api/auth/register/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: formData.username,
        email: formData.email,
        password: formData.password
      }),
    });

    // Check if response is empty before parsing JSON
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (response.ok) {
      setSuccess(true);
      // Give the user a moment to see the success message
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } else {
      // Safely extract error message from Django's dictionary response
      const errorMsg = data 
        ? Object.values(data).flat().join(' ') 
        : 'Registration failed server-side';
      setError(errorMsg);
    }
  } catch (err) {
    console.error("Register Error:", err);
    setError('A client-side error occurred. Check if the backend is reachable.');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] border border-zinc-200 shadow-xl p-10">
        <div className="mb-8">
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Join the Lab</span>
          <h1 className="text-3xl font-bold text-zinc-900 mt-2">Create Account</h1>
          <p className="text-zinc-500 text-sm mt-2 font-medium">Start your automated data analysis journey.</p>
        </div>

        {success ? (
          <div className="p-6 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl text-center">
            <p className="font-bold">Registration Successful!</p>
            <p className="text-xs mt-1">Redirecting you to login...</p>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Username</label>
              <input
                name="username"
                type="text"
                required
                className="w-full mt-1.5 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-zinc-800 font-medium"
                onChange={handleChange}
                placeholder="Unique username"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Email</label>
              <input
                name="email"
                type="email"
                required
                className="w-full mt-1.5 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-zinc-800 font-medium"
                onChange={handleChange}
                placeholder="email@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Password</label>
                <input
                  name="password"
                  type="password"
                  required
                  className="w-full mt-1.5 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-zinc-800 font-medium"
                  onChange={handleChange}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Confirm</label>
                <input
                  name="confirmPassword"
                  type="password"
                  required
                  className="w-full mt-1.5 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-zinc-800 font-medium"
                  onChange={handleChange}
                  placeholder="••••••••"
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
              Already a member? <Link href="/login" className="text-blue-600 hover:underline">Log In</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}