from rest_framework import viewsets, status
from rest_framework.response import Response
from .models import AnalysisJob
from .serializers import AnalysisJobSerializer

class AnalysisJobViewSet(viewsets.ModelViewSet):
    queryset = AnalysisJob.objects.all()
    serializer_class = AnalysisJobSerializer

    def perform_create(self, serializer):
        # Automatically set the file_name from the uploaded file
        file_obj = self.request.data.get('file')
        serializer.save(file_name=file_obj.name)
        