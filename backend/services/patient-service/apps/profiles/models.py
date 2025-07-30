import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
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


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    patronymic = models.CharField(max_length=150, blank=True, null=True)
    birth_date = models.DateField(blank=True, null=True)
    phone_number = models.CharField(max_length=255, blank=True, null=True)
    avatar_drive_id = models.CharField(max_length=128, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    class Meta:
        db_table = 'main_app_user'

    def __str__(self):
        return self.email

    def has_perm(self, perm, obj=None):
        return True

    def has_module_perms(self, app_label):
        return True

    @property
    def is_anonymous(self):
        return False

    @property
    def is_authenticated(self):
        return True


class Gender(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        db_table = 'main_app_gender'

    def __str__(self):
        return self.name


class BloodType(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=10, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'main_app_bloodtype'

    def __str__(self):
        return self.name


class Allergy(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255, unique=True)

    class Meta:
        db_table = 'main_app_allergy'

    def __str__(self):
        return self.name


class Diagnosis(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255, unique=True)

    class Meta:
        db_table = 'main_app_diagnosis'

    def __str__(self):
        return self.name


class DiabetesType(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'main_app_diabetestype'

    def __str__(self):
        return self.name


class Address(models.Model):
    id = models.BigAutoField(primary_key=True)
    city = models.CharField(max_length=255)
    country = models.CharField(max_length=255)
    formatted = models.CharField(max_length=512)
    latitude = models.FloatField()
    longitude = models.FloatField()
    postcode = models.CharField(max_length=20, blank=True, null=True)
    street = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        db_table = 'main_app_address'
        unique_together = ['latitude', 'longitude']

    def __str__(self):
        return self.formatted


class UserProfile(models.Model):
    id = models.BigAutoField(primary_key=True)
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
        db_table = 'main_app_userprofile'

    def __str__(self):
        return f"Profile of {self.user.email}"


class Feature(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'main_app_feature'

    def __str__(self):
        return self.name


class DoctorPatient(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    doctor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='patients')
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='doctors')
    created_at = models.DateTimeField(auto_now_add=True)
    is_deleted = models.BooleanField(default=False)
    features = models.ManyToManyField(Feature, blank=True)

    class Meta:
        db_table = 'main_app_doctorpatient'

    def __str__(self):
        return f"{self.doctor.email} -> {self.patient.email}"


class TrustedUser(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trusted = models.ForeignKey(User, on_delete=models.CASCADE, related_name='trusted_patients')
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='trusted_persons')
    created_at = models.DateTimeField(auto_now_add=True)
    is_deleted = models.BooleanField(default=False)
    features = models.ManyToManyField(Feature, blank=True)

    class Meta:
        db_table = 'main_app_trusteduser'

    def __str__(self):
        return f"{self.trusted.email} -> {self.patient.email}"


class Invite(models.Model):
    class Kind(models.TextChoices):
        SENSOR = "SENSOR_ACTIVATE", "Sensor activate"
        DOCTOR = "DOCTOR", "Doctor"
        TRUSTED = "TRUSTED", "Trusted person"

    token = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    message = models.TextField(blank=True)

    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="invites_sent")
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="invites_to_me", null=True, blank=True)
    features = models.ManyToManyField(Feature, blank=True)

    class Meta:
        db_table = 'main_app_invite'

    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"{self.get_kind_display()}-invite {self.token}"
