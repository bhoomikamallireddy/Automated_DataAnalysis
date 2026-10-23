import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { getAuthToken } from "../../utils/auth";
import {
  JOBS_API_URL,
  HISTORY_REFRESH_INTERVAL_MS,
  STATUS_PROCESSING,
  STATUS_PENDING,
} from "../../constants/analysis";
import { getStatusBadgeClass } from "../../utils/analysisHelpers";

function HistoryLoadingState() {
  return (
    <div className="py-20 text-center">
      <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p className="text-zinc-400 text-xs mt-4 font-medium uppercase tracking-widest">
        Loading your records...
      </p>
    </div>
  );
}

function HistoryEmptyState() {
  return (
    <div className="py-32 text-center border-2 border-dashed border-zinc-200 rounded-3xl bg-white">
      <div className="h-16 w-16 bg-zinc-100 text-zinc-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
        🕒
      </div>
      <h3 className="text-lg font-bold text-zinc-800">No History Found</h3>
      <p className="text-zinc-500 text-xs mt-1">
        Upload your first CSV to see it listed here.
      </p>
    </div>
  );
}

function HistoryTable({ history, onViewResult }) {
  return (
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
                  type="button"
                  onClick={() => onViewResult(job.id)}
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
  );
}

HistoryTable.propTypes = {
  history: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      file_name: PropTypes.string,
      status: PropTypes.string,
      created_at: PropTypes.string,
    }),
  ).isRequired,
  onViewResult: PropTypes.func.isRequired,
};

export default function HistoryView({ onSelectJob }) {
  const [history, setHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyMessage, setHistoryMessage] = useState("");

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
        setHistoryMessage("");
      }
    } catch {
      setHistory([]);
      setHistoryMessage("History could not be loaded right now.");
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    const hasActiveJobs = history.some(
      (job) =>
        job.status === STATUS_PROCESSING || job.status === STATUS_PENDING,
    );

    if (!hasActiveJobs) {
      return undefined;
    }

    const intervalId = setInterval(fetchHistory, HISTORY_REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchHistory, history]);

  const handleViewResult = (jobId) => {
    onSelectJob(jobId);
  };

  let historyContent = <HistoryEmptyState />;
  if (isHistoryLoading) {
    historyContent = <HistoryLoadingState />;
  } else if (history.length > 0) {
    historyContent = (
      <HistoryTable history={history} onViewResult={handleViewResult} />
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
      <div className="flex justify-between items-center px-2">
        <h3 className="text-xl font-bold text-zinc-900">Analysis History</h3>
        <button
          type="button"
          onClick={fetchHistory}
          className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline"
        >
          Refresh List
        </button>
      </div>

      {historyMessage && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {historyMessage}
        </div>
      )}
      {historyContent}
    </div>
  );
}

HistoryView.propTypes = {
  onSelectJob: PropTypes.func.isRequired,
};
