import io
import mimetypes
import os
from PIL import Image
from django.conf import settings
from django.db.models import Q
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload
from googleapiclient.errors import HttpError
from .models import User, Feature, DoctorPatient, TrustedUser, Chat, Message, MessageStatus

SERVICE_FILE = os.path.join(settings.BASE_DIR, "gservice_account.json")
SCOPES = ["https://www.googleapis.com/auth/drive"]
FILES_FOLDER_ID = "1wrDo0zfyr9Soa8UEJMfYuvK3pbZtURn8"


class DriveService:
    def __init__(self):
        self._service = None

    def get_service(self):
        if not self._service:
            creds = service_account.Credentials.from_service_account_file(
                SERVICE_FILE, scopes=SCOPES
            )
            self._service = build("drive", "v3", credentials=creds)
        return self._service

    def upload_file(self, file, filename=None):
        if not filename:
            filename = file.name

        mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        file_content = file.read()
        media = MediaIoBaseUpload(io.BytesIO(file_content), mimetype=mime_type)

        try:
            result = self.get_service().files().create(
                body={"name": filename, "parents": [FILES_FOLDER_ID]},
                media_body=media,
                fields="id"
            ).execute()

            self.get_service().permissions().create(
                fileId=result["id"],
                body={"type": "anyone", "role": "reader"}
            ).execute()

            return result["id"]
        except HttpError as e:
            raise Exception(f"Failed to upload file: {str(e)}")

    def create_thumbnail(self, file, max_size=(200, 200)):
        try:
            image = Image.open(file)
            image.thumbnail(max_size, Image.Resampling.LANCZOS)

            thumbnail_io = io.BytesIO()
            image.save(thumbnail_io, format='JPEG', quality=85)
            thumbnail_io.seek(0)

            media = MediaIoBaseUpload(thumbnail_io, mimetype='image/jpeg')

            result = self.get_service().files().create(
                body={"name": f"thumb_{file.name}", "parents": [FILES_FOLDER_ID]},
                media_body=media,
                fields="id"
            ).execute()

            self.get_service().permissions().create(
                fileId=result["id"],
                body={"type": "anyone", "role": "reader"}
            ).execute()

            return result["id"]
        except Exception:
            return None

    def get_file_content(self, file_id):
        try:
            request = self.get_service().files().get_media(fileId=file_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                status, done = downloader.next_chunk()
            fh.seek(0)
            return fh.read()
        except HttpError as e:
            if e.resp.status == 404:
                raise Exception("File not found")
            raise Exception(f"Failed to get file: {str(e)}")

    def delete_file(self, file_id):
        if not file_id:
            return
        try:
            self.get_service().files().delete(fileId=file_id).execute()
        except HttpError as e:
            if e.resp.status != 404:
                raise Exception(f"Failed to delete file: {str(e)}")


class PermissionService:
    @staticmethod
    def can_send_message(sender, recipient):
        if sender == recipient:
            return False

        send_message_feature = Feature.objects.filter(code='SEND_MESSAGE').first()
        if not send_message_feature:
            return False

        doctor_patient_relation = DoctorPatient.objects.filter(
            Q(doctor=sender, patient=recipient) | Q(doctor=recipient, patient=sender),
            is_deleted=False,
            features=send_message_feature
        ).exists()

        if doctor_patient_relation:
            return True

        trusted_relation = TrustedUser.objects.filter(
            Q(trusted=sender, patient=recipient) | Q(trusted=recipient, patient=sender),
            is_deleted=False,
            features=send_message_feature
        ).exists()

        return trusted_relation

    @staticmethod
    def get_allowed_contacts(user):
        send_message_feature = Feature.objects.filter(code='SEND_MESSAGE').first()
        if not send_message_feature:
            return User.objects.none()

        doctor_contacts = []
        trusted_contacts = []

        doctor_relations = DoctorPatient.objects.filter(
            Q(doctor=user) | Q(patient=user),
            is_deleted=False,
            features=send_message_feature
        ).select_related('doctor', 'patient')

        for relation in doctor_relations:
            contact = relation.patient if relation.doctor == user else relation.doctor
            doctor_contacts.append(contact.id)

        trusted_relations = TrustedUser.objects.filter(
            Q(trusted=user) | Q(patient=user),
            is_deleted=False,
            features=send_message_feature
        ).select_related('trusted', 'patient')

        for relation in trusted_relations:
            contact = relation.patient if relation.trusted == user else relation.trusted
            trusted_contacts.append(contact.id)

        contact_ids = list(set(doctor_contacts + trusted_contacts))
        return User.objects.filter(id__in=contact_ids, is_deleted=False)


class ChatService:
    @staticmethod
    def get_or_create_chat(user1, user2):
        existing_chat = Chat.objects.filter(
            participants=user1,
            is_deleted=False
        ).filter(
            participants=user2
        ).first()

        if existing_chat:
            return existing_chat

        chat = Chat.objects.create()
        chat.participants.add(user1, user2)
        return chat

    @staticmethod
    def mark_messages_as_read(chat, user):
        unread_messages = Message.objects.filter(
            chat=chat,
            is_deleted=False,
            is_deleted_for_everyone=False
        ).exclude(
            sender=user
        ).exclude(
            statuses__user=user,
            statuses__status='read'
        )

        for message in unread_messages:
            MessageStatus.objects.get_or_create(
                message=message,
                user=user,
                status='read'
            )

    @staticmethod
    def get_user_chats(user):
        return Chat.objects.filter(
            participants=user,
            is_deleted=False
        ).prefetch_related('participants', 'messages')