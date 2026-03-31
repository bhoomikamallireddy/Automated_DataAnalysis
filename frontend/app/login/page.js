"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://127.0.0.1:8000/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // 1. Store tokens in localStorage
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        
        // 2. Redirect to the main dashboard
        router.push('/'); 
      } else {
        setError(data.detail || 'Invalid username or password');
      }
    } catch (err) {
      setError('Connection to server failed. Is Django running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] border border-zinc-200 shadow-xl p-10">
        <div className="mb-8">
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Secure Access</span>
          <h1 className="text-3xl font-bold text-zinc-900 mt-2">Welcome Back</h1>
          <p className="text-zinc-500 text-sm mt-2 font-medium">Log in to manage your data analysis jobs.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Username</label>
            <input
              type="text"
              required
              className="w-full mt-2 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-zinc-800 font-medium"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Password</label>
            <input
              type="password"
              required
              className="w-full mt-2 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-zinc-800 font-medium"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl animate-shake">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-2xl transition-all shadow-lg shadow-zinc-200 disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}