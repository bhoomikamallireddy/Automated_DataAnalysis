from rest_framework import serializers
from .models import AnalysisJob

class AnalysisJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisJob
        # We include all fields so the frontend can see the ID, status, and results
        fields = '__all__'
        
    # Validation example: Ensure the uploaded file is actually a CSV
    def validate_file(self, value): 
        if not value.name.endswith('.csv'):
            raise serializers.ValidationError("Only CSV files are allowed.")
        return value