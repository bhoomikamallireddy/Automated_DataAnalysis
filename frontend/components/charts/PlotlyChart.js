"use client";
import dynamic from 'next/dynamic';
import PropTypes from "prop-types";

// This is the magic part: it tells Next.js NOT to run this on the server
const Plot = dynamic(() => import("react-plotly.js"), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-zinc-50 animate-pulse rounded-xl flex items-center justify-center text-xs text-zinc-400">Loading Engine...</div>
});

export default function PlotlyChart({ data, layout, config }) {
  return (
    <Plot
      data={data}
      layout={{
        autosize: true,
        margin: { t: 40, r: 20, l: 40, b: 40 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', size: 11 },
        ...layout
      }}
      config={{ displayModeBar: false, responsive: true, ...config }}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

PlotlyChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  layout: PropTypes.object,
  config: PropTypes.object,
};

PlotlyChart.defaultProps = {
  layout: {},
  config: {},
};
