"use client"; // This is required for interactivity in Next.js

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle, uploading, success, error

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };
 // This function handles the file upload process
  const handleUpload = async () => {
    if (!file) return alert("Please select a file first!");

    setStatus("uploading");

    // We use FormData because we are sending a physical file
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/jobs/", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setStatus("success");
        setFile(null);
      } else {
        setStatus("error");
      }
    } catch (error) {
      console.error("Upload error:", error);
      setStatus("error");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-zinc-50">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-zinc-200">
        <h1 className="text-2xl font-bold text-zinc-900 mb-6 text-center">
          AutoEda Upload
        </h1>

        <div className="space-y-4">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />

          <button
            onClick={handleUpload}
            disabled={status === "uploading"}
            className={`w-full py-3 rounded-xl font-bold text-white transition-all ${
              status === "uploading" ? "bg-zinc-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {status === "uploading" ? "Uploading..." : "Upload CSV to Backend"}
          </button>

          {status === "success" && (
            <p className="text-green-600 text-center font-medium">✅ File uploaded successfully!</p>
          )}
          {status === "error" && (
            <p className="text-red-600 text-center font-medium">❌ Upload failed. Check Django server.</p>
          )}
        </div>
      </div>
    </main>
  );
}