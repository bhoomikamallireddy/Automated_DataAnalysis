import {
  STATUS_COMPLETED,
  STATUS_FAILED,
  QUALITY_LABELS,
} from "../constants/analysis";

/**
 * Returns the Tailwind CSS classes for status badges based on the job status.
 */

export function getStatusBadgeClass(status) {
  if (status === STATUS_COMPLETED) {
    return "bg-emerald-50 text-emerald-600";
  }

  if (status === STATUS_FAILED) {
    return "bg-red-50 text-red-600";
  }

  return "bg-blue-50 text-blue-600 animate-pulse";
}

export function getHealthLabel(score) {
  if (score >= 90) {
    return QUALITY_LABELS.excellent;
  }

  if (score >= 70) {
    return QUALITY_LABELS.review;
  }

  return QUALITY_LABELS.critical;
}

export function getDistributionPlotConfig(chartType, sampleData) {
  switch (chartType) {
    case "violin":
      return {
        type: "violin",
        y: sampleData,
        box: { visible: true },
        line: { color: "#3b82f6" },
        fillcolor: "rgba(59, 130, 246, 0.1)",
        meanline: { visible: true },
      };
    case "histogram":
      return {
        type: "histogram",
        x: sampleData,
        marker: {
          color: "#3b82f6",
          line: {
            color: "white",
            width: 0.5,
          },
        },
        opacity: 0.7,
      };
    case "box":
      return {
        type: "box",
        y: sampleData,
        marker: {
          color: "#8b5cf6",
        },
        boxpoints: "outliers",
      };
    default:
      return {
        type: "box",
        y: sampleData,
        mode: "markers",
        boxpoints: "all",
        jitter: 0.5,
        pointpos: 0,
        fillcolor: "rgba(255,255,255,0)",
        line: {
          color: "rgba(255,255,255,0)",
        },
        marker: {
          color: "#3b82f6",
          size: 4,
          opacity: 0.4,
        },
      };
  }
}

export const getCleanFileName = (fullName) => {
  if (!fullName) {
    return "provided dataset";
  }

  // 1. Remove the file extension (.csv)
  let name = fullName.split(".").slice(0, -1).join(".");

  // 2. Remove common Django/Random suffixes (e.g., _abc123 or _1)
  // This regex looks for an underscore followed by alphanumeric characters at the end
  name = name.replace(/_[a-zA-Z0-9]+$/, "");

  return name;
};
