from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.CustomTokenObtainPairView.as_view(), name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('refresh/', TokenRefreshView.as_view(), name='refresh'),
    path('set-active-role/', views.set_active_role, name='set-active-role'),
    path('me/', views.UserProfileView.as_view(), name='user-profile'),
]