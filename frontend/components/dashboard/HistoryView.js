import React, { useState, useEffect, useCallback, useRef } from "react";
import { getAuthToken } from "../../utils/auth";
import {
  JOBS_API_URL,
  HISTORY_REFRESH_INTERVAL_MS,
  MODE_SWITCH_DELAY_MS,
  STATUS_PROCESSING,
  STATUS_PENDING,
} from "../../constants/analysis";
import { getStatusBadgeClass } from "../../utils/analysisHelpers";

export default function HistoryView({ onSelectJob }) {
  const [history, setHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const switchModeTimeoutRef = useRef(null);

  // 1. Fetch Logic
  const fetchHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    const token = await getAuthToken();

    if (!token) {
      setIsHistoryLoading(false);
      return;
    }

    try {
      const response = await fetch(JOBS_API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch {
      setUploadMessage("History could not be loaded right now.");
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  // 2. Initial Load
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // 3. Auto-refresh Logic (Polling)
  useEffect(() => {
    let intervalId;
    const hasActiveJobs = history.some(
      (job) =>
        job.status === STATUS_PROCESSING || job.status === STATUS_PENDING,
    );

    if (hasActiveJobs) {
      intervalId = setInterval(() => {
        fetchHistory();
      }, HISTORY_REFRESH_INTERVAL_MS);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (switchModeTimeoutRef.current)
        clearTimeout(switchModeTimeoutRef.current);
    };
  }, [fetchHistory, history]);

  // 4. View Result Handler
  const handleViewResult = (jobId) => {
    // Notify parent component (page.js) to switch to dashboard view
    onSelectJob(jobId);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
      <div className="flex justify-between items-center px-2">
        <h3 className="text-xl font-bold text-zinc-900">Analysis History</h3>
        <button
          onClick={fetchHistory}
          className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline"
        >
          ↻ Refresh List
        </button>
      </div>

      {isHistoryLoading && history.length === 0 ? (
        <div className="py-20 text-center">
          <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-zinc-400 text-xs mt-4 font-medium uppercase tracking-widest">
            Loading your records...
          </p>
        </div>
      ) : history.length > 0 ? (
        <div className="overflow-hidden border border-zinc-200 rounded-3xl bg-white shadow-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-zinc-50/50 text-zinc-500 uppercase text-[10px] font-bold border-b border-zinc-100">
              <tr>
                <th className="px-6 py-4">Filename</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {history.map((job) => (
                <tr
                  key={job.id}
                  className="hover:bg-zinc-50/50 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📄</span>
                      <span className="font-bold text-zinc-800">
                        {job.file_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {/* Status Badge Integrated Directly */}
                    <span
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tighter ${getStatusBadgeClass(job.status)}`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-400 font-medium text-xs">
                    {new Date(job.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleViewResult(job.id)}
                      className="px-3 py-1.5 bg-zinc-900 text-white text-[10px] font-bold rounded-lg hover:bg-blue-600 transition-all active:scale-95"
                    >
                      View Results
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-32 text-center border-2 border-dashed border-zinc-200 rounded-3xl bg-white">
          <div className="h-16 w-16 bg-zinc-100 text-zinc-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            📭
          </div>
          <h3 className="text-lg font-bold text-zinc-800">No History Found</h3>
          <p className="text-zinc-500 text-xs mt-1">
            Upload your first CSV to see it listed here.
          </p>
        </div>
      )}
    </div>
  );
}
