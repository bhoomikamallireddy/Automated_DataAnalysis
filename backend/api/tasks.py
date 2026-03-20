import os
import pandas as pd
import numpy as np
from scipy import stats
from .models import AnalysisJob
from .llm_utils import get_llm_insights

# ML Imports
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

def run_pipeline(job_id):
    try:
        # 1. Initialization
        job = AnalysisJob.objects.get(id=job_id)
        job.status = 'PROCESSING'
        job.save()
        
        file_path = job.file.path
        if not os.path.exists(file_path):
            raise FileNotFoundError("Uploaded file not found on disk.")
            
        # 2. Schema Scan & One-Pass Chunking
        total_rows = 0
        null_counts = None
        df_sample = None
        
        # We read headers separately for type metadata
        header_df = pd.read_csv(file_path, nrows=0)
        
        for chunk in pd.read_csv(file_path, chunksize=100000):
            total_rows += len(chunk)
            if df_sample is None:
                df_sample = chunk.copy() 
                null_counts = chunk.isnull().sum()
            else:
                null_counts += chunk.isnull().sum()

        if df_sample is None or df_sample.empty:
            raise ValueError("The uploaded CSV file is empty.")

        numeric_df = df_sample.select_dtypes(include=[np.number])
        
        # 3. EDA ENGINE 
        eda_results = {
            "metadata": {
                "total_rows": total_rows,
                "total_cols": len(header_df.columns),
                "missing_values": null_counts.to_dict() if null_counts is not None else {},
                "column_types": header_df.dtypes.astype(str).to_dict()
            },
            "statistics": {},
            "correlations": {},
            "outliers": {},
            "univariate": {}
        }

        if not numeric_df.empty:
            # Stats (Optimized set)
            stats_df = numeric_df.describe()
            metrics = ['mean', 'std', 'min', 'max', '25%', '50%', '75%']
            eda_results["statistics"] = stats_df.loc[stats_df.index.isin(metrics)].to_dict()
            
            # Correlation (Wide-set protection)
            working_df = numeric_df
            if numeric_df.shape[1] > 30:
                top_cols = numeric_df.var().sort_values(ascending=False).head(30).index
                working_df = numeric_df[top_cols]
                eda_results["correlations_info"] = "Displaying top 30 columns by variance."
            eda_results["correlations"] = working_df.corr().to_dict()
            
            # Outliers (Vectorized Z-Score)
            outliers = {}
            for col in numeric_df.columns:
                col_data = numeric_df[col].dropna()
                if not col_data.empty and col_data.std() > 0:
                    z = np.abs((col_data - col_data.mean()) / col_data.std())
                    outliers[col] = int((z > 3).sum())
                else:
                    outliers[col] = 0
            eda_results["outliers"] = outliers
            
            # --- Inside run_pipeline, where you process numeric_df ---
            univariate_data = {}

            for col in numeric_df.columns:
               col_data = numeric_df[col].dropna()
               if not col_data.empty:
                # 1. Histogram Bins (Fixed 10 bins for UI consistency)
                 counts, bin_edges = np.histogram(col_data, bins=10)
        
                 # 2. Simplified KDE/Distribution Curve 
                 # We'll send the 5-point summary + standard deviation for the UI to "fake" a curve 
                 # or just send the histogram bins which Recharts handles well.
                 univariate_data[col] = {
                    "histogram": [
                      {"bin": f"{bin_edges[i]:.1f}-{bin_edges[i+1]:.1f}", "count": int(counts[i])} 
                     for i in range(len(counts))
                   ],
                    "stats": {
                    "min": float(col_data.min()),
                    "q1": float(col_data.quantile(0.25)),
                   "median": float(col_data.median()),
                    "q3": float(col_data.quantile(0.75)),
                    "max": float(col_data.max())
                    }
                 }
            eda_results["univariate"] = univariate_data

        # 4. ML ENGINE (Pattern Discovery)
        ml_insights = {}
        if numeric_df.shape[1] >= 2 and total_rows > 10:
            try:
                # Preprocessing
                imputer = SimpleImputer(strategy='mean')
                scaled_data = StandardScaler().fit_transform(imputer.fit_transform(numeric_df))
                
                # PCA Logic
                pca = PCA(n_components=2)
                pca_result = pca.fit_transform(scaled_data)
                
                ml_insights['pca_data'] = pca_result[:500].tolist() 
                ml_insights['explained_variance'] = pca.explained_variance_ratio_.tolist()

                # Feature Influence (Unsupervised importance via PCA loadings)
                loadings = np.sqrt(np.sum(pca.components_**2, axis=0))
                influence_map = dict(zip(numeric_df.columns, loadings.tolist()))
                ml_insights['feature_influence'] = dict(
                    sorted(influence_map.items(), key=lambda x: x[1], reverse=True)[:10]
                )
            except Exception as ml_err:
                ml_insights['error'] = f"ML processing failed: {str(ml_err)}"

        # 5. LLM INTELLIGENCE 
        try:
            # Only send essential context to save tokens/cost
            context = {
                "metadata": eda_results["metadata"],
                "influence": ml_insights.get('feature_influence', {}),
                "stats": eda_results["statistics"]
            }
            ml_insights['ai_observations'] = get_llm_insights(context)
        except Exception as e:
            ml_insights['ai_observations'] = {"error": f"LLM failed: {str(e)}"}

        # 6. Final Save
        job.results = {**eda_results, "ml_insights": ml_insights}
        job.status = 'COMPLETED'
        job.save()

    except AnalysisJob.DoesNotExist:
        pass
    except Exception as e:
        try:
            job.status = 'FAILED'
            job.results = {"error": str(e)}
            job.save()
        except:
            pass