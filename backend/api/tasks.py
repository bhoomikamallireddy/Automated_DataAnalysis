import time
from .models import AnalysisJob

def run_pipeline(job_id):
    # 1. Find the job
    try:
        job = AnalysisJob.objects.get(id=job_id)
        job.status = 'PROCESSING'
        job.save()

        # 2. Simulate heavy work (The 10-second sleep)
        print(f"Starting analysis for Job: {job_id}")
        time.sleep(20) 
        
        # 3. Mark as complete
        job.status = 'COMPLETED'
        job.results = {"message": "Dummy analysis complete!", "time_spent": "10s"}
        job.save()
        print(f"Job {job_id} finished successfully.")

    except AnalysisJob.DoesNotExist:
        print(f"Job {job_id} was not found.")