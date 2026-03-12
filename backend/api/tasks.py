import os
import pandas as pd
import numpy as np
from scipy import stats
from .models import AnalysisJob

# ML Imports
from sklearn.ensemble import RandomForestRegressor
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
        
        # 2. Safety Check
        if not os.path.exists(file_path):
            raise FileNotFoundError("Uploaded file not found on disk.")
            
        header_df = pd.read_csv(file_path, nrows=0)
        if header_df.columns.empty:
            job.results = {"error": "The uploaded CSV file has no headers or content."}
            job.status = 'FAILED'
            job.save()
            return

        # -- EDA ENGINE---
        
        # 3. Scalable Metadata Scan (Chunking)
        total_rows = 0
        null_counts = None
        
        for chunk in pd.read_csv(file_path, chunksize=100000):
            total_rows += len(chunk)
            if null_counts is None:
                null_counts = chunk.isnull().sum()
            else:
                null_counts += chunk.isnull().sum()

        # 4. Statistical Sampling (100k rows max for heavy stats/ML)
        df_sample = pd.read_csv(file_path, nrows=100000)
        numeric_df = df_sample.select_dtypes(include=[np.number])
        
        # Initialize the results container
        eda_results = {
            "metadata": {
                "total_rows": total_rows,
                "total_cols": len(header_df.columns),
                "missing_values": null_counts.to_dict() if null_counts is not None else {},
                "column_types": header_df.dtypes.astype(str).to_dict()
            },
            "statistics": {},
            "correlations": {},
            "outliers": {}
        }

        # 5. Process Statistics if numeric data exists
        if not numeric_df.empty:
            eda_results["statistics"] = numeric_df.describe().to_dict()
            
            # Intelligent Correlation
            if numeric_df.shape[1] < 30:
                eda_results["correlations"] = numeric_df.corr().to_dict()
            else:
                top_v_cols = numeric_df.var().sort_values(ascending=False).head(20).index
                eda_results["correlations"] = numeric_df[top_v_cols].corr().to_dict()
                eda_results["correlations"]["_info"] = "Limited to top 20 variance columns."
            
            # Outlier Detection (Z-score > 3)
            outliers = {}
            for col in numeric_df.columns:
                clean_col = numeric_df[col].dropna()
                if not clean_col.empty and clean_col.std() > 0:
                    z_scores = np.abs(stats.zscore(clean_col))
                    outliers[col] = int(np.sum(z_scores > 3))
                else:
                    outliers[col] = 0
            eda_results["outliers"] = outliers

        # --- ML ENGINE (PATTERN DISCOVERY) ---
        
        ml_insights = {}
        
        # We need at least 2 columns and some rows to perform meaningful ML
        if numeric_df.shape[1] >= 2 and total_rows > 10:
            try:
                # 1. Handle "Dirty Data" (Imputation)
                imputer = SimpleImputer(strategy='mean')
                clean_array = imputer.fit_transform(numeric_df)
                
                # 2. PCA (2D Mapping for Frontend Visualization)
                scaler = StandardScaler()
                scaled_data = scaler.fit_transform(clean_array)
                pca = PCA(n_components=2)
                pca_result = pca.fit_transform(scaled_data)
                
                # Store first 500 points to keep JSON small
                ml_insights['pca_data'] = pca_result[:500].tolist() 
                ml_insights['explained_variance'] = pca.explained_variance_ratio_.tolist()

                # 3. Feature Importance (Random Forest)
                # Assumes the last numeric column is the 'Target' for discovery
                X = clean_array[:, :-1]
                y = clean_array[:, -1]
                
                if X.shape[1] > 0:
                    rf = RandomForestRegressor(n_estimators=20, random_state=42)
                    rf.fit(X, y)
                    
                    importances = dict(zip(numeric_df.columns[:-1], rf.feature_importances_.tolist()))
                    # Sort by importance descending
                    ml_insights['feature_importance'] = dict(
                        sorted(importances.items(), key=lambda x: x[1], reverse=True)
                    )

            except Exception as ml_err:
                ml_insights['error'] = f"ML processing failed: {str(ml_err)}"

        # 6. Final Save
        job.results = {**eda_results, "ml_insights": ml_insights}
        job.status = 'COMPLETED'
        job.save()

    except AnalysisJob.DoesNotExist:
        # Prevents error if job is deleted while in queue
        pass
    except Exception as e:
        # Global failure catch
        try:
            job.status = 'FAILED'
            job.results = {"error": str(e)}
            job.save()
        except:
            pass