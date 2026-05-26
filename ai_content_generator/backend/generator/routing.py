from django.urls import re_path
from .consumers import PostConsumer

websocket_urlpatterns = [
    re_path(r'^ws/generate/(?P<client_id>[\w-]+)/$', PostConsumer.as_asgi()),
]
