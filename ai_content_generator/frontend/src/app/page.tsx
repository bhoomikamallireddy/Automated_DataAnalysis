"use client";
import { useState } from "react";
import axios from "axios";

export default function Home() {
  const [idea, setIdea] = useState("");
  const [platform, setPlatform] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault(); // Prevents page refresh
    console.log("Button clicked!");

    if (!idea || !platform) {
      alert("Please fill both fields");
      return;
    }

    setLoading(true);
    setResult("");
    setCopied(false);
    try {
      // 127.0.0.1 is the most stable way to reach Django from WSL
      const response = await axios.post("http://127.0.0.1:8000/api/generate/", {
        idea,
        platform,
      });

      console.log("Response received:", response.data);
      setResult(response.data.content);
      setIdea("");
      setPlatform("");
    } catch (err: any) {
      console.error("Error:", err);
      // This alert will show you the EXACT error from Gemini/Django
      alert("Error: " + (err.response?.data?.error || err.message));
      setResult("Failed to generate content. Check the alert for details.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    // Reset the "Copied!" text back to "Copy" after 2 seconds
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <main className="p-10 max-w-2xl mx-auto bg-white min-h-screen text-black">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">
        Social Media Content generator
      </h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your Idea
          </label>
          <textarea
            className="w-full p-3 border border-gray-300 rounded shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            rows={4}
            placeholder="e.g. Why learning Python in 2026 is a game changer..."
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Platform
          </label>
          <input
            className="w-full p-3 border border-gray-300 rounded shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="e.g. LinkedIn, Twitter, Instagram"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          />
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-3 bg-indigo-600 text-white font-bold rounded shadow-md disabled:bg-gray-400 hover:bg-indigo-700 transition-colors"
        >
          {loading ? "Generating..." : "Generate Post"}
        </button>

        {result && (
          <div className="mt-8 p-6 bg-indigo-50 border border-indigo-200 rounded-lg shadow-inner relative">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold text-indigo-900">
                Generated Content:
              </h2>

              {/* Copy to Clipboard Button */}
              <button
                onClick={copyToClipboard}
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors bg-white px-3 py-1 rounded border border-indigo-200 shadow-sm"
              >
                {copied ? "✅ Copied!" : "📋"}
              </button>
            </div>

            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
              {result}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
