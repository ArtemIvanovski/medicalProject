import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.db import models


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
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    patronymic = models.CharField(max_length=150, blank=True, null=True)
    birth_date = models.DateField(blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    avatar_drive_id = models.CharField(max_length=128, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.email


class Gender(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        db_table = 'genders'

    def __str__(self):
        return self.name


class BloodType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=10, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'blood_types'

    def __str__(self):
        return self.name


class Allergy(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)

    class Meta:
        db_table = 'allergies'

    def __str__(self):
        return self.name


class Diagnosis(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)

    class Meta:
        db_table = 'diagnoses'

    def __str__(self):
        return self.name


class DiabetesType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'diabetes_types'

    def __str__(self):
        return self.name


class Address(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    city = models.CharField(max_length=255)
    country = models.CharField(max_length=255)
    formatted = models.CharField(max_length=512)
    latitude = models.FloatField()
    longitude = models.FloatField()
    postcode = models.CharField(max_length=20, blank=True, null=True)
    street = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        db_table = 'addresses'
        unique_together = ['latitude', 'longitude']

    def __str__(self):
        return self.formatted


class UserProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    gender = models.ForeignKey(Gender, on_delete=models.SET_NULL, null=True, blank=True)
    blood_type = models.ForeignKey(BloodType, on_delete=models.SET_NULL, null=True, blank=True)
    address_home = models.ForeignKey(Address, on_delete=models.SET_NULL, null=True, blank=True)
    allergies = models.ManyToManyField(Allergy, blank=True)
    diagnoses = models.ManyToManyField(Diagnosis, blank=True)
    height = models.FloatField(null=True, blank=True)
    weight = models.FloatField(null=True, blank=True)
    waist_circumference = models.FloatField(null=True, blank=True)
    diabetes_type = models.ForeignKey(DiabetesType, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'user_profiles'

    def __str__(self):
        return f"Profile of {self.user.email}"
