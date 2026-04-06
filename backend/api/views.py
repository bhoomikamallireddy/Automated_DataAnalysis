from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from django_q.tasks import async_task
from rest_framework.views import APIView
from .serializers import RegisterSerializer
from .models import AnalysisJob
from .tasks import run_pipeline
from .serializers import AnalysisJobSerializer
from django.db import transaction
from django.contrib.auth.forms import PasswordResetForm
from django.contrib.auth import get_user_model
from django.utils.http import urlsafe_base64_encode,urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from django.template.loader import render_to_string
from django.core.mail import send_mail
from django.conf import settings



User = get_user_model()

class RegisterView(APIView):
    # Allow anyone to sign up
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                "user_id": user.id,
                "message": "User created successfully. Please login to get your token."
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AnalysisJobViewSet(viewsets.ModelViewSet):
    # DRF uses this to determine the name of the route.
    queryset = AnalysisJob.objects.all()
    serializer_class = AnalysisJobSerializer
    
    def get_queryset(self):
        # Only return jobs belonging to the logged-in user
        return AnalysisJob.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Automatically set the file_name from the uploaded file
        file_obj = self.request.data.get('file')
        instance = serializer.save(user=self.request.user, file_name=file_obj.name)

        # Trigger the background task and return immediately!
        #Lets analysis handle asynchronously files
        transaction.on_commit(lambda: async_task(run_pipeline, instance.id))


class PasswordResetRequestView(APIView):
    
       # This line is the "Key" to fixing the 401 error
    permission_classes = [permissions.AllowAny] 

    def post(self, request):
        email = request.data.get('email')
        users = User.objects.filter(email=email)
        
        if users.exists():
            for user in users:
                # Generate UID and Token
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                token = default_token_generator.make_token(user)
                
                # Build the Link pointing to NEXT.JS
                reset_url = f"{settings.FRONTEND_URL}/password-reset-confirm/{uid}/{token}/"
                
                # Send the Email (or print to console)
                subject = "Reset your AutoEDA Password"
                message = f"""
                Hi {user.username},

                We received a request to reset your password for your AutoEDA account. 
                You can reset it by clicking the link below:

                {reset_url}

                This link will expire soon. If you did not request this change, please ignore this email.

                Best regards,
                The AutoEDA Team
                """
                
                send_mail(
                    subject, 
                    message, 
                    settings.EMAIL_HOST_USER, # Uses your Gmail address from settings
                    [user.email], 
                    fail_silently=False 
                )
            
            return Response({"detail": "Password reset link sent."}, status=status.HTTP_200_OK)
        
        # Security Note: We return 200 even if email isn't found to prevent "Email Harvesting"
        return Response({"detail": "If an account exists, a link was sent."}, status=status.HTTP_200_OK)
  
            
class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('new_password')

        try:
            # 1. Decode the UID to find the user
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
            
            # 2. Check if the token is valid for THIS user
            if default_token_generator.check_token(user, token):
                user.set_password(new_password)
                user.save()
                return Response({"detail": "Password has been reset."}, status=status.HTTP_200_OK)
            else:
                return Response({"detail": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)
        
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"detail": "Invalid request."}, status=status.HTTP_400_BAD_REQUEST)        