"use client";
import { useState, useEffect } from 'react';

export const useJobStatus = (jobId) => {
  const [status, setStatus] = useState('IDLE');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If jobId is null or empty, don't do anything
    if (!jobId) return;

    const checkStatus = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/jobs/${jobId}/`);
        
        if (!response.ok) throw new Error('Failed to fetch job status');
        
        const data = await response.json();
        setStatus(data.status);

        // If the backend says it's finished, stop the interval
        if (data.status === 'COMPLETED') {
          setResults(data.results);
          clearInterval(pollInterval);
        } 
        // If the backend says it failed, stop and show the error
        else if (data.status === 'FAILED') {
          setError(data.results?.error || 'Analysis failed');
          clearInterval(pollInterval);
        }
      } catch (err) {
        setError(err.message || 'Connection to server lost');
        clearInterval(pollInterval);
      }
    };

    // Pings the backend every 3 seconds
    const pollInterval = setInterval(checkStatus, 3000);

    // Run once immediately so we don't wait 3 seconds for the first update
    checkStatus();

    // Cleanup: Stop polling if the user leaves the page
    return () => clearInterval(pollInterval);
  }, [jobId]);

  return { status, results, error };
};