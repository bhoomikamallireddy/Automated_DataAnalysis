import os
import pandas as pd
import numpy as np
import random
from .models import AnalysisJob
from .llm_utils import get_llm_insights



from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

def sanitize_for_json(obj):
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
        # Remove null bytes and other problematic characters
        return obj.replace('\x00', '')
    return obj

def run_pipeline(job_id):
    try:
        job = AnalysisJob.objects.get(id=job_id)
        job.status = 'PROCESSING'
        job.save()

        file_path = job.file.path
        # --- MEMORY-SAFE FIX 1: UNICODE & EMPTY CHECK ---
        try:
            # We only load the first 5 rows to check if it's empty and valid
            # This handles the "Empty File" and "Unicode BOM" tests without crashing RAM
            df_check = pd.read_csv(file_path, encoding='utf-8-sig', nrows=5)
            
            if df_check.empty:
                # Headers-only CSV is valid - we'll process it with 0 data rows
                # Continue processing with the empty dataframe
                df_sample = df_check
        except pd.errors.EmptyDataError:
            # Specifically catches 0-byte files
            job.status = 'FAILED'
            job.results = {"error": "The uploaded file is empty (0 bytes)."}
            job.save()
            return
        except Exception as e:
            # Catch encoding errors or corrupt files
            job.status = 'FAILED'
            job.results = {"error": f"Could not read file: {str(e)}"}
            job.save()
            return
        header_df = pd.read_csv(file_path, nrows=0)

        try:
            # 'utf-8-sig' handles the Excel BOM, 'errors=replace' prevents crashing on corrupt symbols
            # 'low_memory=False' prevents the "Mixed Type" warning/error for large files
            # 1. Load Data
            df_sample = pd.read_csv(file_path, encoding='utf-8-sig', nrows=5000, engine='python', on_bad_lines='skip')
            # MIXED TYPE COERCION:
            # Force columns that look like they should be numeric to actually be numeric
            # This fixes the "Mixed Types" failure by turning invalid strings into NaN
            for col in df_sample.columns:
                if df_sample[col].dtype == 'object':
                    # Attempt to convert to numeric, if it's mostly numbers
                    converted = pd.to_numeric(df_sample[col], errors='coerce')
                    if converted.notnull().sum() > (len(df_sample) * 0.3): # If >30% is numeric
                        df_sample[col] = converted
            numeric_df = df_sample.select_dtypes(include=[np.number])
            total_rows = sum(1 for _ in open(file_path, encoding='utf-8', errors='ignore')) - 1

        except UnicodeDecodeError:
            # Fallback for old Windows-encoded files (common in many legacy datasets)
            df_sample = pd.read_csv(file_path, encoding='latin1', nrows=5000)
            numeric_df = df_sample.select_dtypes(include=[np.number])
            total_rows = sum(1 for _ in open(file_path, encoding='utf-8', errors='ignore')) - 1
        except Exception as e:
            # Fallback for other errors - try with c engine
            df_sample = pd.read_csv(file_path, encoding='utf-8-sig', nrows=5000, low_memory=False, on_bad_lines='skip')
            numeric_df = df_sample.select_dtypes(include=[np.number])
            total_rows = sum(1 for _ in open(file_path, encoding='utf-8', errors='ignore')) - 1

        # 2. Metadata & Quality
        null_counts = df_sample.isnull().sum()
        type_counts = df_sample.dtypes.value_counts()

        dtype_map = {
            "Numeric": int(type_counts.get('float64', 0) + type_counts.get('int64', 0)),
            "Categorical": int(type_counts.get('object', 0) + type_counts.get('category', 0)),
            "Datetime": int(type_counts.get('datetime64[ns]', 0)),
        }
        dtype_map["Other"] = int(len(df_sample.columns) - sum(dtype_map.values()))

        # B. Null Correlation — Only include columns that actually have missing data
        null_df = df_sample.isnull()
        cols_with_nulls = null_df.columns[null_df.any()].tolist()
        null_corr_matrix = []
        if len(cols_with_nulls) > 1: # Need at least 2 columns to correlate
            null_corr_matrix = null_df[cols_with_nulls].corr().fillna(0).values

        quality_metrics = {
            "dtype_breakdown": [{"type": k, "count": v} for k, v in dtype_map.items() if v > 0],
            "null_correlation": {
                "z": null_corr_matrix,
                "labels": cols_with_nulls
            }
        }
        total_cells = total_rows * len(header_df.columns)
        actual_nulls = null_counts.sum()
        
        if total_cells > 0:
            health_score = round(max(0, 100 - (actual_nulls / total_cells * 100)), 1)
        else:
            health_score = 0
        # 3. EDA Results
        eda_results = {
            "metadata": {
                "total_rows": total_rows,
                "total_cols": len(header_df.columns),
                "missing_values": null_counts.to_dict(),
                "column_types": header_df.dtypes.astype(str).to_dict(),
                "file_name": os.path.basename(file_path),
                "health_score": health_score 
            },
            "univariate": {},
            "outliers": {}
        }

        # 4. Univariate & Outlier Engine
        for col in numeric_df.columns:
            cd = numeric_df[col].dropna()
            if not cd.empty and cd.std() > 0:
                z = (cd - cd.mean()).abs() / cd.std()
                eda_results["outliers"][col] = int((z > 3).sum())
                cnts, bins = np.histogram(cd, bins=10)
                eda_results["univariate"][col] = {
                    "histogram": [{"bin": f"{bins[i]:.1f}", "count": int(cnts[i])} for i in range(len(cnts))],
                    "stats": {
                        "min": float(cd.min()), "median": float(cd.median()), "max": float(cd.max()),
                        "q1": float(cd.quantile(0.25)), "q3": float(cd.quantile(0.75))
                    }
                }
            else:
                eda_results["outliers"][col] = 0

        # 5. ML Engine
        ml_insights = {"quality_metrics": quality_metrics}
        # ---  GUARD ML AGAINST ALL-CATEGORICAL DATA --- # Only run PCA/ML if we have at least 2 numeric columns and 2 rows
        if not numeric_df.empty and len(numeric_df.columns) >= 2 and len(numeric_df) > 1:
            imp = SimpleImputer(strategy='mean')
            # Extra safety: drop columns that are 100% null before scaling
            ml_ready_df = numeric_df.dropna(axis=1, how='all')
            if not ml_ready_df.empty and len(ml_ready_df.columns) >= 2:
              scaled = StandardScaler().fit_transform(imp.fit_transform(ml_ready_df))

              pca = PCA(n_components=min(2, len(ml_ready_df.columns)))
              ml_insights['pca_data'] = pca.fit_transform(scaled)[:500]

              loadings = np.sqrt(np.sum(pca.components_**2, axis=0))
              influence = dict(sorted(zip(ml_ready_df.columns, loadings), key=lambda x: x[1], reverse=True)[:10])
              ml_insights['feature_influence'] = influence

              top_6 = list(influence.keys())[:6]
            
              # Distribution samples
              dist_analysis = {}
              for col in top_6:
                raw_vals = numeric_df[col].dropna().tolist()
                dist_analysis[col] = {
                    "raw_sample": random.sample(raw_vals, min(500, len(raw_vals))),
                    "stats": eda_results["univariate"].get(col, {}).get("stats", {})
                }
              ml_insights["distribution_analysis"] = dist_analysis

             # Bivariate gallery
              gallery = []
              if len(top_6) >= 2:
               for i in range(len(top_6)):
                 for j in range(i + 1, len(top_6)):
                    cx, cy = top_6[i], top_6[j]
                    pdf = ml_ready_df[[cx, cy]].dropna()
                    if len(pdf) > 5:
                        s = pdf.sample(n=min(300, len(pdf)))
                        if s[cx].nunique() > 1:
                            m, b = np.polyfit(s[cx], s[cy], 1)
                            gallery.append({
                                "x_name": cx, "y_name": cy,
                                "corr": float(pdf.corr().iloc[0, 1]),
                                "data": s.to_dict(orient='records'),
                                "regression": {
                                    "x": [float(s[cx].min()), float(s[cx].max())],
                                    "y": [float(m * s[cx].min() + b), float(m * s[cx].max() + b)]
                                }
                            })
               ml_insights["bivariate_gallery"] = gallery
               ml_insights["influential_correlations"] = {
                "z": numeric_df[top_6].corr().fillna(0).values,
                "x": top_6, "y": top_6
               }
            else:
            # Fallbacks for All-Categorical or Single-Column data
               ml_insights.update({
                'pca_data': [],
                'feature_influence': {},
                'distribution_analysis': {},
                'bivariate_gallery': [],
                'influential_correlations': {"z": [], "x": [], "y": []}
              })

           
                  

        # 6. LLM PAYLOAD 
        stats_dict = numeric_df.describe().to_dict() if not numeric_df.empty else {"info": "No numeric data"}
        llm_payload = sanitize_for_json({
            "file_metadata": eda_results["metadata"],
            "statistical_summary": stats_dict ,
            "top_features": ml_insights.get('feature_influence', {}),
            "outliers": eda_results["outliers"]
        })

        try:
            ai_resp = get_llm_insights(llm_payload)
            if not ai_resp: raise ValueError("Empty AI response")
            ml_insights['ai_observations'] = ai_resp
            ml_insights['ai_observations']['is_fallback'] = False
        except Exception as e:
            # ---  RULE-BASED FALLBACK ENGINE ---
            print(f"🔄 LLM Waterfall Failed: {e}. Triggering System Fallback...")
            meta = eda_results.get("metadata", {})
            outliers_count = sum(eda_results.get("outliers", {}).values())
            missing_count = sum(meta.get("missing_values", {}).values())
            health = meta.get("health_score", 100)
            
            # 1. Context-Aware Summary
            summary = f",Dataset Analysis complete for {meta.get('file_name')}. "
            if health > 90:
                summary += "The data quality is excellent, showing high integrity across all primary features with minimal missing entries."
            elif health > 80:
                summary += "The data quality is robust, though minor cleaning of sparse columns is recommended."
            else:
                summary += f"Critical quality issues detected:Data requires preprocessing due to {missing_count} missing values and {outliers_count} statistical anomalies detected.Missing cells require immediate imputation"

            # 2. Structured Feature Suggestions (Title: Description Format)
            # These are designed to match the UI's expectation of 3 strings.
            suggestions = [
                "Interaction terms: Create product features between top influential variables to capture non-linear relationships.",
                "Temporal Scaling: If time-series data exists, normalize intervals to capture seasonal drift.",
                "Z-Score Normalization: Standardize high-variance columns to improve the convergence of distance-based ML models.Apply winsorization to the top 3 high-outlier columns to stabilize variance",
            ]
            
            # Add a context-specific third suggestion
            if missing_count > 0:
                suggestions.append("Missingness Indicators: Binary flags for rows with null values to help the model learn patterns in missing data.")
            else:
                suggestions.append("Non-Linear Mapping: Use polynomial expansion on influential numeric features to improve model fit. Squaring numeric columns to account for potential curved trends in the dataset.")

            # 3. Final Fallback Object
            ml_insights['ai_observations'] = {
                "summary": summary,
                "hypotheses": [
                    "How does the distribution of top features impact overall variance?",
                    "Is there a significant correlation between high-outlier columns?",
                     "How does the variance in your top features drive your primary target variable?",
                    f"Would removing the {outliers_count} detected outliers significantly shift your mean trends?"

                ],
                "cleaning_tips": f"Focus on the {len(meta.get('missing_values', {}))} columns with gaps. Use 'Mean Imputation' for numeric and 'Mode' for categories.Prioritize imputing missing values in key columns. " + (
                    "Apply Z-score capping to handle detected statistical outliers." if outliers_count > 0 else ""
                ),
                "feature_suggestions": suggestions,
                "is_fallback": True 
            }

        # 7. Final Save
        job.results = sanitize_for_json({**eda_results, "ml_insights": ml_insights})
        job.status = 'COMPLETED'
        job.save()

    except Exception as e:
        job.status = 'FAILED'
        job.results = {"error": str(e)}
        job.save()
        
        
        