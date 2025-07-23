from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'patronymic',
                  'birth_date', 'phone_number', 'password', 'password_confirm']


class UserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()
    role_data = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'patronymic',
                  'birth_date', 'phone_number', 'is_active', 'full_name', 'roles', 'role_data']
        read_only_fields = ['id']

    def get_roles(self, obj):
        return [ur.role.name for ur in obj.userrole_set.filter(is_deleted=False)]

    def get_role_data(self, obj):
        user_roles = obj.userrole_set.filter(is_deleted=False).select_related('role')

        role_data_list = []
        preferred_order = ["PATIENT", "DOCTOR", "TRUSTED_PERSON", "ADMIN"]

        for user_role in user_roles:
            role_name = user_role.role.name
            fake_notifications = 20 if role_name == "PATIENT" else 3
            fake_messages = 0 if role_name == "TRUSTED_PERSON" else 15

            role_data_list.append({
                'name': role_name,
                'display_name': self._get_role_display_name(role_name),
                'icon': self._get_role_icon(role_name),
                'notifications': fake_notifications,
                'messages': fake_messages
            })

        def sort_key(item):
            r_name = item['name']
            if r_name in preferred_order:
                return preferred_order.index(r_name)
            return 999

        role_data_list.sort(key=sort_key)
        return role_data_list

    def get_full_name(self, obj):
        parts = [obj.first_name, obj.last_name]
        if obj.patronymic:
            parts.insert(1, obj.patronymic)
        return ' '.join(filter(None, parts))

    def _get_role_display_name(self, role_name):
        role_names = {
            'PATIENT': 'Пациента',
            'DOCTOR': 'Врача',
            'TRUSTED_PERSON': 'Доверенное лицо',
            'ADMIN': 'Администратор'
        }
        return role_names.get(role_name, role_name)

    def _get_role_icon(self, role_name):
        role_icons = {
            'PATIENT': 'fa-heartbeat',
            'DOCTOR': 'fa-user-md',
            'TRUSTED_PERSON': 'fa-user',
            'ADMIN': 'fa-ambulance'
        }
        return role_icons.get(role_name, 'fa-user')


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)

        user_data = UserSerializer(self.user).data

        # Получаем роли пользователя из связанной таблицы
        user_roles = self.user.userrole_set.filter(is_deleted=False).select_related('role')

        role_data_list = []
        preferred_order = ["PATIENT", "DOCTOR", "TRUSTED_PERSON", "ADMIN"]

        for user_role in user_roles:
            role_name = user_role.role.name
            fake_notifications = 20 if role_name == "PATIENT" else 3
            fake_messages = 0 if role_name == "TRUSTED_PERSON" else 15

            role_data_list.append({
                'name': role_name,
                'display_name': self.get_role_display_name(role_name),
                'icon': self.get_role_icon(role_name),
                'notifications': fake_notifications,
                'messages': fake_messages
            })

        # Сортируем роли по приоритету
        def sort_key(item):
            r_name = item['name']
            if r_name in preferred_order:
                return preferred_order.index(r_name)
            return 999

        role_data_list.sort(key=sort_key)

        user_data['roles'] = [role['name'] for role in role_data_list]
        data['user'] = user_data
        data['role_data'] = role_data_list
        data['needs_role_selection'] = len(role_data_list) > 1

        return data

    def get_role_display_name(self, role_name):
        role_names = {
            'PATIENT': 'Пациента',
            'DOCTOR': 'Врача',
            'TRUSTED_PERSON': 'Доверенное лицо',
            'ADMIN': 'Администратор'
        }
        return role_names.get(role_name, role_name)

    def get_role_icon(self, role_name):
        role_icons = {
            'PATIENT': 'fa-heartbeat',
            'DOCTOR': 'fa-user-md',
            'TRUSTED_PERSON': 'fa-user',
            'ADMIN': 'fa-ambulance'
        }
        return role_icons.get(role_name, 'fa-user')
