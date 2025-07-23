from __future__ import annotations

import uuid
from datetime import datetime

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.urls import reverse


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email обязателен')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if not password:
            raise ValueError('Пароль обязателен для суперпользователя')
        return self.create_user(email, password, **extra_fields)


class Role(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        db_table = 'main_app_role'

    def __str__(self):
        return self.name


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    patronymic = models.CharField(max_length=150, blank=True, null=True)
    birth_date = models.DateField(default=datetime.now, null=True, blank=True)
    phone_number = models.CharField(max_length=255, blank=True, null=True)
    avatar_drive_id = models.CharField(max_length=128, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)

    roles = models.ManyToManyField('Role', through='UserRole', related_name='users')

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name', 'birth_date']

    def __str__(self):
        return self.email

    @property
    def avatar_proxy_url(self):
        if not self.avatar_drive_id:
            return None
        return reverse('avatar_proxy', args=[self.avatar_drive_id])

    class Meta:
        db_table = 'main_app_user'


class UserRole(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        db_table = 'main_app_userrole'

    def __str__(self):
        return f"{self.user} - {self.role}"