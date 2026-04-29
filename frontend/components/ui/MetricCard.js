import React from "react";

const MetricCard = React.memo(function MetricCard({
  label,
  value,
  color = "text-zinc-900",
}) {
  return (
    <div className="bg-white p-3 lg:p-4 border border-zinc-200 rounded-2xl shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:border-blue-100 group cursor-default overflow-hidden">
      <p className="text-[9px] lg:text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 group-hover:text-blue-500 transition-colors truncate">
        {label}
      </p>
      <p
        className={`text-lg lg:text-xl xl:text-2xl font-black tracking-tight truncate ${color}`}
      >
        {value}
      </p>
    </div>
  );
});

export default MetricCard;
