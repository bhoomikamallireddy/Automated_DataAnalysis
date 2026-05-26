from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .tasks import generate_post_task

@api_view(['POST'])
def generate_social_post(request):
    client_id = request.data.get("client_id")
    idea = request.data.get('idea')
    platform = request.data.get('platform', 'General')
    persona = request.data.get('persona', 'technical') 
    if not idea:
        return Response({"error": "No idea provided"}, status=status.HTTP_400_BAD_REQUEST)

    # Trigger the Celery task (hand off to the worker)
    # .delay() returns an AsyncResult object immediately
    task = generate_post_task.delay(idea, platform, client_id, persona)

    # Return the task_id to the frontend
    return Response({
        "task_id": task.id,
        "status": "Processing",
        "message": "AI is generating your content in the background."
    }, status=status.HTTP_202_ACCEPTED)
    


