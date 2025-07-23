import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.users.models import User, Role, UserRole
from apps.invitations.models import Invitation
from apps.invitations.services import InvitationService


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_data():
    return {
        'email': 'test@example.com',
        'first_name': 'Test',
        'last_name': 'User',
        'phone_number': '+1234567890',
        'password': 'testpassword123',
        'password_confirm': 'testpassword123'
    }


@pytest.fixture
def patient_role():
    role, _ = Role.objects.get_or_create(
        name=Role.RoleChoices.PATIENT,
        defaults={'display_name': 'Пациент'}
    )
    return role


@pytest.fixture
def sensor_invitation():
    return InvitationService.create_sensor_activation_invitation()


@pytest.mark.django_db
class TestAuthentication:

    def test_login_success(self, api_client):
        # Создаем пользователя
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User'
        )

        # Тестируем успешный вход
        response = api_client.post(reverse('login'), {
            'email': 'test@example.com',
            'password': 'testpass123'
        })

        assert response.status_code == status.HTTP_200_OK
        assert 'access_token' in response.data
        assert 'user' in response.data
        assert response.data['user']['email'] == 'test@example.com'

    def test_login_invalid_credentials(self, api_client):
        response = api_client.post(reverse('login'), {
            'email': 'wrong@example.com',
            'password': 'wrongpass'
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_with_sensor_invitation(self, api_client, user_data, patient_role, sensor_invitation):
        user_data['invitation_token'] = str(sensor_invitation.token)

        response = api_client.post(reverse('register'), user_data)

        assert response.status_code == status.HTTP_201_CREATED
        assert 'access_token' in response.data

        # Проверяем, что пользователь создан с ролью PATIENT
        user = User.objects.get(email=user_data['email'])
        assert user.has_role(Role.RoleChoices.PATIENT)

        # Проверяем, что приглашение использовано
        sensor_invitation.refresh_from_db()
        assert sensor_invitation.status == Invitation.InvitationStatus.USED

    def test_register_without_invitation(self, api_client, user_data):
        response = api_client.post(reverse('register'), user_data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_logout_success(self, api_client):
        # Создаем и авторизуем пользователя
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User'
        )

        login_response = api_client.post(reverse('login'), {
            'email': 'test@example.com',
            'password': 'testpass123'
        })

        refresh_token = login_response.data['refresh_token']
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_response.data["access_token"]}')

        # Тестируем выход
        response = api_client.post(reverse('logout'), {
            'refresh_token': refresh_token
        })

        assert response.status_code == status.HTTP_200_OK
        assert 'message' in response.data