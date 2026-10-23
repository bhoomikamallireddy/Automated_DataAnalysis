import os
import asyncio
from celery import shared_task
from openai import AsyncOpenAI
from .models import GeneratedPost
from dotenv import load_dotenv
from channels.layers import get_channel_layer

# Load keys safely
load_dotenv()
PERSONA_PROMPTS = {
    "technical": """
    TONE & STYLE: Deeply technical, authoritative, precise, and educational.
    STRUCTURE: Skip general summaries or introductory fluff. Start with a direct engineering insight, code structural fact, or problem statement. Focus on architectural design efficiency and optimization.
    """,
    "viral_hype": """
    TONE & STYLE: Exceptionally high-energy, captivating, dramatic, and punchy.
    STRUCTURE: Open with an irresistible, pattern-interrupting hook line. Keep layout sentences short (maximum 1 line) to encourage rapid scanning and reading. Use bold typography statements, highly selective formatting emojis, and close with a viral call to action.
    """,
    "corporate": """
    TONE & STYLE: Professional, strategic, polished, and thought-leadership oriented.
    STRUCTURE: Write clearly from the perspective of an industry founder, executive, or manager. Frame technical topics around core value propositions, product scaling metrics, or business impact.
    """,
    "sassy": """
    TONE & STYLE: Bold, witty, slightly sarcastic, and entertaining yet insightful.
    STRUCTURE: Begin with a dramatic hot take or a highly relatable development frustration. Use conversational phrasing, smart humor, and light irony while still packing genuine value.
    """
}

@shared_task(name="generator.tasks.generate_post_task")
def generate_post_task(idea, platform, client_id, persona):
    """
    Non-blocking Celery task that streams individual text tokens
    from Groq directly down the active WebSocket connection channel.
    """
    
    async def run_async_workflow():
        client = AsyncOpenAI(
            api_key=os.getenv("XAI_API_KEY"),
            base_url="https://api.groq.com/openai/v1"
        )
        style_instructions = PERSONA_PROMPTS.get(persona, PERSONA_PROMPTS["technical"])
 
        prompt = f"""
        Act as an expert Social Media Strategist and Copywriter .Follow these style guidelines:
        {style_instructions}
 
        ASSIGNMENT:
        Transform the core idea provided below into a high-performing {platform}  post.

        IDEA: {idea}
        PLATFORM RULES:
        1. Apply native posting conventions of {platform} (e.g., character limits, hashtag density, emoji usage, link placement).
        2. Tone: Professional yet engaging.
        3. Format: Use line breaks and bullet points typical for {platform}.
        4. Hook: Strong opening line.
        5. Call to Action: Subtle CTA at the end.
        6. Emojis/Hashtags: Use naturally.
        
        CORE CONSTRAINTS:
        1. Respect the style guidelines above.
        2. Adjust structural rules natively to complement common formatting guidelines unique to {platform} (e.g. appropriate link formatting or layout structure).
        3. Output ONLY the final post content. Do not include introductory notes, chat confirmations, or tags.
        """

        channel_layer = get_channel_layer()

        # 1. Initiate the chunked model connection stream
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile", 
            messages=[{"role": "user", "content": prompt}],
            stream=True  # <--- CRITICAL: Enables token chunking from Groq
        )

        full_content_accumulator = []

        # 2. Iterate through incoming tokens as they arrive over the network
        async for chunk in response:
            token = chunk.choices[0].delta.content or ""
            if token:
                full_content_accumulator.append(token)
                
                # Push the single token directly out to the user's browser view
                await channel_layer.group_send(
                    f"post_generation_{client_id}",
                    {
                        "type": "send_token_stream",
                        "token": token,
                        "status": "Streaming"
                    }
                )

        final_compiled_content = "".join(full_content_accumulator)

        # 3. Async Database Write: Save complete post to PostgreSQL
        saved_post = await GeneratedPost.objects.acreate(
            idea=idea,
            platform=platform,
            content=final_compiled_content
        )

        # 4. Notify the client that the generation cycle has finished
        await channel_layer.group_send(
            f"post_generation_{client_id}",
            {
                "type": "send_post_update",
                "content": final_compiled_content,
                "status": "Completed"
            }
        )
        
        return saved_post.id, final_compiled_content

    post_id, final_content = asyncio.run(run_async_workflow())

    return {
        "id": post_id,
        "status": "Streaming Sequence Complete"
    }