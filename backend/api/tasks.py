import pandas as pd
import numpy as np
from scipy import stats
from .models import AnalysisJob

def run_pipeline(job_id):
    # 1. Find the job
    try:
        job = AnalysisJob.objects.get(id=job_id)
        job.status = 'PROCESSING'
        job.save()
        print(f"Starting analysis for Job: {job_id}")
        # 1. Load Data
        df = pd.read_csv(job.file.path)
        
        # 2. Basic Metadata
        metadata = {
            "row_count": int(df.shape[0]),
            "column_count": int(df.shape[1]),
            "missing_values": df.isnull().sum().to_dict()
        }

        # 3. Statistical Summary (.describe())
        # We only run this on numerical columns
        numeric_df = df.select_dtypes(include=[np.number])
        stats_summary = numeric_df.describe().to_dict()

        # 4. Correlation Matrix
        # Convert to dict for JSON storage
        correlation = numeric_df.corr().to_dict()

        # 5. Outlier Detection (Z-score logic)
        outliers = {}
        for col in numeric_df.columns:
            # Calculate Z-scores
            z_scores = np.abs(stats.zscore(df[col].dropna()))
            # Identify where Z > 3 (standard outlier threshold)
            outlier_count = int(np.sum(z_scores > 3))
            outliers[col] = outlier_count

        # 6. Final Results Compilation
        job.results = {
            "metadata": metadata,
            "statistics": stats_summary,
            "correlations": correlation,
            "outliers": outliers,
            "column_types": df.dtypes.astype(str).to_dict()
        }
        # 3. Mark as complete
        job.status = 'COMPLETED'
        job.save()

    except Exception as e:
        job.status = 'FAILED'
        job.results = {"error": str(e)}
        job.save()
        print(f"Job {job_id} finished successfully.")

        
    except AnalysisJob.DoesNotExist:
        print(f"Job {job_id} was not found.")
        
        
       
