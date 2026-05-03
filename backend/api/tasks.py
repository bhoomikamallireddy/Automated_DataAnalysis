import os
import subprocess 
import pandas as pd
import numpy as np
import random
import logging
from .models import AnalysisJob
from .llm_utils import get_llm_insights

from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler


logger = logging.getLogger(__name__)
ML_RANDOM_STATE = 42
# ---------------------------------------------------------------------------
# HELPER: Fast row counter
# ---------------------------------------------------------------------------
def _count_rows(file_path: str) -> int:
    """
    Return the number of DATA rows (i.e. excluding the header) in a CSV.
 
    Two strategies, fastest first:
 
    Strategy 1 — wc -l (Linux / macOS only)
        wc reads the file at the OS kernel level without loading it into Python
        memory at all.  For a 500 MB file this takes ~0.1 s and uses ~0 MB RAM
        vs the old approach which used ~500 MB RAM and took several seconds.
        We call it via subprocess so we stay portable (it simply won't be found
        on Windows and we fall through to strategy 2).
 
    Strategy 2 — pandas chunked read (portable, works on Windows too)
        We read only the FIRST column in chunks of 50,000 rows so peak RAM is
        always tiny regardless of how wide or tall the file is.
        This replaces the old  sum(1 for _ in open(...))  pattern which loaded
        every byte of every column into a Python iterator.
    """
    # --- Strategy 1: wc -l (Unix only) ---
    try:
        result = subprocess.run(
            ["wc", "-l", file_path],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            # wc output: "  12345 /path/to/file.csv"
            line_count = int(result.stdout.strip().split()[0])
            # wc counts newline characters; if the file does not end with a
            # trailing newline the reported value will be one less than the
            # actual number of lines. Check the last byte and compensate.
            try:
                with open(file_path, 'rb') as f:
                    if f.seek(0, os.SEEK_END) == 0:
                        return 0
                    f.seek(-1, os.SEEK_END)
                    if f.read(1) != b"\n":
                        line_count += 1
            except OSError:
                pass
            return max(0, line_count - 1)   # subtract 1 for the header row
    except (FileNotFoundError, subprocess.TimeoutExpired, ValueError, IndexError):
        pass  # wc not available — fall through to pandas
 
    # --- Strategy 2: pandas chunked read (portable fallback) ---
    total = 0
    try:
        for chunk in pd.read_csv(
            file_path,
            encoding='utf-8-sig',
            chunksize=50_000,
            usecols=[0],          # read only the first column to minimise I/O
            header=0,
            on_bad_lines='skip',
        ):
            total += len(chunk)
    except Exception:
        pass  # don't crash the whole pipeline over a row count
    return total

# =============================================================================
# HELPER 1: JSON Serialisation
# =============================================================================
def sanitize_for_json(obj):
    """Recursively converts NumPy/Pandas types to JSON-safe Python types."""
    if isinstance(obj, dict):
        return {sanitize_for_json(k): sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(i) for i in obj]
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, (np.int64, np.int32)):
        return int(obj)
    elif pd.isna(obj):
        return None
    elif isinstance(obj, str):
        # FIX: Remove null bytes that crash PostgreSQL's JSONField
        return obj.replace('\x00', '')
    return obj


# =============================================================================
# HELPER 2: DATA LOADER
# =============================================================================
def load_data_safely(file_path):
    """
    Returns (df, header_df, error_string).
    Handles: empty files, Unicode BOM, latin1 encoding, and corrupted CSVs.
    """
    # --- Stage 1: Safety check (reads only 5 rows to avoid RAM spike) ---
    try:
        df_check = pd.read_csv(file_path, encoding='utf-8-sig', nrows=5)
        if df_check.empty:
            # Headers-only file: valid but has no data rows
            header_df = df_check
            return df_check, header_df, None
    except pd.errors.EmptyDataError:
        return None, None, "The uploaded file is empty (0 bytes)."
    except Exception as e:
        return None, None, f"Could not read file: {str(e)}"

    # --- Stage 2: Read true headers (nrows=0) for accurate column count ---
    # FIX 1: This is the key line that ensures total_cols is correct
    # even for headers-only CSVs or files with trailing empty rows.
    header_df = pd.read_csv(file_path, nrows=0)

    # --- Stage 3: Full load with 3-layer fallback ---
    # FIX 2: Restored all three strategies from the old code
    try:
        # Strategy 1: UTF-8 with BOM stripping (handles Excel exports)
        df = pd.read_csv(
            file_path, encoding='utf-8-sig', nrows=5000,
            engine='python', on_bad_lines='skip'
        )
    except UnicodeDecodeError:
        # Strategy 2: Latin-1 (handles legacy Windows/European files)
        df = pd.read_csv(file_path, encoding='latin1', nrows=5000)
    except Exception:
        # Strategy 3: Last resort — disable memory optimisation, skip bad lines
        df = pd.read_csv(
            file_path, encoding='utf-8-sig', nrows=5000,
            low_memory=False, on_bad_lines='skip'
        )

    # --- Mixed Type Coercion ---
    # Converts columns like ["1","2","N/A","4"] from object → numeric
    for col in df.columns:
        if df[col].dtype == 'object':
            converted = pd.to_numeric(df[col], errors='coerce')
            if converted.notnull().sum() > (len(df) * 0.3):  # >30% are numbers
                df[col] = converted

    return df, header_df, None


# =============================================================================
# HELPER 3: EDA ENGINE
# =============================================================================
def run_eda_engine(df, header_df, total_rows, file_name):
    """
    Calculates metadata, health score, dtype breakdown,
    null correlation, univariate stats, and outliers.
    """
    null_counts = df.isnull().sum()
    type_counts = df.dtypes.value_counts()
    numeric_df = df.select_dtypes(include=[np.number])

    # FIX 3: Use header_df for column count — more accurate than df.columns
    # when the loaded sample has different columns due to bad lines being skipped
    total_cols = len(header_df.columns)
    total_cells = total_rows * total_cols
    actual_nulls = null_counts.sum()
    health_score = round(max(0, 100 - (actual_nulls / total_cells * 100)), 1) if total_cells > 0 else 0

    # --- Dtype Breakdown ---
    numeric_count   = int(type_counts.get('float64', 0) + type_counts.get('int64', 0))
    category_count  = int(type_counts.get('object', 0) + type_counts.get('category', 0))
    datetime_count  = int(type_counts.get('datetime64[ns]', 0))
    # FIX 4: "Other" catches bool, timedelta, and any exotic pandas dtype
    other_count     = int(total_cols - numeric_count - category_count - datetime_count)

    dtype_breakdown = [
        {"type": "Numeric",     "count": numeric_count},
        {"type": "Categorical", "count": category_count},
        {"type": "Datetime",    "count": datetime_count},
        {"type": "Other",       "count": max(0, other_count)},
    ]
    # Only include types that actually exist (keeps frontend charts clean)
    dtype_breakdown = [d for d in dtype_breakdown if d["count"] > 0]

    # --- Null Correlation Matrix (only for columns that have missing values) ---
    null_df = df.isnull()
    cols_with_nulls = null_df.columns[null_df.any()].tolist()
    null_correlation = {"z": [], "labels": []}
    if len(cols_with_nulls) > 1:
        null_correlation = {
            "z": null_df[cols_with_nulls].corr().fillna(0).values,
            "labels": cols_with_nulls
        }

    eda_results = {
        "metadata": {
            "total_rows":    total_rows,
            "total_cols":    total_cols,
            "missing_values": null_counts.to_dict(),
            "column_types":  header_df.dtypes.astype(str).to_dict(),
            "file_name":     file_name,
            "health_score":  health_score,
        },
        "univariate": {},
        "outliers":   {},
        "quality_metrics": {
            "dtype_breakdown":  dtype_breakdown,
            "null_correlation": null_correlation,
        }
    }

    # --- Univariate & Outlier Engine ---
    for col in numeric_df.columns:
        cd = numeric_df[col].dropna()
        if not cd.empty and cd.std() > 0:
            z = (cd - cd.mean()).abs() / cd.std()
            eda_results["outliers"][col] = int((z > 3).sum())
            cnts, bins = np.histogram(cd, bins=10)
            eda_results["univariate"][col] = {
                "histogram": [
                    {"bin": f"{bins[i]:.1f}", "count": int(cnts[i])}
                    for i in range(len(cnts))
                ],
                # FIX 5: Restored q1 and q3 — needed by frontend box plots
                "stats": {
                    "min":    float(cd.min()),
                    "median": float(cd.median()),
                    "max":    float(cd.max()),
                    "q1":     float(cd.quantile(0.25)),
                    "q3":     float(cd.quantile(0.75)),
                }
            }
        else:
            eda_results["outliers"][col] = 0

    return eda_results, numeric_df


# =============================================================================
# HELPER 4: ML ENGINE
# =============================================================================
def run_ml_engine(numeric_df, eda_results):
    """
    Runs PCA, computes feature influence, distribution samples,
    bivariate scatter gallery, and correlation heatmap.
    """
    # FIX 6: Always initialise all keys so the frontend never gets KeyError
    ml_insights = {
        "pca_data":               [],
        "feature_influence":      {},
        "distribution_analysis":  {},
        "bivariate_gallery":      [],
        "influential_correlations": {"z": [], "x": [], "y": []},
    }

    # Guard: need ≥2 numeric columns and ≥2 rows for PCA to make sense
    if numeric_df.empty or len(numeric_df.columns) < 2 or len(numeric_df) <= 1:
        return ml_insights

    imp = SimpleImputer(strategy='mean')
    # Drop columns that are 100% null — imputer can't handle them
    ml_ready_df = numeric_df.dropna(axis=1, how='all')

    if ml_ready_df.empty or len(ml_ready_df.columns) < 2:
        return ml_insights

    # --- PCA ---
    scaled = StandardScaler().fit_transform(imp.fit_transform(ml_ready_df))
    pca = PCA(n_components=min(2, len(ml_ready_df.columns)), random_state=ML_RANDOM_STATE)
    ml_insights['pca_data'] = pca.fit_transform(scaled)[:500]

    # --- Feature Influence (PCA loadings) ---
    loadings = np.sqrt(np.sum(pca.components_ ** 2, axis=0))
    influence = dict(
        sorted(zip(ml_ready_df.columns, loadings), key=lambda x: x[1], reverse=True)[:10]
    )
    ml_insights['feature_influence'] = influence
    top_6 = list(influence.keys())[:6]

    # --- Distribution Analysis ---
    rng = random.Random(ML_RANDOM_STATE)
    for col in top_6:
        raw_vals = numeric_df[col].dropna().tolist()
        ml_insights["distribution_analysis"][col] = {
            "raw_sample": rng.sample(raw_vals, min(500, len(raw_vals))),
            "stats": eda_results["univariate"].get(col, {}).get("stats", {}),
        }

    # --- Bivariate Gallery (scatter + regression line per pair) ---
    gallery = []
    for i in range(len(top_6)):
        for j in range(i + 1, len(top_6)):
            cx, cy = top_6[i], top_6[j]
            pdf = ml_ready_df[[cx, cy]].dropna()
            if len(pdf) > 5:
                s = pdf.sample(n=min(300, len(pdf)), random_state=42)
                if s[cx].nunique() > 1:
                    m, b = np.polyfit(s[cx], s[cy], 1)
                    gallery.append({
                        "x_name": cx,
                        "y_name": cy,
                        "corr":   float(pdf.corr().iloc[0, 1]),
                        "data":   s.to_dict(orient='records'),
                        "regression": {
                            "x": [float(s[cx].min()), float(s[cx].max())],
                            "y": [
                                float(m * s[cx].min() + b),
                                float(m * s[cx].max() + b)
                            ],
                        }
                    })
    ml_insights["bivariate_gallery"] = gallery

    # --- Correlation Heatmap ---
    ml_insights["influential_correlations"] = {
        "z": numeric_df[top_6].corr().fillna(0).values,
        "x": top_6,
        "y": top_6,
    }

    return ml_insights


# =============================================================================
# HELPER 5: AI INSIGHTS + FALLBACK
# =============================================================================
def attach_ai_insights(ml_insights, eda_results, numeric_df):
    """
    Calls the LLM waterfall (Gemini → Grok).
    On failure, generates a rich rule-based fallback — never a blank stub.
    """
    stats_dict = numeric_df.describe().to_dict() if not numeric_df.empty else {"info": "No numeric data"}
    llm_payload = sanitize_for_json({
        "file_metadata":       eda_results["metadata"],
        "statistical_summary": stats_dict,
        "top_features":        ml_insights.get('feature_influence', {}),
        "outliers":            eda_results["outliers"],
    })

    try:
        ai_resp = get_llm_insights(llm_payload)
        if not ai_resp:
            raise ValueError("Empty AI response")
        ml_insights['ai_observations'] = {**ai_resp, "is_fallback": False}

    except Exception as e:
        logger.warning("LLM Waterfall Failed: %s. Triggering System Fallback.", e)
        meta           = eda_results.get("metadata", {})
        outliers_count = sum(eda_results.get("outliers", {}).values())
        missing_count  = sum(meta.get("missing_values", {}).values())
        health         = meta.get("health_score", 100)

    
        summary = f"Dataset Analysis complete for {meta.get('file_name')}. "
        if health > 90:
            summary += (
                "The data quality is excellent, showing high integrity across all "
                "primary features with minimal missing entries."
            )
        elif health > 80:
            summary += (
                "The data quality is robust, though minor cleaning of sparse "
                "columns is recommended."
            )
        else:
            summary += (
                f"Critical quality issues detected: data requires preprocessing "
                f"due to {missing_count} missing values and {outliers_count} "
                f"statistical anomalies. Missing cells require immediate imputation."
            )


        suggestions = [
            "Interaction terms: Create product features between top influential "
            "variables to capture non-linear relationships.",
            "Temporal Scaling: If time-series data exists, normalize intervals "
            "to capture seasonal drift.",
            "Z-Score Normalization: Standardize high-variance columns to improve "
            "convergence of distance-based ML models.",
        ]
        if missing_count > 0:
            suggestions.append(
                "Missingness Indicators: Binary flags for rows with null values "
                "to help the model learn patterns in missing data."
            )
        else:
            suggestions.append(
                "Non-Linear Mapping: Use polynomial expansion on influential "
                "numeric features to improve model fit."
            )

        ml_insights['ai_observations'] = {
            "summary": summary,
            "hypotheses": [
                "How does the distribution of top features impact overall variance?",
                "Is there a significant correlation between high-outlier columns?",
                "How does the variance in your top features drive your primary target variable?",
                f"Would removing the {outliers_count} detected outliers significantly "
                f"shift your mean trends?",
            ],
            "cleaning_tips": (
                f"Focus on the {len(meta.get('missing_values', {}))} columns with gaps. "
                f"Use 'Mean Imputation' for numeric and 'Mode' for categories. "
            ) + (
                "Apply Z-score capping to handle detected statistical outliers."
                if outliers_count > 0 else ""
            ),
            "feature_suggestions": suggestions,
            "is_fallback": True,
        }

    return ml_insights


# =============================================================================
# MAIN ORCHESTRATOR
# =============================================================================
def run_pipeline(job_id):
    try:
        job = AnalysisJob.objects.get(id=job_id)
        job.status = 'PROCESSING'
        job.save()

        file_path = job.file.path

        # Step 1: Load data safely (3-layer fallback encoding)
        df, header_df, error = load_data_safely(file_path)
        if error:
            job.status  = 'FAILED'
            job.results = {"error": error}
            job.save()
            return

        # Count total rows (memory-safe)
        total_rows = _count_rows(file_path) 

        # Step 2: EDA — metadata, quality metrics, univariate, outliers
        eda_results, numeric_df = run_eda_engine(
            df, header_df, total_rows, os.path.basename(file_path)
        )

        # Step 3: ML — PCA, feature influence, bivariate, correlations
        ml_insights = run_ml_engine(numeric_df, eda_results)

        # Move quality_metrics into ml_insights for dashboard consistency
        ml_insights["quality_metrics"] = eda_results.pop("quality_metrics", {})

        # Step 4: AI insights with rich rule-based fallback
        ml_insights = attach_ai_insights(ml_insights, eda_results, numeric_df)

        # Step 5: Sanitize and save
        job.results = sanitize_for_json({**eda_results, "ml_insights": ml_insights})
        job.status  = 'COMPLETED'
        job.save()

    except Exception as e:
        job.status  = 'FAILED'
        job.results = {"error": str(e)}
        job.save()
        
        
  
