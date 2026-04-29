import React from "react";
import { modules } from "../../constants/analysis";
import DistributionChart from "../charts/DistributionChart";
import PlotlyChart from "../charts/PlotlyChart";
import { getCleanFileName } from "../../utils/analysisHelpers";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  CartesianGrid,
} from "recharts";

/**
 * AnalysisTabs Component
 * Handles the tab navigation UI and the rendering logic for each analysis module.
 */
export default function AnalysisTabs({ results, activeTab, setActiveTab }) {
  const activeModule = useMemo(
    () => modules.find((m) => m.id === activeTab),
    [activeTab],
  );

  return (
    <section className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden transition-all duration-500 hover:shadow-xl hover:shadow-zinc-200/50 flex flex-col min-h-[600px]">
      {/* Tab Navigation - Desktop */}
      <nav className="hidden lg:flex border-b border-zinc-100 bg-zinc-50/50 overflow-x-auto">
        {modules.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-8 py-5 text-[10px] font-black uppercase tracking-[0.15em] transition-all relative border-b-2 whitespace-nowrap ${
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

      {/* Tab Header - Mobile breadcrumb */}
      <div className="lg:hidden px-6 pt-5 pb-0">
        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
          {activeModule?.icon} {activeModule?.label}
        </p>
        <p className="text-[9px] text-zinc-400 font-medium mt-0.5">
          {results?.metadata?.file_name}
        </p>
      </div>

      <div className="p-4 md:p-10 flex-1">
        {/* Module: Overview */}
        {activeTab === "overview" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
            <div className="p-6 md:p-8 bg-zinc-50 border border-zinc-200 rounded-3xl">
              <h3 className="text-xs font-black text-blue-600 uppercase mb-6 tracking-widest">
                {results?.ml_insights?.ai_observations?.is_fallback
                  ? "System Data Insights"
                  : "AI Executive Summary"}
              </h3>
              <p className="text-md md:text-xl text-zinc-800 font-medium leading-relaxed italic">
                Analysis of the{" "}
                <span className="font-bold">
                  {getCleanFileName(results?.metadata?.file_name)}
                </span>{" "}
                reveals that,{" "}
                {results?.ml_insights?.ai_observations?.summary ||
                  "Summary generation in progress..."}
              </p>
            </div>
            {/* Additional Overview stats can go here */}
          </div>
        )}

        {/* Module: ML Insights (PCA & Feature Influence) */}
        {activeTab === "ml_insights" && (
          <div className="animate-in fade-in zoom-in-95 duration-700 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="p-6 border border-zinc-100 rounded-3xl">
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-6 tracking-widest">
                  Feature Influence
                </h4>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={Object.entries(
                        results?.ml_insights?.feature_influence || {},
                      ).map(([name, value]) => ({ name, value }))}
                      layout="vertical"
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={100}
                        fontSize={10}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        fill="#3b82f6"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="p-6 border border-zinc-100 rounded-3xl">
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-6 tracking-widest">
                  Data Structure Mapping (PCA)
                </h4>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis type="number" dataKey="x" hide />
                      <YAxis type="number" dataKey="y" hide />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                      <Scatter
                        data={results.ml_insights?.pca_data?.map((p) => ({
                          x: p[0],
                          y: p[1],
                        }))}
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

        {/* Note: You can continue adding the other tab logic blocks here (audit, distribution, etc.) 
            using the same pattern as your original page.js */}
      </div>
    </section>
  );
}
