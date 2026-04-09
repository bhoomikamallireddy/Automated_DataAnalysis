"use client";

import { useState, useEffect } from "react";
import { useJobStatus } from "../hooks/useJobStatus";
import { useRouter } from 'next/navigation';
import PlotlyChart from '../components/PlotlyChart';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  ScatterChart, Scatter, CartesianGrid 
} from 'recharts';
import React from 'react';

// --- ANALYSIS MODULES LIST ---
const modules = [
  { id: 'overview', label: 'Overview', icon: '🏠' },
  { id: 'audit', label: 'Audit', icon: '🔍' },
  { id: 'correlations', label: 'Correlations', icon: '🧬' },
  { id: 'ml_insights', label: 'ML Insights', icon: '🧠' },
  { id: 'distribution', label: 'Distribution', icon: '📊' },
  { id: 'recommendations', label: 'Recommendations', icon: '💡' },
];

// --- DISTRIBUTION CHART ---
function DistributionChart({ data, title }) {
  if (!data || data.length === 0) return (
    <div className="text-xs text-zinc-400 italic">No distribution data available for this column.</div>
  );

  return (
    <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl transition-all duration-300 hover:bg-white hover:shadow-md">
      <h4 className="text-[9px] font-bold text-zinc-400 uppercase mb-3 tracking-widest">{title}</h4>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="bin" fontSize={8} tick={{ fill: '#94a3b8' }} />
            <YAxis fontSize={8} tick={{ fill: '#94a3b8' }} />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '10px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              cursor={{ fill: '#f1f5f9' }}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const getCleanFileName = (fullName) => {
  if (!fullName) return "provided dataset";
  
  // 1. Remove the file extension (.csv)
  let name = fullName.split('.').slice(0, -1).join('.');
  
  // 2. Remove common Django/Random suffixes (e.g., _abc123 or _1)
  // This regex looks for an underscore followed by alphanumeric characters at the end
  name = name.replace(/_[a-zA-Z0-9]+$/, ''); 
  
  return name;
};

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

export default function Home() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState("current");
  const [file, setFile] = useState(null);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  // 1. Internal loading state to prevent UI flicker - Local loading State
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [distChartType, setDistChartType] = useState('violin');
  const [history, setHistory] = useState([]);
const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const { status: jobStatus, results, error: jobError } = useJobStatus(currentJobId);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
    }else {
      // 2. ONLY set authorized to true if the token actually exists
      setIsAuthorized(true);
    }
  }, [router]);

  // 1. HYDRATION: When the app first loads, check for an existing job
useEffect(() => {
  const savedJobId = localStorage.getItem('last_active_job_id');
  if (savedJobId && isAuthorized) {
    setCurrentJobId(savedJobId);
    // Optionally, if you have a job saved, default to 'current' workspace
    setWorkspaceMode('current');
  }
}, [isAuthorized]);

// 3. Trigger fetch when workspaceMode changes to 'history'
useEffect(() => {
  if (workspaceMode === 'history' && isAuthorized) {
    fetchHistory();
  }
}, [workspaceMode]);

// Auto-refresh history every 10 seconds ONLY if we are looking at it
useEffect(() => {
  let interval;
  if (workspaceMode === 'history') {
    interval = setInterval(() => {
      fetchHistory();
    }, 10000); // 10 seconds is plenty for a history list
  }
  return () => clearInterval(interval);
}, [workspaceMode]);


  const handleLogout = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  router.push('/login');
 };

  const handleUpload = async () => {
    if (!file) return alert("Please select a CSV file first!");
    setIsUploading(true);
    const token = await getAuthToken(); 
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/jobs/", {
        method: "POST",
          headers: {
        // 2. Add the Bearer Token to headers
        'Authorization': `Bearer ${token}`,
        // Note: Do NOT set 'Content-Type': 'multipart/form-data' manually, 
        // the browser does it automatically with the correct boundary for FormData.
      },
        body: formData,
      });
      
       if (response.status === 401) {
       // Handle expired token / unauthorized
       console.error("Session expired. Please log in again.");
       localStorage.removeItem('access_token'); // Clear stale token
       router.push('/login'); // Force re-login
       return;
       }

      if (response.ok) {
        const data = await response.json();
        // SAVE TO LOCAL STORAGE HERE
        localStorage.setItem('last_active_job_id', data.id);
        setCurrentJobId(data.id);
        setFile(null);
        // Reset the physical input so the same file can be selected again
        document.getElementById('csv-upload').value = "";
      } else {
        alert("Upload failed. Please check the Django server.");
      }
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  // 3. CLEANUP: Update your "New Analysis" button to clear the storage
const startNewAnalysis = () => {
  setCurrentJobId(null);
  setFile(null);
  localStorage.removeItem('last_active_job_id');
};

  
  const fetchHistory = async () => {
  setIsHistoryLoading(true);
  const token = await getAuthToken();
  try {
    const response = await fetch("http://127.0.0.1:8000/api/jobs/", {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (response.ok) {
      const data = await response.json();
      setHistory(data);
    }
  } catch (error) {
    console.error("Error fetching history:", error);
  } finally {
    setIsHistoryLoading(false);
  }
};
  
  if (!isAuthorized) {
    return (<div className="h-screen w-screen bg-zinc-50 flex items-center justify-center">
             <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
           </div>);
  }

  return (
    <div className="flex h-screen bg-zinc-50 font-sans text-zinc-900 selection:bg-blue-100 overflow-hidden">

      {/* ===================== SIDEBAR ===================== */}

      {/* Mobile backdrop overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-zinc-200 flex flex-col shrink-0
        transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:block
      `}>
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
          <h1 className="text-xl font-black tracking-tighter text-blue-600 uppercase hover:opacity-80 transition-opacity cursor-default">
            AutoEDA
          </h1>
          {/* Close button — mobile only */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">

          {/* DESKTOP: Workspace mode (Current Analysis / History) */}
          <div className="hidden lg:block space-y-2">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2 mb-2">Workspace</div>
            <button
              onClick={() => setWorkspaceMode('current')}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all active:scale-[0.98] ${
                workspaceMode === 'current' ? "bg-blue-50 text-blue-700" : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              📊 Current Analysis
            </button>
            <button
              onClick={() => setWorkspaceMode('history')}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all active:scale-[0.98] ${
                workspaceMode === 'history' ? "bg-blue-50 text-blue-700" : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              🕒 History
            </button>
          </div>

          {/* MOBILE: Analysis module tabs */}
          <div className="lg:hidden space-y-1">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2 mb-2">Analysis Modules</div>
            {modules.map((m) => (
              <button
                key={m.id}
                onClick={() => { setActiveTab(m.id); setIsSidebarOpen(false); }}
                className={`w-full flex items-center px-3 py-2.5 text-sm font-bold rounded-xl transition-all active:scale-[0.98] ${
                  activeTab === m.id
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                    : "text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                <span className="mr-3">{m.icon}</span> {m.label}
              </button>
            ))}
          </div>
        </nav>
         <div className="p-4 border-t border-zinc-100 bg-zinc-50/50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-3 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all group"
          >
            <span className="mr-3 text-lg group-hover:scale-110 transition-transform">⏻</span>
             Sign Out
          </button>
          
          <div className="mt-4 px-3 flex items-center gap-3">
             <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
               {/* Just a visual placeholder for the user avatar */}
               👤
             </div>
             <div className="min-w-0 flex-1">
               <p className="text-[10px] font-black text-zinc-800 truncate uppercase tracking-tighter">Active Session</p>
               <p className="text-[9px] text-zinc-400 truncate">AutoEDA v1.0</p>
             </div>
          </div>
        </div>
      </aside>

      {/* ===================== MAIN WORKSPACE ===================== */}
      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">

        {/* HEADER */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-3 md:px-8 py-3 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 shrink-0">

            {/* Hamburger — mobile only, opens sidebar with module tabs */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1.5 text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
              aria-label="Open navigation"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            {/* MOBILE: Current Analysis / History toggle in the header */}
            <div className="flex lg:hidden bg-zinc-100 p-0.5 rounded-lg">
              <button
                onClick={() => setWorkspaceMode('current')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                  workspaceMode === 'current' ? "bg-white text-blue-600 shadow-sm" : "text-zinc-500"
                }`}
              >
                Lab
              </button>
              <button
                onClick={() => setWorkspaceMode('history')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                  workspaceMode === 'history' ? "bg-white text-blue-600 shadow-sm" : "text-zinc-500"
                }`}
              >
                History
              </button>
            </div>

            {/* DESKTOP: Static title */}
            <h2 className="hidden lg:block text-sm font-bold text-zinc-800">Project Workspace</h2>
          </div>

          {/* Upload controls */}
          <div className="flex items-center gap-1.5 md:gap-3 min-w-0">
            <input
              type="file" id="csv-upload" hidden accept=".csv"
              onChange={(e) => {
              const selectedFile = e.target.files[0];
              if (selectedFile) {
               setFile(selectedFile); }
               // CRITICAL FIX: Reset the input value so selecting the same file 
              // again later triggers the onChange event.
                e.target.value = ""; 
                }}
            />
            <label
              htmlFor="csv-upload"
              className="px-2.5 py-1.5 text-[10px] font-bold bg-zinc-100 hover:bg-zinc-200 rounded-md cursor-pointer transition-all active:scale-95 border border-zinc-200 max-w-[90px] sm:max-w-[140px] truncate shrink-0"
            >
              {file ? file.name : "Choose CSV"}
            </label>
            <button
              onClick={handleUpload}
              disabled={ !file || isUploading || (currentJobId && jobStatus !== 'COMPLETED' && jobStatus !== 'FAILED')}
              className="px-3 py-1.5 text-[10px] font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-zinc-300 transition-all active:scale-95 shrink-0"
            >
              {isUploading ? "Uploading..." : "Run Analysis"}
            </button>
            <button
              onClick={startNewAnalysis}
              className="hidden md:block text-[10px] font-bold text-zinc-400 hover:text-blue-600 transition-colors uppercase tracking-widest active:scale-95"
            >
              ↻ New
            </button>
          </div>
        </header>

        {/* ===================== PAGE CONTENT ===================== */}
        <div className="p-4 md:p-8 w-full mx-auto space-y-8">

          {/* WORKSPACE MODE SWITCHER */}
          {workspaceMode === 'current' ? (

            <>
              {/* ZERO STATE */}
              {!currentJobId && (
                <div className="flex flex-col items-center justify-center py-24 md:py-32 text-center border-2 border-dashed border-zinc-200 rounded-3xl bg-white">
                  <div className="h-20 w-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 text-3xl">📁</div>
                  <h3 className="text-2xl font-black text-zinc-800 tracking-tight">Ready for Insights?</h3>
                  <p className="text-zinc-500 mt-2 max-w-sm px-4">
                    Upload a CSV file in the header to trigger the Automated EDA & Machine Learning engine.
                  </p>

                </div>
              )}

              {/* LOADING STATE */}
              {(jobStatus === 'PROCESSING' || jobStatus === 'PENDING') && (
                <div className="animate-pulse bg-blue-600 text-white p-6 md:p-8 rounded-3xl flex justify-between items-center shadow-xl shadow-blue-100">
                  <div>
                    <p className="text-lg font-black tracking-tight">🧠 Analyzing patterns...</p>
                    <p className="text-sm opacity-80 font-medium">Calculating PCA coordinates and semantic executive summaries.</p>
                  </div>
                  <div className="h-10 w-10 border-4 border-blue-400 border-t-white rounded-full animate-spin shrink-0 ml-4"></div>
                </div>
              )}

              {/* COMPLETED DASHBOARD */}
              {jobStatus === 'COMPLETED' && results && (
                <>
                  {/* LAYER 2: KPI RIBBON */}
                  <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <HealthGauge score={results?.metadata?.health_score || 0} />
                    <MetricCard label="Total Rows" value={results?.metadata?.total_rows?.toLocaleString() || "0"} />
                    <MetricCard label="Total Columns" value={results?.metadata?.total_cols || "0"} />
                    <MetricCard
                      label="Anomalies"
                      value={Object.values(results?.outliers || {}).reduce((a, b) => a + b, 0)}
                      color="text-amber-600"
                    />
                    <MetricCard
                      label="Status"
                      value={jobStatus === 'COMPLETED' ? 'Done' : 'Scanning...'}
                      color="text-blue-600"
                    />
                  </section>

                  {/* LAYER 3: MAIN CONTENT TABS */}
                  <section className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden transition-all duration-500 hover:shadow-xl hover:shadow-zinc-200/50 min-h-[600px] flex flex-col">

                    {/* Tab nav — DESKTOP ONLY (lg+). Mobile uses the sidebar. */}
                    <nav className="hidden lg:flex border-b border-zinc-100 bg-zinc-50/50 overflow-x-auto">
                      {modules.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`px-6 xl:px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] transition-all relative border-b-2 whitespace-nowrap ${
                            activeTab === tab.id
                              ? "border-blue-600 text-blue-600 bg-white"
                              : "border-transparent text-zinc-400 hover:text-zinc-600"
                          }`}
                        >
                          {tab.label}
                          {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 animate-in fade-in zoom-in-x" />
                          )}
                        </button>
                      ))}
                    </nav>

                    {/* Mobile: current tab title breadcrumb */}
                    <div className="lg:hidden px-6 pt-5 pb-0">
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                        {modules.find(m => m.id === activeTab)?.icon} {modules.find(m => m.id === activeTab)?.label}
                      </p>
                      <p className="text-[9px] text-zinc-400 font-medium mt-0.5">{results?.metadata?.file_name}</p>
                    </div>

                    <div className="p-4 md:p-10 flex-1">

                      {/* -------- TAB: OVERVIEW -------- */}

                      {activeTab === 'overview' && (
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
    
                      {/* AI EXECUTIVE SUMMARY CARD */}
                     <div className="p-6 md:p-8 bg-zinc-50 border border-zinc-200 rounded-3xl transition-transform hover:scale-[1.005]">
                        <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest">
                        {results?.ml_insights?.ai_observations?.is_fallback ? "System Data Insights" : "AI Executive Summary"}
                      </h3>
                      {results?.ml_insights?.ai_observations?.is_fallback && (
                      <span className="text-[8px] bg-zinc-200 px-2 py-0.5 rounded text-zinc-600 font-bold tracking-tighter">
                      DETERMINISTIC MODE
                        </span>
                       )}
                     </div>

               {/* Dataset Label & AI summary card*/}
              <p className="text-md md:text-xl text-zinc-800 font-medium leading-relaxed italic">
                  Analysis of the{" "}
          <span className="italic font-medium text-zinc-800">
            {getCleanFileName(results?.metadata?.file_name) || "provided dataset"}
            </span>{" "}
             reveals that, {results?.ml_insights?.ai_observations?.summary || "Summary generation in progress..."}
      </p>
    </div>

    {/* DATASET STATS GRID */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="p-6 border border-zinc-100 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
        <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-4 tracking-widest">Dataset Integrity</h4>
           <p className="text-sm text-zinc-600 leading-relaxed">
             The engine has successfully indexed <span className="font-bold text-zinc-800">{results?.metadata?.total_cols}</span> dimensions with a focus on variance-driven feature importance.
           </p>
           </div>
      
            <div className="p-6 bg-purple-50/50 border border-purple-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                  <h4 className="text-[10px] font-bold text-purple-600 uppercase mb-4 tracking-widest">ML Capability</h4>
                     <p className="text-sm text-purple-900 leading-relaxed">
                            Unsupervised <span className="font-bold">PCA</span> has reduced the dataset into 2 primary components for structural visualization and clustering analysis.
                      </p>
                  </div>
               </div>
             </div>
                    )}

                      {/* -------- TAB: DATA AUDIT -------- */}
                      {activeTab === 'audit' && (
                        <div className="animate-in fade-in slide-in-from-left-4 duration-700 space-y-10">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                            {/* Data Type Pie */}
                            <div className="lg:col-span-1 p-6 bg-white border border-zinc-100 rounded-3xl shadow-sm transition-all duration-300 hover:shadow-md">
                              <div className="mb-4">
                                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4">Metadata Profile</h4>
                                <p className="text-xs text-zinc-500">Feature type distribution</p>
                              </div>
                              <div className="h-64 w-full">
                                <PlotlyChart
                                  data={[{
                                    values: results?.ml_insights?.quality_metrics?.dtype_breakdown?.map(d => d.count),
                                    labels: results?.ml_insights?.quality_metrics?.dtype_breakdown?.map(d => d.type),
                                    type: 'pie',
                                    hole: 0.5,
                                    marker: { colors: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'] },
                                    textinfo: 'label+percent',
                                    textposition: 'outside',
                                    
                                    hoverinfo: 'label+value'
                                  }]}
                                  layout={{ autosize: true,margin: { t: 0, b: 0, l: 10, r: 10 },  showlegend: false }}
                                  useResizeHandler={true}
                                  className="w-full h-full"
                                />
                              </div>
                            </div>

                            {/* Missing Value Linkage */}
                            <div className="lg:col-span-2 p-6 bg-white border border-zinc-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Missing Value Linkage</h4>
                                  <p className="text-xs text-zinc-500">Dendrogram logic: Correlation between null values</p>
                                </div>
                                <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">Cluster Analysis</span>
                              </div>
                              <div className="h-64 w-full">
                                {results?.ml_insights?.quality_metrics?.null_correlation?.labels?.length > 0 ? (
                                  <PlotlyChart
                                    data={[{
                                      z: results?.ml_insights?.quality_metrics?.null_correlation?.z,
                                      x: results?.ml_insights?.quality_metrics?.null_correlation?.labels,
                                      y: results?.ml_insights?.quality_metrics?.null_correlation?.labels,
                                      type: 'heatmap',
                                      colorscale: 'Purples',
                                      showscale: true,
                                      zmin: -1, zmax: 1, xgap: 1, ygap: 1,
                                    }]}
                                    layout={{
                                      autosize: true,
                                      margin: { t: 10, r: 10, b: 60, l: 100 },
                                      xaxis: { tickangle: -45, tickfont: { size: 9, color: '#71717a' } },
                                      yaxis: { tickfont: { size: 9, color: '#71717a' } }
                                      
                                    }}
                                    useResizeHandler={true}
                                    className="w-full h-full"
                                  />
                                ) : (
                                  <div className="h-full flex flex-col items-center justify-center bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200">
                                    <span className="text-2xl mb-2">✨</span>
                                    <p className="text-xs text-zinc-400 font-medium">No missing values detected in this dataset.</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                            <h3 className="text-lg font-bold">Data Quality Audit</h3>
                            <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest italic">
                              Click a row to view univariate distribution
                            </p>
                          </div>

                          <div className="overflow-x-auto overflow-hidden border border-zinc-100 rounded-2xl">
                            <table className="w-full text-left text-sm border-collapse min-w-[500px]">
                              <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px] font-bold">
                                <tr>
                                  <th className="px-6 py-4">Column Name</th>
                                  <th className="px-6 py-4">Type</th>
                                  <th className="px-6 py-4">Missing Values</th>
                                  <th className="px-6 py-4">Outliers</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-50">
                                {Object.keys(results?.metadata?.column_types || {}).map((col) => (
                                  <React.Fragment key={col}>
                                    <tr
                                      onClick={() => setExpandedRow(expandedRow === col ? null : col)}
                                      className={`cursor-pointer transition-colors ${expandedRow === col ? 'bg-blue-50/30' : 'hover:bg-zinc-50/50'}`}
                                    >
                                      <td className="px-6 py-4 font-semibold text-zinc-800 flex items-center gap-2">
                                        <span className={`text-[8px] transition-transform ${expandedRow === col ? 'rotate-90' : ''}`}>▶</span>
                                        {col}
                                      </td>
                                      <td className="px-6 py-4 text-zinc-500 font-mono text-xs">{results?.metadata?.column_types[col]}</td>
                                      <td className="px-6 py-4 text-zinc-500">{results?.metadata?.missing_values[col] || 0}</td>
                                      <td className="px-6 py-4 text-zinc-500">{results?.outliers[col] || 0}</td>
                                    </tr>
                                    {expandedRow === col && (
                                      <tr>
                                        <td colSpan="4" className="bg-zinc-50/30 px-6 py-8 animate-in slide-in-from-top-2 duration-300">
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <DistributionChart title="Value Distribution" data={results?.univariate?.[col]?.histogram} />
                                            <div className="flex flex-col justify-center">
                                              <h4 className="text-[9px] font-bold text-zinc-400 uppercase mb-4 tracking-widest">Statistical Spread</h4>
                                              <div className="grid grid-cols-2 gap-4">
                                                <div className="p-3 bg-white rounded-lg border border-zinc-100 shadow-sm">
                                                  <p className="text-[8px] text-zinc-400 uppercase font-bold">Min - Max</p>
                                                  <p className="text-xs font-mono">{results?.univariate?.[col]?.stats?.min ?? 'N/A'} — {results?.univariate?.[col]?.stats?.max ?? 'N/A'}</p>
                                                </div>
                                                <div className="p-3 bg-white rounded-lg border border-zinc-100 shadow-sm">
                                                  <p className="text-[8px] text-zinc-400 uppercase font-bold">Median (Q2)</p>
                                                  <p className="text-xs font-mono">{results?.univariate?.[col]?.stats?.median ?? 'N/A'}</p>
                                                </div>
                                                <div className="p-3 bg-white rounded-lg border border-zinc-100 shadow-sm">
                                                  <p className="text-[8px] text-zinc-400 uppercase font-bold">IQR (Q1 - Q3)</p>
                                                  <p className="text-xs font-mono">{results?.univariate?.[col]?.stats?.q1 ?? 'N/A'} — {results?.univariate?.[col]?.stats?.q3 ?? 'N/A'}</p>
                                                </div>
                                                <div className="p-3 bg-blue-600 rounded-lg text-white shadow-md">
                                                  <p className="text-[8px] opacity-70 uppercase font-bold">AI Insight</p>
                                                  <p className="text-[10px] leading-tight">
                                                    {results?.outliers[col] > 0 ? 'High outlier density detected. Consider capping.' : 'Data distribution appears stable.'}
                                                  </p>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                     {/* -------- TAB: CORRELATIONS -------- */}
{activeTab === 'correlations' && (
  <div className="animate-in fade-in slide-in-from-right-4 duration-700 space-y-10 w-full">
    
    {/* Header & KPI Section */}
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
      <div>
        <h3 className="text-lg font-bold text-zinc-900">Feature Relationships</h3>
        <p className="text-xs text-zinc-500">Analysis of the most influential feature interactions</p>
      </div>
      <span className="self-start sm:self-auto text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded italic border border-blue-100">
        Method: Pearson Correlation
      </span>
    </div>

    {/* Top Level: Heatmap & Strongest Pattern */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      {/* 1. PLOTLY HEATMAP */}
      <div className="p-6 bg-white border border-zinc-100 rounded-3xl shadow-sm">
        <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-6 tracking-widest">Influence Heatmap</h4>
        <div className="h-80 w-full">
          <PlotlyChart 
            data={[{
              z: results?.ml_insights?.influential_correlations?.z,
              x: results?.ml_insights?.influential_correlations?.x,
              y: results?.ml_insights?.influential_correlations?.y,
              type: 'heatmap',
              colorscale: 'RdBu',
              zmin: -1,
              zmax: 1,
              showscale: true,
              xgap: 2,
              ygap: 2
            }]}
            layout={{
              autosize: true,
              margin: { t: 10, r: 10, b: 50, l: 80 },
              xaxis: { tickangle: -45, font: { size: 10 } },
              yaxis: { font: { size: 10 } }
              
            }}
             useResizeHandler={true}
             className="w-full h-full"

          />
        </div>
      </div>

      {/* 2. STRONGEST INTERACTION (Auto-detected) */}
      {(() => {
        const gallery = results?.ml_insights?.bivariate_gallery || [];
        const topPair = gallery.length > 0 
          ? gallery.reduce((prev, curr) => (Math.abs(curr.corr) > Math.abs(prev.corr)) ? curr : prev)
          : null;

        return (
          <div className="p-6 bg-white border border-zinc-100 rounded-3xl shadow-sm transition-all duration-300 hover:shadow-md">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Strongest Interaction</h4>
                {topPair && <p className="text-[10px] text-zinc-500 mt-1 font-medium italic">Highest statistical significance</p>}
              </div>
              {topPair && (
                <span className="text-[9px] font-mono bg-blue-50 px-2 py-0.5 rounded text-blue-600 border border-blue-100 font-bold">
                  r = {topPair.corr.toFixed(2)}
                </span>
              )}
            </div>
            <div className="h-80 w-full">
              {topPair ? (
                <PlotlyChart 
                  data={[
                    {
                      x: topPair.data.map(v => v[topPair.x_name]),
                      y: topPair.data.map(v => v[topPair.y_name]),
                      mode: 'markers',
                      type: 'scatter',
                      marker: { color: '#3b82f6', opacity: 0.5, size: 8, line: { width: 1, color: 'white' } }
                    },
                    {
                      x: topPair.regression.x,
                      y: topPair.regression.y,
                      mode: 'lines',
                      type: 'scatter',
                      line: { color: '#ef4444', width: 2, dash: 'dot' }
                    }
                  ]}
                  layout={{
                    autosize: true,
                    margin: { t: 10, r: 10, b: 40, l: 40 },
                    xaxis: { title: { text: topPair.x_name, font: { size: 10 } }, gridcolor: '#f1f5f9'},
                    yaxis: { title: { text: topPair.y_name, font: { size: 10 } }, gridcolor: '#f1f5f9' },
                    showlegend: false,
                    hovermode: 'closest'
                    
                  }}
                  useResizeHandler={true}
                  className="w-full h-full"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-zinc-400 italic bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200">
                  Calculating patterns...
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>

    {/* 3. BIVARIATE GALLERY (Fixed styling for long names) */}
    <div className="w-full pt-10 border-t border-zinc-100">
      <div className="max-w-full lg:max-w-[95%] mx-auto space-y-8">
        <div className="flex flex-col items-center text-center px-4">
          <h3 className="text-lg font-bold text-zinc-900">Relationship Gallery</h3>
          <p className="text-xs text-zinc-500 max-w-md mt-1">Cross-interaction of influential features</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {results?.ml_insights?.bivariate_gallery?.map((pair, idx) => (
            <div key={idx} className="p-5 bg-white border border-zinc-100 rounded-3xl shadow-sm hover:shadow-lg transition-all flex flex-col">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0 flex-1 flex flex-col">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Correlation</span>
                  <span className="text-xs font-bold text-zinc-800 truncate block" title={`${pair.x_name} vs ${pair.y_name}`}>
                    {pair.x_name} <span className="text-zinc-300 font-normal mx-0.5">×</span> {pair.y_name}
                  </span>
                </div>
                <div className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-mono font-bold whitespace-nowrap self-start ${
                  Math.abs(pair.corr) > 0.5 ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-zinc-50 text-zinc-500 border border-zinc-100'
                }`}>
                  r = {pair.corr.toFixed(2)}
                </div>
              </div>

              <div className="h-56 w-full">
                <PlotlyChart 
                  data={[
                    {
                      x: pair.data.map(v => v[pair.x_name]),
                      y: pair.data.map(v => v[pair.y_name]),
                      mode: 'markers', type: 'scatter',
                      marker: { color: '#3b82f6', opacity: 0.3, size: 5 }
                    },
                    {
                      x: pair.regression.x,
                      y: pair.regression.y,
                      mode: 'lines', type: 'scatter',
                      line: { color: '#ef4444', width: 2, dash: 'dot' }
                    }
                  ]}
                  layout={{
                    autosize: true,
                    margin: { t: 5, r: 5, b: 25, l: 25 },
                    xaxis: { showgrid: false, tickfont: {size: 8}, zeroline: false },
                    yaxis: { showgrid: true, gridcolor: '#f8fafc', tickfont: {size: 8}, zeroline: false },
                    showlegend: false,
                    
                  }}
                  useResizeHandler={true}
                  className="w-full h-full"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)}

                  {activeTab === 'distribution' && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-700 space-y-8">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div>
               <h3 className="text-lg font-bold text-zinc-900">Feature Distributions</h3>
               <p className="text-xs text-zinc-500">Univariate statistical spread and density estimation</p>
                 </div>

      {/* --- NEW DROPDOWN --- */}
      <div className="relative inline-block">
        <select 
          value={distChartType}
          onChange={(e) => setDistChartType(e.target.value)}
          className="appearance-none bg-white border border-zinc-200 text-zinc-700 text-[11px] font-bold py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm hover:border-zinc-300 transition-all"
        >
          <option value="violin">Violin Plot</option>
          <option value="histogram">Histogram</option>
          <option value="box">Box Plot</option>
          <option value="strip">Strip Plot</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
          <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {Object.entries(results?.ml_insights?.distribution_analysis || {}).map(([col, data]) => (
        <div key={col} className="p-6 bg-white border border-zinc-100 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <h4 className="font-bold text-zinc-800 group-hover:text-blue-600 transition-colors">{col}</h4>
            <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-bold uppercase tracking-tighter">
              {distChartType.replace('_', ' ')}
            </span>
          </div>

          <div className="h-72 w-full">
            <PlotlyChart
              data={[
                distChartType === 'violin' ? {
                  type: 'violin',
                  y: data.raw_sample,
                  box: { visible: true },
                  line: { color: '#3b82f6' },
                  fillcolor: 'rgba(59, 130, 246, 0.1)',
                  meanline: { visible: true }
                } : distChartType === 'histogram' ? {
                  type: 'histogram',
                  x: data.raw_sample,
                  marker: { color: '#3b82f6', line: { color: 'white', width: 0.5 } },
                  opacity: 0.7
                } : distChartType === 'box' ? {
                  type: 'box',
                  y: data.raw_sample,
                  marker: { color: '#8b5cf6' },
                  boxpoints: 'outliers'
                } : { // Strip Plot
                  type: 'box',
                  y: data.raw_sample,
                  mode: 'markers',
                  boxpoints: 'all',
                  jitter: 0.5,
                  pointpos: 0,
                  fillcolor: 'rgba(255,255,255,0)',
                  line: { color: 'rgba(255,255,255,0)' },
                  marker: { color: '#3b82f6', size: 4, opacity: 0.4 }
                }
              ]}
              layout={{
                autosize: true,
                margin: { t: 10, b: 30, l: 40, r: 10 },
                yaxis: { zeroline: false, gridcolor: '#f1f5f9' },
                xaxis: { showgrid: false },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
              }}
              useResizeHandler={true}
              className="w-full h-full"
            />
          </div>

                                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-zinc-50">
                                  <div className="text-center">
                                    <p className="text-[8px] text-zinc-400 uppercase font-bold">Min</p>
                                    <p className="text-xs font-mono">{data.stats.min.toFixed(1)}</p>
                                  </div>
                                  <div className="text-center border-x border-zinc-100">
                                    <p className="text-[8px] text-zinc-400 uppercase font-bold">Median</p>
                                    <p className="text-xs font-mono">{data.stats.median.toFixed(1)}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-[8px] text-zinc-400 uppercase font-bold">Max</p>
                                    <p className="text-xs font-mono">{data.stats.max.toFixed(1)}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* -------- TAB: ML INSIGHTS -------- */}
                      {activeTab === 'ml_insights' && (
                        <div className="animate-in fade-in zoom-in-95 duration-700 space-y-8">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="p-6 border border-zinc-100 rounded-3xl">
                              <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-6 tracking-widest">Feature Influence (Unsupervised)</h4>
                              <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart
                                    data={Object.entries(results.ml_insights?.feature_influence || {}).map(([name, value]) => ({ name, value }))}
                                    layout="vertical"
                                  >
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} fontSize={10} tick={{ fill: '#a1a1aa' }} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={15} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                            <div className="p-6 border border-zinc-100 rounded-3xl">
                              <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-6 tracking-widest">Data Structure Mapping (PCA)</h4>
                              <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                  <ScatterChart>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis type="number" dataKey="x" hide />
                                    <YAxis type="number" dataKey="y" hide />
                                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                    <Scatter
                                      data={results.ml_insights?.pca_data?.map(p => ({ x: p[0], y: p[1] }))}
                                      fill="#8b5cf6"
                                      fillOpacity={0.4}
                                    />
                                  </ScatterChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
{/* -------- TAB: RECOMMENDATIONS -------- */}
{activeTab === 'recommendations' && (
  <div className="animate-in fade-in slide-in-from-right-4 duration-700 space-y-8">
    
    {/* TOP ROW: Hypotheses & Cleaning */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. AI HYPOTHESES */}
      <div className="p-8 bg-white border border-purple-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
        <span className="px-2 py-1 bg-purple-50 text-purple-600 text-[10px] font-black rounded uppercase tracking-widest border border-purple-100">
          AI Hypotheses
        </span>
        <ul className="mt-6 space-y-4">
          {results.ml_insights?.ai_observations?.hypotheses?.map((h, i) => (
            <li key={i} className="group flex items-start text-sm text-zinc-700 leading-relaxed italic">
              <span className="mr-3 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
              "{typeof h === 'string' ? h : (h.question || JSON.stringify(h))}"
            </li>
          ))}
        </ul>
      </div>

      {/* 2. CLEANING STRATEGY */}
      <div className="p-8 bg-blue-50 border border-blue-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
        <span className="px-2 py-1 bg-blue-100 text-blue-600 text-[10px] font-black rounded uppercase tracking-widest border border-blue-200">
          Cleaning Strategy
        </span>
        <p className="mt-6 text-blue-900 text-sm leading-relaxed font-medium">
          {typeof results.ml_insights?.ai_observations?.cleaning_tips === 'string' 
            ? results.ml_insights?.ai_observations?.cleaning_tips 
            : "Refer to the data audit for specific cleaning recommendations."}
        </p>
      </div>
    </div>

    {/* 3. NEW: FEATURE SUGGESTION CARD (ENGINEERING) */}
    <div className="p-8 bg-emerald-50 border border-emerald-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <span className="px-2 py-1 bg-emerald-100 text-emerald-600 text-[10px] font-black rounded uppercase tracking-widest border border-emerald-100">
            Feature Engineering
          </span>
          <h3 className="text-sm font-bold text-emerald-900 mt-2">Engineered Feature Suggestions</h3>
        </div>
        
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {results.ml_insights?.ai_observations?.feature_suggestions?.map((s, i) => {
    // DEFENSIVE EXTRACTION: Handle string, {name, description}, or {suggestion}
    const suggestionTitle = typeof s === 'string' 
      ? s 
      : (s.name || s.suggestion || "New Feature");
      
    const suggestionDesc = typeof s === 'object' && s.description 
      ? s.description 
      : "";
        return (
          <div key={i} className="flex flex-col p-5 md:p-6 bg-white border border-emerald-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow group cursor-default overflow-hidden">
            <div className="h-7 w-7 shrink-0 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center mb-3 text-xs font-black group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-sm">
              0{i + 1}
            </div>
            <p className="text-sm text-zinc-800 font-bold leading-snug mb-1.5 group-hover:text-emerald-700 transition-colors break-words">
              {suggestionTitle}
            </p>
             {suggestionDesc && (
          <p className="text-xs text-zinc-500 leading-relaxed italic  break-words mt-auto pt-1">
            {suggestionDesc}
          </p>
             )}
          </div>
        );
       })}
      </div>
    </div>
  </div>
)}

                    </div>
                  </section>
                </>
              )}

              {/* ERROR STATE */}
              {jobError && (
                <div className="p-8 bg-red-50 border border-red-200 rounded-3xl text-red-700 text-center">
                  <p className="font-bold text-lg mb-2">Analysis Failed</p>
                  <p className="text-sm opacity-80">{jobError}</p>
                  <button
                    onClick={() => setCurrentJobId(null)}
                    className="mt-4 text-xs font-black uppercase tracking-widest underline"
                  >
                    Try Another File
                  </button>
                </div>
              )}
            </>

          ) : (
            /* HISTORY MODE */
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

    {isHistoryLoading ? (
      <div className="py-20 text-center">
        <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-zinc-400 text-xs mt-4 font-medium uppercase tracking-widest">Loading your records...</p>
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
              <tr key={job.id} className="hover:bg-zinc-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📄</span>
                    <span className="font-bold text-zinc-800">{job.file_name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tighter ${
                    job.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' :
                    job.status === 'FAILED' ? 'bg-red-50 text-red-600' :
                    'bg-blue-50 text-blue-600 animate-pulse'
                  }`}>
                    {job.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-zinc-400 font-medium text-xs">
                  {new Date(job.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => {
                      setCurrentJobId(job.id);
                      setWorkspaceMode('current');
                    }}
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
        <div className="h-16 w-16 bg-zinc-100 text-zinc-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">📭</div>
        <h3 className="text-lg font-bold text-zinc-800">No History Found</h3>
        <p className="text-zinc-500 text-xs mt-1">Upload your first CSV to see it listed here.</p>
      </div>
    )}
  </div>
          )}

        </div>
      </main>
    </div>
  );
}

// ===================== REUSABLE COMPONENTS =====================

function MetricCard({ label, value, color = "text-zinc-900" }) {
  return (
    <div className="bg-white p-3 lg:p-4 border border-zinc-200 rounded-2xl shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:border-blue-100 group cursor-default overflow-hidden">
      <p className="text-[9px] lg:text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 group-hover:text-blue-500 transition-colors truncate">{label}</p>
      <p className={`text-lg lg:text-xl xl:text-2xl font-black tracking-tight truncate ${color}`}>{value}</p>
    </div>
  );
}

function HealthGauge({ score }) {
  const getColor = (s) => {
    if (s >= 90) return "#10b981";
    if (s >= 70) return "#f59e0b";
    return "#ef4444";
  };
  const color = getColor(score);
  const strokeDasharray = `${score}, 100`;

  return (
    <div className="bg-white p-3 lg:p-4 border border-zinc-200 rounded-2xl shadow-sm transition-all duration-300 hover:scale-[1.02] flex items-center gap-2 lg:gap-3 group col-span-2 sm:col-span-1 overflow-hidden">
      <div className="relative h-12 w-12 lg:h-14 lg:w-14 shrink-0">
        <svg viewBox="0 0 36 36" className="h-full w-full transform -rotate-90">
          <circle cx="18" cy="18" r="16" fill="none" className="stroke-zinc-100" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="16" fill="none"
            stroke={color} strokeWidth="3"
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[9px] font-black" style={{ color }}>{Math.round(score)}%</span>
        </div>
      </div>
  <div className="min-w-0">
    <p className="text-[9px] lg:text-[10px] font-bold text-zinc-400 uppercase tracking-widest group-hover:text-blue-400 transition-colors truncate">AI Health Score</p>
      <p className="text-xs font-bold text-zinc-700 truncate">
          {score >= 90 ? "Excellent" : score >= 70 ? "Needs Review" : "Critical"}
        </p>
      </div>
    </div>
  );
}

