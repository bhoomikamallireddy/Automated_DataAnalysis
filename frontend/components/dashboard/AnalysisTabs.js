import { Fragment, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { DISTRIBUTION_CHART_OPTIONS, modules } from "../../constants/analysis";
import {
  getCleanFileName,
  getCleaningTipsText,
  getDistributionPlotConfig,
  getFeatureSuggestionDetails,
} from "../../utils/analysisHelpers";
import DistributionChart from "../charts/DistributionChart";
import PlotlyChart from "../charts/PlotlyChart";
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

export default function AnalysisTabs({ results, activeTab, setActiveTab }) {
  const [expandedRow, setExpandedRow] = useState(null);
  const [distChartType, setDistChartType] = useState("violin");
  const activeModule = useMemo(
    () => modules.find((module) => module.id === activeTab),
    [activeTab],
  );

  const toggleExpandedRow = (columnName) => {
    setExpandedRow((currentRow) =>
      currentRow === columnName ? null : columnName,
    );
  };

  const handleDataQualityRowKeyDown = (event, columnName) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleExpandedRow(columnName);
    }
  };

  return (
    <section className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden transition-all duration-500 hover:shadow-xl hover:shadow-zinc-200/50 flex flex-col min-h-[600px]">
      <nav className="hidden lg:flex border-b border-zinc-100 bg-zinc-50/50 overflow-x-auto">
        {modules.map((tab) => (
          <button
            type="button"
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

      <div className="lg:hidden px-6 pt-5 pb-0">
        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
          {activeModule?.icon} {activeModule?.label}
        </p>
        <p className="text-[9px] text-zinc-400 font-medium mt-0.5">
          {results?.metadata?.file_name}
        </p>
      </div>

      <div className="p-4 md:p-10 flex-1">
        {activeTab === "overview" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
            <div className="p-6 md:p-8 bg-zinc-50 border border-zinc-200 rounded-3xl transition-transform hover:scale-[1.005]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black text-blue-600 uppercase mb-6 tracking-widest">
                  {results?.ml_insights?.ai_observations?.is_fallback
                    ? "System Data Insights"
                    : "AI Executive Summary"}
                </h3>
                {results?.ml_insights?.ai_observations?.is_fallback && (
                  <span className="text-[8px] bg-zinc-200 px-2 py-0.5 rounded text-zinc-600 font-bold tracking-tighter">
                    DETERMINISTIC MODE
                  </span>
                )}
              </div>

              <p className="text-md md:text-xl text-zinc-800 font-medium leading-relaxed italic">
                Analysis of the{" "}
                <span className="italic font-medium text-zinc-800">
                  {getCleanFileName(results?.metadata?.file_name) ||
                    "provided dataset"}
                </span>{" "}
                reveals that,{" "}
                {results?.ml_insights?.ai_observations?.summary ||
                  "Summary generation in progress..."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 border border-zinc-100 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-4 tracking-widest">
                  Dataset Integrity
                </h4>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  The engine has successfully indexed{" "}
                  <span className="font-bold text-zinc-800">
                    {results?.metadata?.total_cols}
                  </span>{" "}
                  dimensions with a focus on variance-driven feature importance.
                </p>
              </div>

              <div className="p-6 bg-purple-50/50 border border-purple-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <h4 className="text-[10px] font-bold text-purple-600 uppercase mb-4 tracking-widest">
                  ML Capability
                </h4>
                <p className="text-sm text-purple-900 leading-relaxed">
                  Unsupervised <span className="font-bold">PCA</span> has
                  reduced the dataset into 2 primary components for structural
                  visualization and clustering analysis.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "audit" && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-700 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 p-6 bg-white border border-zinc-100 rounded-3xl shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="mb-4">
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4">
                    Metadata Profile
                  </h4>
                  <p className="text-xs text-zinc-500">
                    Feature type distribution
                  </p>
                </div>
                <div className="h-64 w-full">
                  <PlotlyChart
                    data={[
                      {
                        values:
                          results?.ml_insights?.quality_metrics?.dtype_breakdown?.map(
                            (d) => d.count,
                          ),
                        labels:
                          results?.ml_insights?.quality_metrics?.dtype_breakdown?.map(
                            (d) => d.type,
                          ),
                        type: "pie",
                        hole: 0.5,
                        marker: {
                          colors: ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"],
                        },
                        textinfo: "label+percent",
                        textposition: "outside",
                        hoverinfo: "label+value",
                      },
                    ]}
                    layout={{
                      autosize: true,
                      margin: { t: 0, b: 0, l: 10, r: 10 },
                      showlegend: false,
                    }}
                  />
                </div>
              </div>

              <div className="lg:col-span-2 p-6 bg-white border border-zinc-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      Missing Value Linkage
                    </h4>
                    <p className="text-xs text-zinc-500">
                      Dendrogram logic: Correlation between null values
                    </p>
                  </div>
                  <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">
                    Cluster Analysis
                  </span>
                </div>
                <div className="h-64 w-full">
                  {results?.ml_insights?.quality_metrics?.null_correlation
                    ?.labels?.length > 0 ? (
                    <PlotlyChart
                      data={[
                        {
                          z: results?.ml_insights?.quality_metrics
                            ?.null_correlation?.z,
                          x: results?.ml_insights?.quality_metrics
                            ?.null_correlation?.labels,
                          y: results?.ml_insights?.quality_metrics
                            ?.null_correlation?.labels,
                          type: "heatmap",
                          colorscale: "Purples",
                          showscale: true,
                          zmin: -1,
                          zmax: 1,
                          xgap: 1,
                          ygap: 1,
                        },
                      ]}
                      layout={{
                        autosize: true,
                        margin: { t: 10, r: 10, b: 60, l: 100 },
                        xaxis: {
                          tickangle: -45,
                          tickfont: { size: 9, color: "#71717a" },
                        },
                        yaxis: { tickfont: { size: 9, color: "#71717a" } },
                      }}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200">
                      <span className="text-2xl mb-2">🔍</span>
                      <p className="text-xs text-zinc-400 font-medium">
                        No missing values detected in this dataset.
                      </p>
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
                  {Object.keys(results?.metadata?.column_types || {}).map(
                    (col) => (
                      <Fragment key={col}>
                        <tr
                          onClick={() => toggleExpandedRow(col)}
                          onKeyDown={(event) =>
                            handleDataQualityRowKeyDown(event, col)
                          }
                          role="row"
                          tabIndex={0}
                          className={`cursor-pointer transition-colors ${
                            expandedRow === col
                              ? "bg-blue-50/30"
                              : "hover:bg-zinc-50/50"
                          }`}
                          aria-expanded={expandedRow === col}
                        >
                          <td className="px-6 py-4 font-semibold text-zinc-800 flex items-center gap-2">
                            <span
                              className={`text-[8px] transition-transform ${
                                expandedRow === col ? "rotate-90" : ""
                              }`}
                            >
                              &gt;
                            </span>
                            {col}
                          </td>
                          <td className="px-6 py-4 text-zinc-500 font-mono text-xs">
                            {results?.metadata?.column_types[col]}
                          </td>
                          <td className="px-6 py-4 text-zinc-500">
                            {results?.metadata?.missing_values[col] || 0}
                          </td>
                          <td className="px-6 py-4 text-zinc-500">
                            {results?.outliers[col] || 0}
                          </td>
                        </tr>
                        {expandedRow === col && (
                          <tr>
                            <td
                              colSpan="4"
                              className="bg-zinc-50/30 px-6 py-8 animate-in slide-in-from-top-2 duration-300"
                            >
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <DistributionChart
                                  title="Value Distribution"
                                  data={results?.univariate?.[col]?.histogram}
                                />
                                <div className="flex flex-col justify-center">
                                  <h4 className="text-[9px] font-bold text-zinc-400 uppercase mb-4 tracking-widest">
                                    Statistical Spread
                                  </h4>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-white rounded-lg border border-zinc-100 shadow-sm">
                                      <p className="text-[8px] text-zinc-400 uppercase font-bold">
                                        Min - Max
                                      </p>
                                      <p className="text-xs font-mono">
                                        {results?.univariate?.[col]?.stats
                                          ?.min ?? "N/A"}{" "}
                                        -{" "}
                                        {results?.univariate?.[col]?.stats
                                          ?.max ?? "N/A"}
                                      </p>
                                    </div>
                                    <div className="p-3 bg-white rounded-lg border border-zinc-100 shadow-sm">
                                      <p className="text-[8px] text-zinc-400 uppercase font-bold">
                                        Median (Q2)
                                      </p>
                                      <p className="text-xs font-mono">
                                        {results?.univariate?.[col]?.stats
                                          ?.median ?? "N/A"}
                                      </p>
                                    </div>
                                    <div className="p-3 bg-white rounded-lg border border-zinc-100 shadow-sm">
                                      <p className="text-[8px] text-zinc-400 uppercase font-bold">
                                        IQR (Q1 - Q3)
                                      </p>
                                      <p className="text-xs font-mono">
                                        {results?.univariate?.[col]?.stats
                                          ?.q1 ?? "N/A"}{" "}
                                        -{" "}
                                        {results?.univariate?.[col]?.stats
                                          ?.q3 ?? "N/A"}
                                      </p>
                                    </div>
                                    <div className="p-3 bg-blue-600 rounded-lg text-white shadow-md">
                                      <p className="text-[8px] opacity-70 uppercase font-bold">
                                        AI Insight
                                      </p>
                                      <p className="text-[10px] leading-tight">
                                        {results?.outliers[col] > 0
                                          ? "High outlier density detected. Consider capping."
                                          : "Data distribution appears stable."}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "correlations" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-700 space-y-10 w-full">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">
                  Feature Relationships
                </h3>
                <p className="text-xs text-zinc-500">
                  Analysis of the most influential feature interactions
                </p>
              </div>
              <span className="self-start sm:self-auto text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded italic border border-blue-100">
                Method: Pearson Correlation
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="p-6 bg-white border border-zinc-100 rounded-3xl shadow-sm">
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-6 tracking-widest">
                  Influence Heatmap
                </h4>
                <div className="h-80 w-full">
                  <PlotlyChart
                    data={[
                      {
                        z: results?.ml_insights?.influential_correlations?.z,
                        x: results?.ml_insights?.influential_correlations?.x,
                        y: results?.ml_insights?.influential_correlations?.y,
                        type: "heatmap",
                        colorscale: "RdBu",
                        zmin: -1,
                        zmax: 1,
                        showscale: true,
                        xgap: 2,
                        ygap: 2,
                      },
                    ]}
                    layout={{
                      autosize: true,
                      margin: { t: 10, r: 10, b: 50, l: 80 },
                      xaxis: { tickangle: -45, font: { size: 10 } },
                      yaxis: { font: { size: 10 } },
                    }}
                  />
                </div>
              </div>

              {(() => {
                const gallery = results?.ml_insights?.bivariate_gallery || [];
                const topPair =
                  gallery.length > 0
                    ? gallery.reduce((prev, curr) =>
                        Math.abs(curr.corr) > Math.abs(prev.corr) ? curr : prev,
                      )
                    : null;

                return (
                  <div className="p-6 bg-white border border-zinc-100 rounded-3xl shadow-sm transition-all duration-300 hover:shadow-md">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                          Strongest Interaction
                        </h4>
                        {topPair && (
                          <p className="text-[10px] text-zinc-500 mt-1 font-medium italic">
                            Highest statistical significance
                          </p>
                        )}
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
                              x: topPair.data.map((v) => v[topPair.x_name]),
                              y: topPair.data.map((v) => v[topPair.y_name]),
                              mode: "markers",
                              type: "scatter",
                              marker: {
                                color: "#3b82f6",
                                opacity: 0.5,
                                size: 8,
                                line: { width: 1, color: "white" },
                              },
                            },
                            {
                              x: topPair.regression.x,
                              y: topPair.regression.y,
                              mode: "lines",
                              type: "scatter",
                              line: { color: "#ef4444", width: 2, dash: "dot" },
                            },
                          ]}
                          layout={{
                            autosize: true,
                            margin: { t: 10, r: 10, b: 40, l: 40 },
                            xaxis: {
                              title: {
                                text: topPair.x_name,
                                font: { size: 10 },
                              },
                              gridcolor: "#f1f5f9",
                            },
                            yaxis: {
                              title: {
                                text: topPair.y_name,
                                font: { size: 10 },
                              },
                              gridcolor: "#f1f5f9",
                            },
                            showlegend: false,
                            hovermode: "closest",
                          }}
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

            <div className="w-full pt-10 border-t border-zinc-100">
              <div className="max-w-full lg:max-w-[95%] mx-auto space-y-8">
                <div className="flex flex-col items-center text-center px-4">
                  <h3 className="text-lg font-bold text-zinc-900">
                    Relationship Gallery
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-md mt-1">
                    Cross-interaction of influential features
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {results?.ml_insights?.bivariate_gallery?.map((pair) => (
                    <div
                      key={`${pair.x_name}-${pair.y_name}`}
                      className="p-5 bg-white border border-zinc-100 rounded-3xl shadow-sm hover:shadow-lg transition-all flex flex-col"
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="min-w-0 flex-1 flex flex-col">
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                            Correlation
                          </span>
                          <span
                            className="text-xs font-bold text-zinc-800 truncate block"
                            title={`${pair.x_name} vs ${pair.y_name}`}
                          >
                            {pair.x_name}{" "}
                            <span className="text-zinc-300 font-normal mx-0.5">
                              x
                            </span>{" "}
                            {pair.y_name}
                          </span>
                        </div>
                        <div
                          className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-mono font-bold whitespace-nowrap self-start ${
                            Math.abs(pair.corr) > 0.5
                              ? "bg-green-50 text-green-600 border border-green-100"
                              : "bg-zinc-50 text-zinc-500 border border-zinc-100"
                          }`}
                        >
                          r = {pair.corr.toFixed(2)}
                        </div>
                      </div>

                      <div className="h-56 w-full">
                        <PlotlyChart
                          data={[
                            {
                              x: pair.data.map((v) => v[pair.x_name]),
                              y: pair.data.map((v) => v[pair.y_name]),
                              mode: "markers",
                              type: "scatter",
                              marker: {
                                color: "#3b82f6",
                                opacity: 0.3,
                                size: 5,
                              },
                            },
                            {
                              x: pair.regression.x,
                              y: pair.regression.y,
                              mode: "lines",
                              type: "scatter",
                              line: { color: "#ef4444", width: 2, dash: "dot" },
                            },
                          ]}
                          layout={{
                            autosize: true,
                            margin: { t: 5, r: 5, b: 25, l: 25 },
                            xaxis: {
                              showgrid: false,
                              tickfont: { size: 8 },
                              zeroline: false,
                            },
                            yaxis: {
                              showgrid: true,
                              gridcolor: "#f8fafc",
                              tickfont: { size: 8 },
                              zeroline: false,
                            },
                            showlegend: false,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "distribution" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-700 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">
                  Feature Distributions
                </h3>
                <p className="text-xs text-zinc-500">
                  Univariate statistical spread and density estimation
                </p>
              </div>

              <div className="relative inline-block">
                <select
                  value={distChartType}
                  onChange={(e) => setDistChartType(e.target.value)}
                  className="appearance-none bg-white border border-zinc-200 text-zinc-700 text-[11px] font-bold py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm hover:border-zinc-300 transition-all"
                >
                  {DISTRIBUTION_CHART_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
                  <svg
                    className="fill-current h-3 w-3"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(
                results?.ml_insights?.distribution_analysis || {},
              ).map(([col, data]) => (
                <div
                  key={col}
                  className="p-6 bg-white border border-zinc-100 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-bold text-zinc-800 group-hover:text-blue-600 transition-colors">
                      {col}
                    </h4>
                    <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-bold uppercase tracking-tighter">
                      {distChartType.replace("_", " ")}
                    </span>
                  </div>

                  <div className="h-72 w-full">
                    <PlotlyChart
                      data={[
                        getDistributionPlotConfig(
                          distChartType,
                          data.raw_sample,
                        ),
                      ]}
                      layout={{
                        autosize: true,
                        margin: { t: 10, b: 30, l: 40, r: 10 },
                        yaxis: { zeroline: false, gridcolor: "#f1f5f9" },
                        xaxis: { showgrid: false },
                        paper_bgcolor: "rgba(0,0,0,0)",
                        plot_bgcolor: "rgba(0,0,0,0)",
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-zinc-50">
                    <div className="text-center">
                      <p className="text-[8px] text-zinc-400 uppercase font-bold">
                        Min
                      </p>
                      <p className="text-xs font-mono">
                        {data.stats.min.toFixed(1)}
                      </p>
                    </div>
                    <div className="text-center border-x border-zinc-100">
                      <p className="text-[8px] text-zinc-400 uppercase font-bold">
                        Median
                      </p>
                      <p className="text-xs font-mono">
                        {data.stats.median.toFixed(1)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] text-zinc-400 uppercase font-bold">
                        Max
                      </p>
                      <p className="text-xs font-mono">
                        {data.stats.max.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "ml_insights" && (
          <div className="animate-in fade-in zoom-in-95 duration-700 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="p-6 border border-zinc-100 rounded-3xl">
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-6 tracking-widest">
                  Feature Influence (Unsupervised)
                </h4>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={Object.entries(
                        results.ml_insights?.feature_influence || {},
                      ).map(([name, value]) => ({ name, value }))}
                      layout="vertical"
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={100}
                        fontSize={10}
                        tick={{ fill: "#a1a1aa" }}
                      />
                      <Tooltip
                        cursor={{ fill: "#f8fafc" }}
                        contentStyle={{
                          borderRadius: "12px",
                          border: "none",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                        }}
                      />
                      <Bar
                        dataKey="value"
                        fill="#3b82f6"
                        radius={[0, 4, 4, 0]}
                        barSize={15}
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

        {activeTab === "recommendations" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-700 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-8 bg-white border border-purple-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                <span className="px-2 py-1 bg-purple-50 text-purple-600 text-[10px] font-black rounded uppercase tracking-widest border border-purple-100">
                  AI Hypotheses
                </span>
                <ul className="mt-6 space-y-4">
                  {results.ml_insights?.ai_observations?.hypotheses?.map(
                    (h) => (
                      <li
                        key={
                          typeof h === "string"
                            ? h
                            : h.question || JSON.stringify(h)
                        }
                        className="group flex items-start text-sm text-zinc-700 leading-relaxed italic"
                      >
                        <span className="mr-3 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
                        &ldquo;
                        {typeof h === "string"
                          ? h
                          : h.question || JSON.stringify(h)}
                        &rdquo;
                      </li>
                    ),
                  )}
                </ul>
              </div>

              <div className="p-8 bg-blue-50 border border-blue-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                <span className="px-2 py-1 bg-blue-100 text-blue-600 text-[10px] font-black rounded uppercase tracking-widest border border-blue-200">
                  Cleaning Strategy
                </span>
                <p className="mt-6 text-blue-900 text-sm leading-relaxed font-medium">
                  {getCleaningTipsText(
                    results.ml_insights?.ai_observations?.cleaning_tips,
                  )}
                </p>
              </div>
            </div>

            <div className="p-8 bg-emerald-50 border border-emerald-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-600 text-[10px] font-black rounded uppercase tracking-widest border border-emerald-100">
                    Feature Engineering
                  </span>
                  <h3 className="text-sm font-bold text-emerald-900 mt-2">
                    Engineered Feature Suggestions
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {results.ml_insights?.ai_observations?.feature_suggestions?.map(
                  (s, i) => {
                    const {
                      title: suggestionTitle,
                      description: suggestionDesc,
                    } = getFeatureSuggestionDetails(s);
                    return (
                      <div
                        key={suggestionTitle}
                        className="flex flex-col p-5 md:p-6 bg-white border border-emerald-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow group cursor-default overflow-hidden"
                      >
                        <div className="h-7 w-7 shrink-0 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center mb-3 text-xs font-black group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-sm">
                          0{i + 1}
                        </div>
                        <p className="text-sm text-zinc-800 font-bold leading-snug mb-1.5 group-hover:text-emerald-700 transition-colors break-words">
                          {suggestionTitle}
                        </p>
                        {suggestionDesc && (
                          <p className="text-xs text-zinc-500 leading-relaxed italic break-words mt-auto pt-1">
                            {suggestionDesc}
                          </p>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

AnalysisTabs.propTypes = {
  results: PropTypes.object.isRequired,
  activeTab: PropTypes.string.isRequired,
  setActiveTab: PropTypes.func.isRequired,
};
