import json
from channels.generic.websocket import AsyncWebsocketConsumer

class PostConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.client_id = self.scope['url_route']['kwargs'].get('client_id')
        self.group_name =  f"post_generation_{self.client_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # Catches single character tokens and forwards them instantly to the client
    async def send_token_stream(self, event):
        await self.send(text_data=json.dumps({
            'token': event.get('token', ''),
            'status': 'Streaming'
        }))

    # Triggered once the background task has compiled and saved the layout block
    async def send_post_update(self, event):
        await self.send(text_data=json.dumps({
            'content': event.get('content', ''),
            'status': 'Completed'
        }))