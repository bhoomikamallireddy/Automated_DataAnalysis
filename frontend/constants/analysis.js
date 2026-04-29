/**
 * Global Constants for the AutoEda Dashboard
 * Centralizing these prevents "Magic String" bugs and satisfies SonarQube.
 */

// 1. API Configuration
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000";
export const JOBS_API_URL = `${API_BASE_URL}/api/jobs/`;

// 2. LocalStorage Keys
export const ACCESS_TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_KEY = "refresh_token";
export const LAST_ACTIVE_JOB_ID_KEY = "last_active_job_id";

// 3. Timing & UX Settings
export const HISTORY_REFRESH_INTERVAL_MS = 10000;
export const MODE_SWITCH_DELAY_MS = 600;
export const LOGIN_REDIRECT_DELAY_MS = 1500;

// 4. Analysis Statuses
export const STATUS_IDLE = "IDLE";
export const STATUS_PENDING = "PENDING";
export const STATUS_PROCESSING = "PROCESSING";
export const STATUS_COMPLETED = "COMPLETED";
export const STATUS_FAILED = "FAILED";

// 5. Data Quality UI Labels
export const QUALITY_LABELS = {
  excellent: "Excellent",
  review: "Needs Review",
  critical: "Critical",
};

// 6. Chart Configuration Options
export const DISTRIBUTION_CHART_OPTIONS = [
  { value: "violin", label: "Violin Plot" },
  { value: "histogram", label: "Histogram" },
  { value: "box", label: "Box Plot" },
  { value: "strip", label: "Strip Plot" },
];

// 7. Sidebar Navigation Modules
export const modules = [
  { id: "overview", label: "Overview", icon: "🏠" },
  { id: "audit", label: "Audit", icon: "🔍" },
  { id: "correlations", label: "Correlations", icon: "🧬" },
  { id: "ml_insights", label: "ML Insights", icon: "🧠" },
  { id: "distribution", label: "Distribution", icon: "📊" },
  { id: "recommendations", label: "Recommendations", icon: "💡" },
];
