from django.db import models
import uuid

class AnalysisJob(models.Model):
    # UUID makes our API look professional and secure
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # File details
    file_name = models.CharField(max_length=255)
    file = models.FileField(upload_to='uploads/')
    
    # Status tracking for our background worker
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    # Results will be stored as a JSON object (EDA summary, stats, etc.)
    results = models.JSONField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.file_name} - {self.status}"

    class Meta:
        db_table = 'analysis_jobs'
        ordering = ['-created_at']