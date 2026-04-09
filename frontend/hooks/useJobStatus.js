"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Import router for redirection

const getAuthToken = async () => {
  if (typeof window === 'undefined') return null;

  let accessToken = localStorage.getItem('access_token');
  const refreshToken = localStorage.getItem('refresh_token');

  if (!accessToken) return null;

  // 1. Helper to check if token is expired (JWTs are Base64 encoded)
  const isExpired = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // Date.now() is in ms, payload.exp is in seconds
      return payload.exp * 1000 < Date.now();
    } catch (e) {
      return true;
    }
  };

  // 2. If valid, just return it
  if (!isExpired(accessToken)) {
    return accessToken;
  }

  // 3. If expired, try to refresh
  console.log("Access token expired. Attempting silent refresh...");
  try {
    const response = await fetch('http://127.0.0.1:8000/api/auth/refresh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('access_token', data.access);
      console.log("Token refreshed successfully.");
      return data.access;
    } else {
      // Refresh token is also expired or invalid
      throw new Error("Session expired");
    }
  } catch (error) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/login'; // Force a hard redirect
    return null;
  }
};

export const useJobStatus = (jobId) => {
  const [status, setStatus] = useState('IDLE');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const router = useRouter(); 

  useEffect(() => {
    // If jobId is null or empty, don't do anything
    if (!jobId) {
      setStatus('IDLE');
      setResults(null);
      setError(null);
      return;}

    const checkStatus = async () => {
      const token = await getAuthToken(); 
  
      if (!token) return; // Stop if user was kicked to login
      try {
       const response = await fetch(`http://127.0.0.1:8000/api/jobs/${jobId}/`, {
       headers: {'Authorization': `Bearer ${token}`,}
       });
        if (response.status === 401) {
          clearInterval(pollInterval);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          router.push('/login');
          return;
        }

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
          localStorage.removeItem('last_active_job_id')
          clearInterval(pollInterval);
        }
      } catch (err) {
        setError(err.message || 'Connection to server lost');
           // Be careful here: if it's just a 500 error from the server during reload, 
    // we don't necessarily want to kill the interval immediately.
    console.error("Polling error:", err);
        clearInterval(pollInterval);
      }
    };

    // Pings the backend every 3 seconds
    const pollInterval = setInterval(checkStatus, 3000);

    // Run once immediately so we don't wait 3 seconds for the first update
    checkStatus();

    // Cleanup: Stop polling if the user leaves the page
    return () => clearInterval(pollInterval);
  }, [jobId, router]);

  return { status, results, error };
};