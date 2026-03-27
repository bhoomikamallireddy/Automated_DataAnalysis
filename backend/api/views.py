from rest_framework import viewsets, status
from rest_framework.response import Response
from django_q.tasks import async_task
from .models import AnalysisJob
from .tasks import run_pipeline
from .serializers import AnalysisJobSerializer
from django.db import transaction

class AnalysisJobViewSet(viewsets.ModelViewSet):
    queryset = AnalysisJob.objects.all()
    serializer_class = AnalysisJobSerializer

    def perform_create(self, serializer):
        # Automatically set the file_name from the uploaded file
        file_obj = self.request.data.get('file')
        instance = serializer.save(file_name=file_obj.name)

        # Trigger the background task and return immediately!
        #Lets analysis handle asynchronously files
        transaction.on_commit(lambda: async_task(run_pipeline, instance.id))
    
            