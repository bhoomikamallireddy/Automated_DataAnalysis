"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

 useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      router.push('/');
    }
  }, [router]);

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
        const errorMessage = data.detail || 
          (typeof data === 'object' ? Object.values(data).flat()[0] : null) || 
          'Invalid username or password';
        setError(errorMessage || 'Invalid username or password');
      }
    } catch (err) {
      setError('Connection to server failed. Is Django running?');
    } finally {
      setLoading(false);
    }
  };

  // While checking for the token, we return null so the form doesn't show
  // if the user is already logged in.
  if (typeof window !== 'undefined' && localStorage.getItem('access_token')) {
    return null;
  }

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
              onChange={(e) =>  {
                setUsername(e.target.value);
                if (error) setError(''); // Clear error when user tries again
                                                                     }}
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
             <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
             <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0"></div>
             <p className="text-[11px] font-black uppercase tracking-tight">
                 {error}
              </p>
             </div>
            )}
          <div className="flex justify-end mb-4">
           <Link href="/forgot-password" size="sm" className="text-[10px] font-bold text-zinc-400 hover:text-blue-600 transition-colors uppercase tracking-widest">
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
            New here? <Link href="/register" className="text-blue-600 hover:underline">Create Account</Link>
          </p>
        </form>
      </div>
    </div>
  );
}