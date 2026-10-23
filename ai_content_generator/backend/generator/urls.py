from django.urls import path
from .views import generate_social_post

urlpatterns = [
    path('generate/', generate_social_post, name='generate_post'),
]