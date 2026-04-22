"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthToken } from "../utils/auth";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const LAST_ACTIVE_JOB_ID_KEY = "last_active_job_id";
const STATUS_IDLE = "IDLE";
const STATUS_COMPLETED = "COMPLETED";
const STATUS_FAILED = "FAILED";
const POLL_INTERVAL_MS = 3000;
const DEFAULT_POLLING_ERROR = "Polling failed";
const DEFAULT_ANALYSIS_ERROR = "Analysis failed";
const FETCH_STATUS_ERROR = "Failed to fetch job status";

export const useJobStatus = (jobId) => {
  const [status, setStatus] = useState(STATUS_IDLE);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    let pollIntervalId;

    const stopPolling = () => {
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
      }
    };

    const clearAuthData = () => {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    };

    const resetJobState = () => {
      setStatus(STATUS_IDLE);
      setResults(null);
      setError(null);
    };

    if (!jobId) {
      resetJobState();
      return;
    }

    const checkStatus = async () => {
      const token = await getAuthToken();

      if (!token) {
        stopPolling();
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/jobs/${jobId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
          stopPolling();
          clearAuthData();
          router.push("/login");
          return;
        }

        if (response.status === 404 || response.status === 403) {
          localStorage.removeItem(LAST_ACTIVE_JOB_ID_KEY);
          resetJobState();
          stopPolling();
          return;
        }

        if (!response.ok) {
          stopPolling();
          setError(FETCH_STATUS_ERROR);
          return;
        }

        const data = await response.json();
        setStatus(data.status);
        setError(null);

        if (data.status === STATUS_COMPLETED) {
          setResults(data.results);
          stopPolling();
          return;
        }

        if (data.status === STATUS_FAILED) {
          setError(data.results?.error || DEFAULT_ANALYSIS_ERROR);
          localStorage.removeItem(LAST_ACTIVE_JOB_ID_KEY);
          stopPolling();
        }
      } catch {
        stopPolling();
        setError(DEFAULT_POLLING_ERROR);
      }
    };

    pollIntervalId = setInterval(checkStatus, POLL_INTERVAL_MS);
    checkStatus();

    return () => {
      stopPolling();
    };
  }, [jobId, router]);

  return { status, results, error };
};
