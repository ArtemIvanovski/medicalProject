import uuid
from datetime import timedelta
from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


def default_expires():
    return timezone.now() + timedelta(hours=48)


class Feature(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'main_app_feature'

    def __str__(self):
        return self.name


class Invite(models.Model):
    class Kind(models.TextChoices):
        SENSOR = "SENSOR_ACTIVATE", "Sensor activate"
        DOCTOR = "DOCTOR", "Doctor"
        TRUSTED = "TRUSTED", "Trusted person"

    token = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=default_expires)
    used = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)

    created_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="invites_sent"
    )
    patient = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name="invites_to_me", null=True, blank=True
    )

    message = models.TextField(blank=True)
    features = models.ManyToManyField('Feature', blank=True)

    class Meta:
        db_table = 'main_app_invite'

    def role_name(self) -> str:
        return {
            self.Kind.SENSOR: "PATIENT",
            self.Kind.DOCTOR: "DOCTOR",
            self.Kind.TRUSTED: "TRUSTED_PERSON",
        }[self.kind]

    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"{self.get_kind_display()}‑invite {self.token}"