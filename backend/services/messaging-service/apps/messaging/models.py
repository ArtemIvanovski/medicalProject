import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
from cryptography.fernet import Fernet
from django.conf import settings


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


class Chat(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participants = models.ManyToManyField(User, related_name='chats')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        db_table = 'messaging_chat'
        ordering = ['-updated_at']

    def __str__(self):
        return f"Chat {self.id}"

    @property
    def last_message(self):
        return self.messages.filter(is_deleted=False).first()


class Message(models.Model):
    MESSAGE_TYPES = [
        ('text', 'Text'),
        ('image', 'Image'),
        ('video', 'Video'),
        ('file', 'File'),
        ('voice', 'Voice'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPES, default='text')
    content = models.TextField(blank=True)
    encrypted_content = models.TextField(blank=True)

    sent_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    is_edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    is_deleted_for_everyone = models.BooleanField(default=False)

    reply_to = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    forwarded_from = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name='forwards')

    class Meta:
        db_table = 'messaging_message'
        ordering = ['-sent_at']

    def __str__(self):
        return f"Message {self.id} from {self.sender.email}"

    def can_edit(self):
        return timezone.now() - self.sent_at <= timezone.timedelta(hours=24)

    def can_delete_for_everyone(self):
        return timezone.now() - self.sent_at <= timezone.timedelta(hours=24)

    def encrypt_content(self, content):
        if not content:
            return ''

        key = settings.MESSAGE_ENCRYPTION_KEY.encode()
        f = Fernet(key)
        return f.encrypt(content.encode()).decode()

    def decrypt_content(self):
        if not self.encrypted_content:
            return self.content

        try:
            key = settings.MESSAGE_ENCRYPTION_KEY.encode()
            f = Fernet(key)
            return f.decrypt(self.encrypted_content.encode()).decode()
        except:
            return self.content

    def save(self, *args, **kwargs):
        if self.content and not self.encrypted_content:
            self.encrypted_content = self.encrypt_content(self.content)
            self.content = ''
        super().save(*args, **kwargs)


class MessageAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='attachments')
    file_name = models.CharField(max_length=255)
    file_size = models.BigIntegerField()
    mime_type = models.CharField(max_length=100)
    drive_file_id = models.CharField(max_length=255)
    thumbnail_drive_id = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'messaging_attachment'

    def __str__(self):
        return f"Attachment {self.file_name} for message {self.message.id}"


class MessageStatus(models.Model):
    STATUS_CHOICES = [
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('read', 'Read'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='statuses')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'messaging_status'
        unique_together = ['message', 'user', 'status']

    def __str__(self):
        return f"{self.user.email} {self.status} message {self.message.id}"


class UserDeletedMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    message = models.ForeignKey(Message, on_delete=models.CASCADE)
    deleted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'messaging_user_deleted'
        unique_together = ['user', 'message']

    def __str__(self):
        return f"{self.user.email} deleted message {self.message.id}"