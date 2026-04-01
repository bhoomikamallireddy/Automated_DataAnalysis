from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from django_q.tasks import async_task
from rest_framework.views import APIView
from .serializers import RegisterSerializer
from .models import AnalysisJob
from .tasks import run_pipeline
from .serializers import AnalysisJobSerializer
from django.db import transaction

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








   
            