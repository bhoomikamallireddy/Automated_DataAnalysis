from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import AnalysisJobViewSet,RegisterView

router = DefaultRouter()
router.register(r'jobs', AnalysisJobViewSet, basename='analysisjob')

urlpatterns = [
    path('', include(router.urls)),
    # Login & Refresh
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/register/', RegisterView.as_view(), name='register'),
]


