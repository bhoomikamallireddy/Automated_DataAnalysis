import React from "react";
import PropTypes from "prop-types";
import { getHealthLabel } from "../../utils/analysisHelpers";

export default function HealthGauge({ score }) {
  // Logic for color based on score
  const getColor = (s) => {
    if (s >= 90) return "#10b981"; // Emerald
    if (s >= 70) return "#f59e0b"; // Amber
    return "#ef4444"; // Red
  };

  const color = getColor(score);
  const strokeDasharray = `${score}, 100`;

  return (
    <div className="bg-white p-3 lg:p-4 border border-zinc-200 rounded-2xl shadow-sm transition-all duration-300 hover:scale-[1.02] flex items-center gap-2 lg:gap-3 group col-span-2 sm:col-span-1 overflow-hidden">
      <div className="relative h-12 w-12 lg:h-14 lg:w-14 shrink-0">
        <svg viewBox="0 0 36 36" className="h-full w-full transform -rotate-90">
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            className="stroke-zinc-100"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[9px] font-black" style={{ color }}>
            {Math.round(score)}%
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[9px] lg:text-[10px] font-bold text-zinc-400 uppercase tracking-widest group-hover:text-blue-400 transition-colors truncate">
          Health Score
        </p>
        <p className="text-xs font-bold text-zinc-700 truncate">
          {getHealthLabel(score)}
        </p>
      </div>
    </div>
  );
}

HealthGauge.propTypes = {
  score: PropTypes.number.isRequired,
};
