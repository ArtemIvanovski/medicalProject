import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models

from .validators import validate_hex_key


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


class Sensor(models.Model):
    SYNC_STATUS_CHOICES = [
        ('synchronized', 'Synchronized'),
        ('needs_sync', 'Needs Sync'),
        ('syncing', 'Syncing'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    serial_number = models.CharField(max_length=255, unique=True)
    name = models.CharField(max_length=255, blank=True, default="")
    secret_key = models.CharField(
        max_length=64,
        default="",
        validators=[validate_hex_key],
        help_text="Hex-encoded 32-byte secret key"
    )
    user = models.ForeignKey('glucose_monitor.User', on_delete=models.SET_NULL, null=True, blank=True)
    active = models.BooleanField(default=True)  # Изменено с is_active на active
    time_active = models.DateTimeField(null=True, blank=True)
    timelife = models.TimeField(null=True, blank=True)
    time_deactive = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    last_request = models.DateTimeField(null=True, blank=True)
    request_counter = models.BigIntegerField(default=0)
    
    # Новые поля для улучшенной безопасности
    nonce_window_start = models.BigIntegerField(default=0, help_text="Начальное значение текущего окна nonce")
    nonce_window_size = models.IntegerField(default=1000, help_text="Размер окна nonce")
    last_sync_timestamp = models.BigIntegerField(default=0, help_text="Последняя синхронизация времени с устройством")
    device_clock_offset = models.IntegerField(default=0, help_text="Смещение часов устройства (секунды)")
    sync_status = models.CharField(max_length=20, choices=SYNC_STATUS_CHOICES, default='synchronized')
    
    claim_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    claim_used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'main_app_sensor'

    def __str__(self):
        return f"{self.serial_number} ({'active' if self.active else 'inactive'})"
    
    # Добавляем свойство для обратной совместимости
    @property
    def is_active(self):
        return self.active
    
    @is_active.setter
    def is_active(self, value):
        self.active = value


class GlucoseData(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE, related_name='measurements')
    value = models.FloatField(
        validators=[
            MinValueValidator(0.1),
            MaxValueValidator(33.3)
        ]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        db_table = 'main_app_sensordata'  # Исправлено название таблицы
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.sensor.serial_number} - {self.value} mmol/L at {self.created_at}"


class SensorSettings(models.Model):
    POLLING_MINUTE_CHOICES = [(i, f"{i} min") for i in range(1, 31)]

    sensor = models.OneToOneField(Sensor, on_delete=models.CASCADE, related_name='settings')
    battery_level = models.PositiveSmallIntegerField(default=100, validators=[MinValueValidator(0), MaxValueValidator(100)])
    low_glucose_threshold = models.FloatField(default=3.9, validators=[MinValueValidator(0.1), MaxValueValidator(33.3)])
    high_glucose_threshold = models.FloatField(default=7.8, validators=[MinValueValidator(0.1), MaxValueValidator(33.3)])
    polling_interval_minutes = models.IntegerField(choices=POLLING_MINUTE_CHOICES, default=5)
    activation_time = models.DateTimeField(null=True, blank=True)
    expiration_time = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'main_app_sensor_settings'

    def __str__(self):
        return f"Settings for {self.sensor.serial_number}"


class SensorNonceTracking(models.Model):
    """Отслеживание использованных nonce для защиты от replay-атак"""
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE, related_name='nonce_tracking')
    nonce_value = models.BigIntegerField()
    used_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = 'main_app_sensor_nonce_tracking'
        unique_together = [['sensor', 'nonce_value']]
        indexes = [
            models.Index(fields=['sensor', 'nonce_value']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f"Nonce {self.nonce_value} for {self.sensor.serial_number}"

    @classmethod
    def cleanup_expired(cls):
        """Удаление истёкших nonce"""
        from django.utils import timezone
        return cls.objects.filter(expires_at__lt=timezone.now()).delete()


class SensorBatchData(models.Model):
    """Хранение накопленных данных для batch-обработки"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE, related_name='batch_data')
    encrypted_payload = models.TextField(help_text="Зашифрованные данные измерений")
    measurements_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    is_processed = models.BooleanField(default=False)

    class Meta:
        db_table = 'main_app_sensor_batch_data'
        indexes = [
            models.Index(fields=['sensor', 'is_processed', 'created_at']),
        ]

    def __str__(self):
        status = "Processed" if self.is_processed else "Pending"
        return f"Batch for {self.sensor.serial_number} ({self.measurements_count} measurements) - {status}"

    def mark_processed(self):
        """Отметить batch как обработанный"""
        from django.utils import timezone
        self.is_processed = True
        self.processed_at = timezone.now()
        self.save()
