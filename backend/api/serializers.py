from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import AnalysisJob

User = get_user_model()

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password')

    def create(self, validated_data):
        # Using create_user ensures the password is automatically hashed
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user
    def validate(self, data):
        # Note: You'd need to include confirmPassword in your fields 
        # or handle it via the request context if you want to validate matching on backend.
        return data

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