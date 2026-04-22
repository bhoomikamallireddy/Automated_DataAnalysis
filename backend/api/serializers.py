from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import AnalysisJob

User = get_user_model()

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)  

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'confirm_password')
    
        def validate_password(self, value):
          """
        Run Django's built-in AUTH_PASSWORD_VALIDATORS against the raw password.
        This enforces:
          - Minimum length of 8 (set via min_length above AND MinimumLengthValidator)
          - Not too common  (CommonPasswordValidator checks 20,000 common passwords)
          - Not entirely numeric (NumericPasswordValidator)
          - Not too similar to username/email (UserAttributeSimilarityValidator)
        All four validators are already wired up in settings.py AUTH_PASSWORD_VALIDATORS.
          """
          try:
            validate_password(value)
          except DjangoValidationError as e:
            # Forward Django's human-readable messages straight to the API response
            raise serializers.ValidationError(list(e.messages))
          return value
    
    def validate(self, data):
        """Cross-field check: both password fields must match."""
        if data.get('password') != data.get('confirm_password'):
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )
        return data
    
    def create(self, validated_data):
        # confirm_password is not a model field — strip it before hitting the DB
        validated_data.pop('confirm_password')
        # Using create_user ensures the password is automatically hashed
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user

class AnalysisJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisJob
        # We include all fields so the frontend can see the ID, status, and results
        fields = '__all__'
        read_only_fields = ['user', 'status', 'results']
        #Make file_name optional in the request since we set it in the view
        extra_kwargs = {'file_name': {'required': False}}
        
    # Validation example: Ensure the uploaded file is actually a CSV
    def validate_file(self, value): 
        if not value.name.lower().endswith('.csv'):
            raise serializers.ValidationError("Only CSV files are allowed.")
        # 2. MIME type check (Fast & adds a layer of security)
        # 'application/vnd.ms-excel' is often sent by Windows for CSVs
        valid_mime_types = ['text/csv', 'application/vnd.ms-excel', 'text/plain']
        if value.content_type not in valid_mime_types:
            raise serializers.ValidationError("Unsupported file format.")
        limit = 200 * 1024 * 1024 # 200 Megabytes
        if value.size > limit:
            raise serializers.ValidationError("File too large. Size should not exceed 200MB.")
        
        return value