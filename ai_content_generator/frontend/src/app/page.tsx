"use client";
import { useState, useEffect, useRef } from "react";
import axios from "axios"; // Fixed import path mismatch

export default function Home() {
  const [idea, setIdea] = useState("");
  const [platform, setPlatform] = useState("");
  const [persona, setPersona] = useState("technical");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [clientId] = useState(
    () => `client_${Math.random().toString(36).substring(2, 9)}`,
  );

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const connectWebSocket = () => {
      console.log("📡 Attempting to connect to WebSocket...");
      const ws = new WebSocket(`ws://127.0.0.1:8000/ws/generate/${clientId}/`);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("⚡ WebSocket connection established with Django Channels");
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📨 Message received from worker:", data);

          if (data.status === "Streaming") {
            setResult((prevText) => prevText + data.token);
          }

          if (data.status === "Completed") {
            setResult(data.content);
            setLoading(false);
          }
        } catch (error) {
          console.error("❌ Error parsing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("❌ WebSocket error occurred:", error);
        setWsConnected(false);
      };

      ws.onclose = (event) => {
        console.log(
          `🔌 WebSocket connection closed (Code: ${event.code}). Retrying in 3s...`,
        );
        setWsConnected(false);

        if (reconnectTimeoutRef.current)
          clearTimeout(reconnectTimeoutRef.current);

        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
      }
    };
  }, []);

  const handleGenerate = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    if (!idea.trim() || !platform.trim()) {
      alert("Please fill both fields");
      return;
    }

    setLoading(true);
    setResult("");
    setCopied(false);

    try {
      const response = await axios.post("http://127.0.0.1:8000/api/generate/", {
        idea,
        platform,
        client_id: clientId,
        persona,
      });
      console.log("Task Started! ID:", response.data.task_id);

      setIdea("");
      setPlatform("");
    } catch (err: any) {
      console.error("Error dispatching task to Django:", err);
      alert("Error: " + (err.response?.data?.error || err.message));
      setResult("Failed to generate content. Check terminal logs.");
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 font-sans antialiased p-4 sm:p-6 md:p-10 selection:bg-indigo-500/30 selection:text-indigo-200">
      <div className="w-full max-w-6xl mx-auto space-y-6 md:space-y-8 my-2 md:my-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/60 pb-6">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent truncate pb-1">
              Social Media Copilot
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Powered by GroqCloud Engine
            </p>
          </div>

          <div className="inline-flex items-center self-start sm:self-center gap-2 bg-slate-900/80 border border-slate-800 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap">
            <span
              className={`h-2 w-2 rounded-full shadow-sm ${wsConnected ? "bg-emerald-500 shadow-emerald-500/50 animate-pulse" : "bg-rose-500 shadow-rose-500/50"}`}
            />
            <span className="text-slate-400">
              {wsConnected ? "Live Connection" : "Connecting..."}
            </span>
          </div>
        </div>

        {/* Responsive Grid Interface: Flex-col on mobile, Grid-cols-2 on desktop layouts */}
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6 items-start">
          {/* COLUMN ONE: Form Entry Panel */}
          <div className="w-full bg-slate-900/40 backdrop-blur-md border border-slate-800/60 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl space-y-5">
            <div>
              <label className="block text-xs font-semibold tracking-wider uppercase text-slate-400 mb-2">
                Your Core Idea
              </label>
              <textarea
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 sm:p-3.5 text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all duration-200 resize-none text-sm leading-relaxed"
                rows={6}
                placeholder="e.g., Explain why using asynchronous database writes (acreate) in Django makes background workers incredibly efficient..."
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold tracking-wider uppercase text-slate-400 mb-2">
                  Target Platform
                </label>
                <input
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 sm:p-3.5 text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all duration-200 text-sm"
                  placeholder="e.g., LinkedIn, Twitter"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold tracking-wider uppercase text-slate-400 mb-2">
                  Copywriting Persona
                </label>
                <div className="relative">
                  <select
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 sm:p-3.5 text-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all duration-200 text-sm appearance-none cursor-pointer pr-10"
                    value={persona}
                    onChange={(e) => setPersona(e.target.value)}
                  >
                    <option
                      value="technical"
                      className="bg-slate-950 text-slate-200"
                    >
                      🛠️ Technical Expert
                    </option>
                    <option
                      value="viral_hype"
                      className="bg-slate-950 text-slate-200"
                    >
                      🔥 Viral Hype Asset
                    </option>
                    <option
                      value="corporate"
                      className="bg-slate-950 text-slate-200"
                    >
                      💼 Executive Leader
                    </option>
                    <option
                      value="sassy"
                      className="bg-slate-950 text-slate-200"
                    >
                      ⚡ Witty & Sassy Take
                    </option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <svg
                      className="fill-current h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !wsConnected}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.99] text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/10 disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 text-sm tracking-wide"
            >
              {loading
                ? "Generating post in background..."
                : "Generate High-Impact Post"}
            </button>
          </div>

          {/* COLUMN TWO: Stream Result Terminal Window */}
          <div className="w-full space-y-4">
            {loading && !result && (
              <div className="bg-slate-900/20 border border-slate-800/40 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4 animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-slate-800 rounded-md w-1/3" />
                  <div className="h-8 bg-slate-800 rounded-md w-10" />
                </div>
                <div className="space-y-2.5 pt-2">
                  <div className="h-3.5 bg-slate-800/80 rounded-md w-full" />
                  <div className="h-3.5 bg-slate-800/80 rounded-md w-11/12" />
                  <div className="h-3.5 bg-slate-800/80 rounded-md w-4/5" />
                  <div className="h-3.5 bg-slate-800/40 rounded-md w-5/6" />
                </div>
              </div>
            )}

            {result && (
              <div className="bg-gradient-to-b from-slate-900/80 to-slate-950/40 backdrop-blur-md border border-indigo-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl shadow-indigo-950/20 relative group transition-all duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-800/60 pb-3">
                  <h2 className="text-xs sm:text-sm font-bold tracking-wider uppercase text-indigo-400">
                    {loading
                      ? "Streaming Output..."
                      : "Final Copywriting Output"}
                  </h2>

                  <button
                    onClick={copyToClipboard}
                    disabled={loading}
                    className="w-full sm:w-auto justify-center text-xs font-semibold text-slate-300 hover:text-white transition-all bg-slate-800/80 hover:bg-slate-700/80 px-3 py-1.5 rounded-lg border border-slate-700/50 shadow-sm active:scale-95 flex items-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    {copied ? (
                      <>
                        <span className="text-emerald-400">✓</span> Copied!
                      </>
                    ) : (
                      <>
                        <span>📋</span> Copy Post
                      </>
                    )}
                  </button>
                </div>

                <p className="text-slate-200 whitespace-pre-wrap leading-relaxed text-sm tracking-wide font-normal selection:bg-indigo-500/40 break-words">
                  {result}
                  {loading && (
                    <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-400 animate-pulse vertical-middle" />
                  )}
                </p>
              </div>
            )}

            {!result && !loading && (
              <div className="hidden lg:flex flex-col items-center justify-center text-center border border-dashed border-slate-800/60 rounded-2xl h-[332px] p-6 text-slate-600">
                <span>✨</span>
                <p className="text-xs tracking-wide mt-2">
                  Generated copywriting copy text blocks will render stream
                  responses here in real-time.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
