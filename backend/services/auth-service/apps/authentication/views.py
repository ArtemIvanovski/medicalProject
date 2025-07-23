from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model

from .serializers import (
    UserRegistrationSerializer,
    UserSerializer,
    CustomTokenObtainPairSerializer
)

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = UserRegistrationSerializer


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        refresh_token = request.data.get('refresh_token')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        return Response({'detail': 'Successfully logged out'}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_active_role(request):
    role_name = request.data.get('role_name')

    if not role_name:
        return Response({'error': 'Role name is required'}, status=status.HTTP_400_BAD_REQUEST)

    # Проверяем что у пользователя есть эта роль
    user_role_exists = request.user.userrole_set.filter(
        role__name=role_name,
        is_deleted=False
    ).exists()

    if not user_role_exists:
        return Response({'error': 'You do not have this role'}, status=status.HTTP_403_FORBIDDEN)

    # В реальном приложении можно сохранять активную роль в сессии или базе данных
    # Пока просто возвращаем успех
    return Response({'success': True, 'active_role': role_name}, status=status.HTTP_200_OK)