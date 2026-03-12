from rest_framework import serializers
from .models import AnalysisJob

class AnalysisJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisJob
        # We include all fields so the frontend can see the ID, status, and results
        fields = '__all__'
        #Make file_name optional in the request since we set it in the view
        extra_kwargs = {'file_name': {'required': False}}
        
    # Validation example: Ensure the uploaded file is actually a CSV
    def validate_file(self, value): 
        if not value.name.endswith('.csv'):
            raise serializers.ValidationError("Only CSV files are allowed.")
        limit = 200 * 1024 * 1024 # 200 Megabytes
        if value.size > limit:
            raise serializers.ValidationError("File too large. Size should not exceed 200MB.")
        
        return value