import React from "react";
import PropTypes from "prop-types";
import HealthGauge from "../ui/HealthGauge";
import MetricCard from "../ui/MetricCard";

/**
 * KPIRibbon Component
 * Displays the high-level metrics for the current dataset.
 */
export default function KPIRibbon({ results, jobStatus }) {
  // Logic: Calculate total anomalies across all columns
  const totalAnomalies = results?.outliers
    ? Object.values(results.outliers).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <HealthGauge score={results?.metadata?.health_score || 0} />

      <MetricCard
        label="Total Rows"
        value={results?.metadata?.total_rows?.toLocaleString() || "0"}
      />

      <MetricCard
        label="Total Columns"
        value={results?.metadata?.total_cols || "0"}
      />

      <MetricCard
        label="Anomalies"
        value={totalAnomalies}
        color="text-amber-600"
      />

      <MetricCard
        label="Status"
        value={jobStatus === "COMPLETED" ? "Done" : "Scanning..."}
        color="text-blue-600"
      />
    </section>
  );
}

KPIRibbon.propTypes = {
  results: PropTypes.shape({
    outliers: PropTypes.objectOf(PropTypes.number),
    metadata: PropTypes.shape({
      health_score: PropTypes.number,
      total_rows: PropTypes.number,
      total_cols: PropTypes.number,
    }),
  }).isRequired,
  jobStatus: PropTypes.string.isRequired,
};
