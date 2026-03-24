import os
import pandas as pd
import numpy as np
from .models import AnalysisJob
from .llm_utils import get_llm_insights
import random

# ML Imports
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

def sanitize_for_json(obj):
    """Recursively converts numpy types to standard python types for JSON safety."""
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
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
    return obj

def run_pipeline(job_id):
    try:
        job = AnalysisJob.objects.get(id=job_id)
        job.status = 'PROCESSING'
        job.save()
        
        file_path = job.file.path
        header_df = pd.read_csv(file_path, nrows=0)
        
        # 1. Load Data
        df_sample = pd.read_csv(file_path, nrows=5000) 
        total_rows = sum(1 for _ in open(file_path)) - 1
        numeric_df = df_sample.select_dtypes(include=[np.number])
        
        # A. Data Type Breakdown (Pie Chart)
        type_counts = df_sample.dtypes.value_counts()
        dtype_map = {
            "Numeric": int(type_counts.get('float64', 0) + type_counts.get('int64', 0)),
            "Categorical": int(type_counts.get('object', 0) + type_counts.get('category', 0)),
            "Datetime": int(type_counts.get('datetime64[ns]', 0)),
        }
        # Catch any types not listed above
        dtype_map["Other"] = int(len(df_sample.columns) - sum(dtype_map.values()))
        
        # B. Missing Value Correlation (Dendrogram Logic)
        null_df = df_sample.isnull()
        cols_with_nulls = null_df.columns[null_df.any()].tolist()
        null_corr_matrix = []
        if cols_with_nulls:
            # Correlation of nullity: 1 if col A and B are missing together
            null_corr_matrix = null_df[cols_with_nulls].corr().fillna(0).values

        quality_metrics = {
            "dtype_breakdown": [{"type": k, "count": v} for k, v in dtype_map.items() if v > 0],
            "null_correlation": {
                "z": null_corr_matrix,
                "labels": cols_with_nulls
            }
        }
        
        # 2. EDA Data (page.js Audit/Gauge support)
        null_counts = df_sample.isnull().sum()
        eda_results = {
            "metadata": {
                "total_rows": total_rows,
                "total_cols": len(header_df.columns),
                "missing_values": null_counts.to_dict(),
                "column_types": header_df.dtypes.astype(str).to_dict(),
                "file_name": os.path.basename(file_path),
                "health_score": round(max(0, 100 - (null_counts.sum() / (total_rows * len(header_df.columns)) * 100)), 1)
            },
            "univariate": {}
        }

        outliers = {}
        for col in numeric_df.columns:
            cd = numeric_df[col].dropna()
            if not cd.empty and cd.std() > 0:
                z = (cd - cd.mean()).abs() / cd.std()
                outliers[col] = int((z > 3).sum())
                cnts, bins = np.histogram(cd, bins=10)
                eda_results["univariate"][col] = {
                    "histogram": [{"bin": f"{bins[i]:.1f}", "count": int(cnts[i])} for i in range(len(cnts))],
                    "stats": {"min": float(cd.min()), "median": float(cd.median()), "max": float(cd.max())}
                }
        eda_results["outliers"] = outliers

        # 3. ML & Correlations (page.js Correlations/ML Tab support)
        ml_insights = {"quality_metrics": quality_metrics} 
        if not numeric_df.empty and len(numeric_df) > 10:
            imp = SimpleImputer(strategy='mean')
            scaled = StandardScaler().fit_transform(imp.fit_transform(numeric_df))
            pca = PCA(n_components=2)
            pca_data = pca.fit_transform(scaled)
            ml_insights['pca_data'] = pca_data[:500]

            loadings = np.sqrt(np.sum(pca.components_**2, axis=0))
            influence = dict(sorted(zip(numeric_df.columns, loadings), key=lambda x: x[1], reverse=True)[:10])
            ml_insights['feature_influence'] = influence
            
            dist_analysis = {}
            for col in list(influence.keys())[:6]:
                raw_vals = numeric_df[col].dropna().tolist()
                dist_analysis[col] = {
                    "raw_sample": random.sample(raw_vals, min(500, len(raw_vals))),
                    "stats": eda_results["univariate"].get(col, {}).get("stats", {})
                }
            ml_insights["distribution_analysis"] = dist_analysis


            # Generate Gallery for page.js
            top_6 = list(influence.keys())[:6]
            gallery = []
            for i in range(len(top_6)):
                for j in range(i + 1, len(top_6)):
                    cx, cy = top_6[i], top_6[j]
                    pdf = numeric_df[[cx, cy]].dropna()
                    if len(pdf) > 5:
                        s = pdf.sample(n=min(300, len(pdf)))
                        if s[cx].nunique() > 1:
                          m, b = np.polyfit(s[cx], s[cy], 1)
                          gallery.append({
                            "x_name": cx, "y_name": cy, "corr": float(pdf.corr().iloc[0,1]),
                            "data": s.to_dict(orient='records'),
                            "regression": {"x": [float(s[cx].min()), float(s[cx].max())], "y": [float(m*s[cx].min()+b), float(m*s[cx].max()+b)]}
                        })
            ml_insights["bivariate_gallery"] = gallery
            ml_insights["influential_correlations"] = {"z": numeric_df[top_6].corr().fillna(0).values, "x": top_6, "y": top_6}

        # 4. Final Cleanup & Save
        full_data = sanitize_for_json({**eda_results, "ml_insights": ml_insights})
        try:
            full_data['ml_insights']['ai_observations'] = get_llm_insights(full_data)
        except:
            full_data['ml_insights']['ai_observations'] = {"summary": "Analysis complete, AI summary unavailable."}

        job.results = full_data
        job.status = 'COMPLETED'
        job.save()

    except Exception as e:
        job.status = 'FAILED'
        job.results = {"error": str(e)}
        job.save()