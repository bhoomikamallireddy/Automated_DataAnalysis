import React, { useState, useRef } from "react";
import PropTypes from "prop-types";
import { useRouter } from "next/navigation";
import { getAuthToken } from "../../utils/auth";
import {
  ACCESS_TOKEN_KEY,
  JOBS_API_URL,
  LAST_ACTIVE_JOB_ID_KEY,
  REFRESH_TOKEN_KEY,
  STATUS_COMPLETED,
  STATUS_FAILED,
} from "../../constants/analysis";

export default function DashboardHeader({
  setSidebarOpen,
  onJobCreated,
  onStartNew,
  currentJobId,
  jobStatus,
  workspaceMode,
  setWorkspaceMode,
}) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const fileInputRef = useRef(null);
  const router = useRouter();

  const clearAuthSession = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  };

  // Logic: Handle File Selection
  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;
    if (selectedFile) {
      setFile(selectedFile);
      setUploadMessage("");
    }
    event.target.value = ""; // Reset for same-file re-selection
  };

  // Logic: Upload to Django
  const handleUpload = async () => {
    if (!file) {
      setUploadMessage("Please select a CSV file first.");
      return;
    }

    setUploadMessage("");
    setIsUploading(true);
    const token = await getAuthToken();

    if (!token) {
      setIsUploading(false);
      setUploadMessage("Session expired. Please log in again.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(JOBS_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.status === 401) {
        clearAuthSession();
        setUploadMessage("Session expired. Please log in again.");
        router.push("/login");
        return;
      }

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem(LAST_ACTIVE_JOB_ID_KEY, data.id);
        onJobCreated(data.id);
        setFile(null);
        setUploadMessage("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        setUploadMessage("Upload failed. Please check the Django server.");
      }
    } catch {
      setUploadMessage("Upload failed because of a network or server error.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-3 md:px-8 py-3 flex flex-col gap-2">
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path
                d="M3 5H17M3 10H17M3 15H17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <div className="flex lg:hidden bg-zinc-100 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setWorkspaceMode("current")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                workspaceMode === "current"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-zinc-500"
              }`}
            >
              Lab
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceMode("history")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                workspaceMode === "history"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-zinc-500"
              }`}
            >
              History
            </button>
          </div>

          <h2 className="hidden lg:block text-sm font-bold text-zinc-800">
            Project Workspace
          </h2>
        </div>

        <div className="flex items-center gap-1.5 md:gap-3 min-w-0">
          <input
            type="file"
            ref={fileInputRef}
            id="csv-upload"
            hidden
            accept=".csv"
            onChange={handleFileChange}
          />
          <label
            htmlFor="csv-upload"
            className="px-2.5 py-1.5 text-[10px] font-bold bg-zinc-100 hover:bg-zinc-200 rounded-md cursor-pointer transition-all border border-zinc-200 truncate max-w-[90px] sm:max-w-[140px] shrink-0"
          >
            {file ? file.name : "Choose CSV"}
          </label>
          <button
            type="button"
            onClick={handleUpload}
            disabled={
              !file ||
              isUploading ||
              (currentJobId &&
                jobStatus !== STATUS_COMPLETED &&
                jobStatus !== STATUS_FAILED)
            }
            className="px-3 py-1.5 text-[10px] font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-zinc-300 transition-all shrink-0"
          >
            {isUploading ? "Uploading..." : "Run Analysis"}
          </button>
          <button
            type="button"
            onClick={() => {
              onStartNew();
              setFile(null);
              setUploadMessage("");
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }}
            className="hidden md:block text-[10px] font-bold text-zinc-400 hover:text-blue-600 uppercase tracking-widest"
          >
            ↻ New
          </button>
        </div>
      </div>

      {uploadMessage && (
        <p className="text-[10px] text-amber-600 font-medium px-1 animate-pulse">
          {uploadMessage}
        </p>
      )}
    </header>
  );
}

DashboardHeader.propTypes = {
  setSidebarOpen: PropTypes.func.isRequired,
  onJobCreated: PropTypes.func.isRequired,
  onStartNew: PropTypes.func.isRequired,
  currentJobId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  jobStatus: PropTypes.string,
  workspaceMode: PropTypes.string.isRequired,
  setWorkspaceMode: PropTypes.func.isRequired,
};
