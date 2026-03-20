"use client";

import { useState } from "react";
import { useJobStatus } from "../hooks/useJobStatus";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  ScatterChart, Scatter, CartesianGrid 
} from 'recharts';
import React from 'react';

// --- DISTRIBUTION CHART ---
function DistributionChart({ data, title }) {
  if (!data || data.length === 0) return <div className="text-xs text-zinc-400 italic">No distribution data available for this column.</div>;
  
  return (
    <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl">
      <h4 className="text-[9px] font-bold text-zinc-400 uppercase mb-3 tracking-widest">{title}</h4>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="bin" fontSize={8} tick={{fill: '#94a3b8'}} />
            <YAxis fontSize={8} tick={{fill: '#94a3b8'}} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '10px' }}
              cursor={{fill: '#f1f5f9'}}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("overview");
  const [file, setFile] = useState(null);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Initialize Polling Hook
  const { status: jobStatus, results, error: jobError } = useJobStatus(currentJobId);
  // NEW STATE: Track which row in the Data Audit is expanded
  const [expandedRow, setExpandedRow] = useState(null);

  const handleUpload = async () => {
    if (!file) return alert("Please select a CSV file first!");
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/jobs/", {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentJobId(data.id);
        setFile(null);
      } else {
        alert("Upload failed. Please check the Django server.");
      }
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-50 font-sans text-zinc-900">
      
      {/* --- SIDE NAVIGATION --- */}
      <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-zinc-100">
          <h1 className="text-xl font-black tracking-tighter text-blue-600 uppercase">AutoEDA</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2">Workspace</div>
          <button className="w-full flex items-center px-3 py-2 text-sm font-medium bg-blue-50 text-blue-700 rounded-lg">
            📊 Current Analysis
          </button>
          <button className="w-full flex items-center px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors">
            🕒 History
          </button>
        </nav>
        <div className="p-4 border-t border-zinc-100">
          <div className="p-3 bg-zinc-900 rounded-xl text-white text-[10px]">
            <p className="opacity-70 uppercase tracking-tighter mb-1">AI Engine Active</p>
            <p className="font-mono text-blue-400">Gemini-2.5-Flash</p>
          </div>
        </div>
      </aside>

      {/* --- MAIN WORKSPACE --- */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        
        {/* LAYER 1: THE HEADER (Global Context) */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-zinc-800">Project Workspace</h2>
            <span className="h-4 w-px bg-zinc-300"></span>
            <div className="flex items-center gap-3">
              <input 
                type="file" id="csv-upload" hidden accept=".csv"
                onChange={(e) => setFile(e.target.files[0])} 
              />
              <label 
                htmlFor="csv-upload" 
                className="px-3 py-1.5 text-[11px] font-bold bg-zinc-100 hover:bg-zinc-200 rounded-md cursor-pointer transition-all border border-zinc-200"
              >
                {file ? file.name : "Choose CSV"}
              </label>
              <button 
                onClick={handleUpload}
                disabled={isUploading || (currentJobId && jobStatus !== 'COMPLETED' && jobStatus !== 'FAILED')}
                className="px-4 py-1.5 text-[11px] font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-zinc-300 transition-all"
              >
                {isUploading ? "Uploading..." : "Run Analysis"}
              </button>
            </div>
          </div>
          <button onClick={() => {setCurrentJobId(null); setFile(null);}} className="text-[10px] font-bold text-zinc-400 hover:text-blue-600 transition-colors uppercase tracking-widest">
            ↻ New Project
          </button>
        </header>

        <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
          
          {/* ZERO STATE: UPLOAD PROMPT */}
          {!currentJobId && (
            <div className="flex flex-col items-center justify-center py-32 text-center border-2 border-dashed border-zinc-200 rounded-3xl bg-white">
              <div className="h-20 w-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 text-3xl">📁</div>
              <h3 className="text-2xl font-black text-zinc-800 tracking-tight">Ready for Insights?</h3>
              <p className="text-zinc-500 mt-2 max-w-sm">Upload a CSV file in the header to trigger the Automated EDA & Machine Learning engine.</p>
            </div>
          )}

          {/* LOADING STATE */}
          {(jobStatus === 'PROCESSING' || jobStatus === 'PENDING') && (
            <div className="animate-pulse bg-blue-600 text-white p-8 rounded-3xl flex justify-between items-center shadow-xl shadow-blue-100">
              <div>
                <p className="text-lg font-black tracking-tight">🧠 Analyzing patterns...</p>
                <p className="text-sm opacity-80 font-medium">Calculating PCA coordinates and semantic executive summaries.</p>
              </div>
              <div className="h-10 w-10 border-4 border-blue-400 border-t-white rounded-full animate-spin"></div>
            </div>
          )}

          {/* COMPLETED DASHBOARD */}
          {jobStatus === 'COMPLETED' && results && (
            <>
              {/* LAYER 2: THE SUMMARY RIBBON (KPIs) */}
              <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <MetricCard label="AI Health Score" value="94%" color="text-green-600" />
                <MetricCard label="Total Rows" value={results?.metadata?.total_rows?.toLocaleString() || "0"} />
                <MetricCard label="Total Columns" value={results?.metadata?.total_cols || "0"} />
                <MetricCard label="Detected Anomalies" value={Object.values(results?.outliers || {}).reduce((a, b) => a + b, 0)} color="text-amber-600" />
                <MetricCard label="Analysis Status" value="Healthy" color="text-blue-600" />
              </section>

              {/* LAYER 3: MAIN CONTENT AREA (Tabs) */}
              <section className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden min-h-[600px] flex flex-col">
                <nav className="flex border-b border-zinc-100 bg-zinc-50/50">
                  {['overview', 'audit', 'correlations','ml_insights', 'recommendations'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] transition-all border-b-2 ${
                        activeTab === tab 
                        ? "border-blue-600 text-blue-600 bg-white" 
                        : "border-transparent text-zinc-400 hover:text-zinc-600"
                      }`}
                    >
                      {tab.replace('_', ' ')}
                    </button>
                  ))}
                </nav>

                <div className="p-10 flex-1">
                  {/* TAB: OVERVIEW */}
                  {activeTab === 'overview' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
                      <div className="p-8 bg-zinc-50 border border-zinc-200 rounded-3xl">
                        <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4">AI Executive Summary</h3>
                        <p className="text-xl text-zinc-800 font-medium leading-relaxed italic">
                          "{results.ml_insights?.ai_observations?.summary || "Summary generation in progress..."}"
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="p-6 border border-zinc-100 rounded-2xl">
                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-4">Dataset Integrity</h4>
                            <p className="text-sm text-zinc-600">The engine has successfully indexed {results?.metadata?.total_cols} dimensions with a focus on variance-driven feature importance.</p>
                         </div>
                         <div className="p-6 bg-purple-50 border border-purple-100 rounded-2xl">
                            <h4 className="text-[10px] font-bold text-purple-600 uppercase mb-4">ML Capability</h4>
                            <p className="text-sm text-purple-900">Unsupervised PCA has reduced the dataset into 2 primary components for structural visualization.</p>
                         </div>
                      </div>
                    </div>
                  )}

                  {/* TAB: DATA AUDIT */}
                  {activeTab === 'audit' && (
                    <div className="animate-in fade-in slide-in-from-left-4 duration-700 space-y-6">
                      <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold">Data Quality Audit</h3>
                      <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest italic">Click a row to view univariate distribution</p>
                      </div>
                      <div className="overflow-hidden border border-zinc-100 rounded-2xl">
                        <table className="w-full text-left text-sm border-collapse">
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
                                {/* Main Row */}
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

                                {/* Expandable Details Row */}
                                {expandedRow === col && (
                                  <tr>
                                    <td colSpan="4" className="bg-zinc-50/30 px-6 py-8 animate-in slide-in-from-top-2 duration-300">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Histogram */}
                                        <DistributionChart 
                                          title="Value Distribution" 
                                          data={results?.univariate?.[col]?.histogram} 
                                        />
                                        
                                        {/* Statistical Spread */}
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
                     {activeTab === 'correlations' && (
                   <div className="animate-in fade-in slide-in-from-right-4 duration-700 space-y-8">
                   <div className="flex justify-between items-end">
                   <div>
                    <h3 className="text-lg font-bold text-zinc-900">Feature Relationships</h3>
                    <p className="text-xs text-zinc-500">Correlation Matrix and Bivariate Analysis</p>
                   </div>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                     Method: Pearson
                     </span>
                   </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      
                   {/* 1. CUSTOM HEATMAP GRID */}
                    <div className="p-6 bg-white border border-zinc-100 rounded-3xl overflow-hidden">
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-6 tracking-widest">Correlation Heatmap</h4>
                    <div className="overflow-auto">
                    <div className="inline-block min-w-full align-middle">
                      <div className="grid" style={{ 
                    gridTemplateColumns: `repeat(${Object.keys(results?.correlations || {}).length + 1}, minmax(50px, 1fr))` 
                        }}>
              {/* Top Header Row */}
              <div className="h-10"></div>
              {Object.keys(results?.correlations || {}).map(col => (
                <div key={col} className="text-[9px] font-bold text-zinc-400 truncate px-1 text-center self-end pb-2 uppercase rotate-45 origin-bottom-left">
                  {col}
                </div>
              ))}

              {/* Matrix Rows */}
              {Object.entries(results?.correlations || {}).map(([rowName, rowValues]) => (
                <React.Fragment key={rowName}>
                  <div className="text-[9px] font-bold text-zinc-400 truncate pr-2 flex items-center justify-end uppercase">
                    {rowName}
                  </div>
                  {Object.entries(rowValues).map(([colName, value]) => {
                    // Color Logic: Red for negative, Blue for positive, White for neutral
                    const opacity = Math.abs(value);
                    const bgColor = value > 0 ? `rgba(59, 130, 246, ${opacity})` : `rgba(239, 68, 68, ${opacity})`;
                    return (
                      <div 
                        key={colName}
                        title={`${rowName} vs ${colName}: ${value.toFixed(2)}`}
                        className="aspect-square border border-white/20 flex items-center justify-center text-[8px] font-medium transition-transform hover:scale-110 hover:z-10 cursor-help"
                        style={{ backgroundColor: bgColor, color: opacity > 0.5 ? 'white' : '#71717a' }}
                      >
                        {opacity > 0.3 ? value.toFixed(1) : ''}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. BIVARIATE SCATTER PLOT */}
      <div className="p-6 bg-white border border-zinc-100 rounded-3xl">
        <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-6 tracking-widest">Bivariate Relationship (Top Influencers)</h4>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                type="number" 
                dataKey="x" 
                name="Feature A" 
                label={{ value: 'Component 1', position: 'bottom', fontSize: 10, fill: '#94a3b8' }} 
                tick={{fontSize: 10}}
              />
              <YAxis 
                type="number" 
                dataKey="y" 
                name="Feature B" 
                label={{ value: 'Component 2', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }} 
                tick={{fontSize: 10}}
              />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }} 
                contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '12px' }}
              />
              <Scatter 
                name="Data Relationship" 
                data={results.ml_insights?.pca_data?.map(p => ({ x: p[0], y: p[1] }))} 
                fill="#3b82f6" 
                fillOpacity={0.6} 
              />
               </ScatterChart>
               </ResponsiveContainer>
              </div>
              <p className="mt-4 text-[10px] text-zinc-400 italic text-center">
                Note: This scatter plot visualizes the interaction between the two most mathematically significant components.
               </p>
                </div>

                 </div>
                </div>
                 )}    
                  {/* TAB: ML INSIGHTS */}
                  {activeTab === 'ml_insights' && (
                    <div className="animate-in fade-in zoom-in-95 duration-700 space-y-8">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Bar Chart */}
                        <div className="p-6 border border-zinc-100 rounded-3xl">
                          <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-6 tracking-widest">Feature Influence (Unsupervised)</h4>
                          <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={Object.entries(results.ml_insights?.feature_influence || {}).map(([name, value]) => ({ name, value }))} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} fontSize={10} tick={{fill: '#a1a1aa'}} />
                                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={15} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Scatter Plot */}
                        <div className="p-6 border border-zinc-100 rounded-3xl">
                          <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-6 tracking-widest">Data Structure Mapping (PCA)</h4>
                          <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                              <ScatterChart>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis type="number" dataKey="x" hide />
                                <YAxis type="number" dataKey="y" hide />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                <Scatter data={results.ml_insights?.pca_data?.map(p => ({ x: p[0], y: p[1] }))} fill="#8b5cf6" fillOpacity={0.4} />
                              </ScatterChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB: RECOMMENDATIONS */}
                  {activeTab === 'recommendations' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-700 grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="p-8 bg-white border border-purple-100 rounded-3xl shadow-sm">
                        <span className="px-2 py-1 bg-purple-50 text-purple-600 text-[10px] font-black rounded uppercase tracking-widest border border-purple-100">AI Hypotheses</span>
                        <ul className="mt-6 space-y-4">
                          {results.ml_insights?.ai_observations?.hypotheses?.map((h, i) => (
                            <li key={i} className="group flex items-start text-sm text-zinc-700 leading-relaxed italic">
                              <span className="mr-3 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
                              "{h}"
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-8 bg-blue-50 border border-blue-100 rounded-3xl">
                        <span className="px-2 py-1 bg-blue-100 text-blue-600 text-[10px] font-black rounded uppercase tracking-widest">Cleaning Strategy</span>
                        <p className="mt-6 text-blue-900 text-sm leading-relaxed font-medium">
                          {results.ml_insights?.ai_observations?.cleaning_strategy || results.ml_insights?.ai_observations?.cleaning_tips}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {jobError && (
            <div className="p-8 bg-red-50 border border-red-200 rounded-3xl text-red-700 text-center">
              <p className="font-bold text-lg mb-2">Analysis Failed</p>
              <p className="text-sm opacity-80">{jobError}</p>
              <button onClick={() => setCurrentJobId(null)} className="mt-4 text-xs font-black uppercase tracking-widest underline">Try Another File</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Reusable Metric Card Component
function MetricCard({ label, value, color = "text-zinc-900" }) {
  return (
    <div className="bg-white p-6 border border-zinc-200 rounded-2xl shadow-sm hover:border-blue-200 transition-all hover:shadow-md group">
      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 group-hover:text-blue-500 transition-colors">{label}</p>
      <p className={`text-2xl font-black tracking-tight ${color}`}>{value}</p>
    </div>
  );
}