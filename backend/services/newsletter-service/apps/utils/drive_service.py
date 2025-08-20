import io
import mimetypes
import os
from django.conf import settings
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload
from googleapiclient.errors import HttpError

SERVICE_FILE = os.path.join(settings.BASE_DIR, "gservice_account.json")
SCOPES = ["https://www.googleapis.com/auth/drive"]
BLOG_IMAGES_FOLDER_ID = "1wrDo0zfyr9Soa8UEJMfYuvK3pbZtURn8"

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

    def remove_file(self, file_id: str) -> None:
        if not file_id:
            return
        try:
            self.get_service().files().delete(fileId=file_id).execute()
        except HttpError as e:
            if e.resp.status != 404:
                raise Exception(f"Failed to delete file: {str(e)}")

    def upload_image(self, file, old_drive_id: str = None, folder_id: str = None) -> str:
        if old_drive_id:
            self.remove_file(old_drive_id)

        if not folder_id:
            folder_id = BLOG_IMAGES_FOLDER_ID

        mime_type = mimetypes.guess_type(file.name)[0] or "application/octet-stream"
        
        if not mime_type.startswith('image/'):
            raise Exception("Only image files are allowed")

        file_content = file.read()
        media = MediaIoBaseUpload(io.BytesIO(file_content), mimetype=mime_type)

        try:
            result = self.get_service().files().create(
                body={"name": file.name, "parents": [folder_id]},
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

    def get_file_content(self, file_id: str) -> bytes:
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
    
    def get_image_url(self, file_id: str) -> str:
        if not file_id:
            return None
        return f"https://drive.google.com/uc?id={file_id}"
