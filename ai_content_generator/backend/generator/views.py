import os
from google import genai 
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from dotenv import load_dotenv
from django.shortcuts import render
from .models import GeneratedPost

load_dotenv() # Load your API key from a .env file


@api_view(['POST'])
def generate_social_post(request):
    print("!!! Request Received !!!")  
    print(f"Data: {request.data}")    
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    idea = request.data.get('idea')
    platform = request.data.get('platform', 'General')

    if not idea:
        return Response({"error": "No idea provided"}, status=status.HTTP_400_BAD_REQUEST)
    
    # The Prompt Engineering step
    prompt = f"""
    Act as an expert Social Media Strategist and Copywriter. 
    Your goal is to transform the following idea into a high-performing {platform} post.

    IDEA: {idea}

    PLATFORM RULES:
    1. Tone: Professional yet engaging and conversational.
    2. Format: Use the specific formatting style (line breaks, bullet points) typical for {platform}.
    3. Hook: Start with a strong opening line to grab attention.
    4. Call to Action: Include a subtle call to action at the end.
    5. Emojis/Hashtags: Use them naturally (not overused).

    Output only the final post content.
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite", # Use the latest model
            contents=prompt
        )
        ai_content = response.text
        # SAVE TO POSTGRESQL
        saved_post = GeneratedPost.objects.create(
            idea=idea,
            platform=platform,
            content=ai_content
        )
        return Response({
            "id": saved_post.id, # Useful for future "History" features
            "content": ai_content,
            "platform": platform
            }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    


