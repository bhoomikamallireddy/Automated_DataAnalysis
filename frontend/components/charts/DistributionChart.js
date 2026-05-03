import React from "react";
import PropTypes from "prop-types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/**
 * DistributionChart Component
 * Renders a Bar Chart for univariate analysis using Recharts.
 * * @param {Array} data - Array of bin/count objects from the backend results
 * @param {string} title - The column name/title for the chart
 */
export default function DistributionChart({ data, title }) {
  // 1. Handle empty or missing data gracefully (Zero State)
  if (!data || data.length === 0) {
    return (
      <div className="text-xs text-zinc-400 italic">
        No distribution data available for this column.
      </div>
    );
  }

  return (
    <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl transition-all duration-300 hover:bg-white hover:shadow-md">
      {/* 2. Chart Title - Consistent with dashboard styling */}
      <h4 className="text-[9px] font-bold text-zinc-400 uppercase mb-3 tracking-widest">
        {title}
      </h4>

      {/* 3. Recharts Container */}
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e2e8f0"
            />
            <XAxis dataKey="bin" fontSize={8} tick={{ fill: "#94a3b8" }} />
            <YAxis fontSize={8} tick={{ fill: "#94a3b8" }} />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "none",
                fontSize: "10px",
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
              }}
              cursor={{ fill: "#f1f5f9" }}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

DistributionChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      bin: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      count: PropTypes.number,
    }),
  ).isRequired,
  title: PropTypes.string.isRequired,
};
