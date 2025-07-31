from django.db.models import Q
from django.http import JsonResponse, HttpResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Chat, Message, MessageAttachment, MessageStatus, UserDeletedMessage, User
from .serializers import (
    ChatSerializer, MessageSerializer, SendMessageSerializer,
    EditMessageSerializer, ContactSerializer
)
from .services import ChatService, PermissionService, DriveService


class MessagePagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100


class ChatListView(ListAPIView):
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ChatService.get_user_chats(self.request.user)


class ContactListView(ListAPIView):
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PermissionService.get_allowed_contacts(self.request.user)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_chat_messages(request, chat_id):
    try:
        chat = Chat.objects.get(id=chat_id, participants=request.user, is_deleted=False)
    except Chat.DoesNotExist:
        return Response({'error': 'Chat not found'}, status=404)

    deleted_message_ids = UserDeletedMessage.objects.filter(
        user=request.user
    ).values_list('message_id', flat=True)

    messages = Message.objects.filter(
        chat=chat,
        is_deleted=False
    ).exclude(
        Q(is_deleted_for_everyone=True) | Q(id__in=deleted_message_ids)
    ).select_related('sender', 'reply_to').prefetch_related('attachments', 'statuses')

    paginator = MessagePagination()
    page = paginator.paginate_queryset(messages, request)

    serializer = MessageSerializer(page, many=True, context={'request': request})

    ChatService.mark_messages_as_read(chat, request.user)

    return paginator.get_paginated_response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_message(request):
    serializer = SendMessageSerializer(data=request.data, context={'request': request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    recipient_id = serializer.validated_data['recipient_id']
    message_type = serializer.validated_data['message_type']
    content = serializer.validated_data.get('content', '')
    reply_to_id = serializer.validated_data.get('reply_to_id')
    attachments = request.FILES.getlist('attachments')

    try:
        recipient = User.objects.get(id=recipient_id, is_deleted=False)
    except User.DoesNotExist:
        return Response({'error': 'Recipient not found'}, status=404)

    chat = ChatService.get_or_create_chat(request.user, recipient)

    reply_to = None
    if reply_to_id:
        try:
            reply_to = Message.objects.get(
                id=reply_to_id,
                chat=chat,
                is_deleted=False,
                is_deleted_for_everyone=False
            )
        except Message.DoesNotExist:
            return Response({'error': 'Reply message not found'}, status=404)

    message = Message.objects.create(
        chat=chat,
        sender=request.user,
        message_type=message_type,
        content=content,
        reply_to=reply_to
    )

    if attachments:
        drive_service = DriveService()
        for file in attachments:
            try:
                file_id = drive_service.upload_file(file)
                thumbnail_id = None

                if file.content_type.startswith('image/'):
                    thumbnail_id = drive_service.create_thumbnail(file)

                MessageAttachment.objects.create(
                    message=message,
                    file_name=file.name,
                    file_size=file.size,
                    mime_type=file.content_type,
                    drive_file_id=file_id,
                    thumbnail_drive_id=thumbnail_id
                )
            except Exception as e:
                return Response({'error': f'Failed to upload file: {str(e)}'}, status=500)

    MessageStatus.objects.create(
        message=message,
        user=request.user,
        status='sent'
    )

    MessageStatus.objects.create(
        message=message,
        user=recipient,
        status='delivered'
    )

    chat.updated_at = timezone.now()
    chat.save()

    serializer = MessageSerializer(message, context={'request': request})
    return Response(serializer.data, status=201)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def edit_message(request, message_id):
    try:
        message = Message.objects.get(
            id=message_id,
            sender=request.user,
            is_deleted=False,
            is_deleted_for_everyone=False
        )
    except Message.DoesNotExist:
        return Response({'error': 'Message not found'}, status=404)

    serializer = EditMessageSerializer(
        data=request.data,
        context={'request': request, 'message': message}
    )
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    content = serializer.validated_data['content']
    message.content = content
    message.encrypted_content = message.encrypt_content(content)
    message.edited_at = timezone.now()
    message.is_edited = True
    message.save()

    serializer = MessageSerializer(message, context={'request': request})
    return Response(serializer.data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_message(request, message_id):
    try:
        message = Message.objects.get(
            id=message_id,
            is_deleted=False
        )
    except Message.DoesNotExist:
        return Response({'error': 'Message not found'}, status=404)

    delete_for_everyone = request.data.get('delete_for_everyone', False)

    if delete_for_everyone:
        if message.sender != request.user:
            return Response({'error': 'You can only delete your own messages for everyone'}, status=403)

        if not message.can_delete_for_everyone():
            return Response({'error': 'Message can only be deleted for everyone within 24 hours'}, status=400)

        message.is_deleted_for_everyone = True
        message.save()
    else:
        UserDeletedMessage.objects.get_or_create(
            user=request.user,
            message=message
        )

    return Response({'success': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_as_read(request, chat_id):
    try:
        chat = Chat.objects.get(id=chat_id, participants=request.user, is_deleted=False)
    except Chat.DoesNotExist:
        return Response({'error': 'Chat not found'}, status=404)

    ChatService.mark_messages_as_read(chat, request.user)
    return Response({'success': True})


@require_http_methods(["GET"])
def get_file(request, file_id):
    drive_service = DriveService()

    try:
        file_content = drive_service.get_file_content(file_id)
        return HttpResponse(file_content, content_type='application/octet-stream')
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=404)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_messages(request):
    query = request.GET.get('q', '').strip()
    chat_id = request.GET.get('chat_id')

    if not query:
        return Response({'results': []})

    messages_filter = Q(is_deleted=False, is_deleted_for_everyone=False)

    if chat_id:
        try:
            chat = Chat.objects.get(id=chat_id, participants=request.user, is_deleted=False)
            messages_filter &= Q(chat=chat)
        except Chat.DoesNotExist:
            return Response({'error': 'Chat not found'}, status=404)
    else:
        user_chats = ChatService.get_user_chats(request.user)
        messages_filter &= Q(chat__in=user_chats)

    deleted_message_ids = UserDeletedMessage.objects.filter(
        user=request.user
    ).values_list('message_id', flat=True)

    messages_filter &= ~Q(id__in=deleted_message_ids)

    messages = Message.objects.filter(messages_filter).select_related(
        'sender', 'chat'
    ).prefetch_related('attachments')

    decrypted_messages = []
    for message in messages:
        decrypted_content = message.decrypt_content()
        if query.lower() in decrypted_content.lower():
            decrypted_messages.append(message)

    paginator = MessagePagination()
    page = paginator.paginate_queryset(decrypted_messages, request)

    serializer = MessageSerializer(page, many=True, context={'request': request})
    return paginator.get_paginated_response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_or_get_chat(request):
    recipient_id = request.data.get('recipient_id')

    if not recipient_id:
        return Response({'error': 'recipient_id is required'}, status=400)

    try:
        recipient = User.objects.get(id=recipient_id, is_deleted=False)
    except User.DoesNotExist:
        return Response({'error': 'Recipient not found'}, status=404)

    if not PermissionService.can_send_message(request.user, recipient):
        return Response({
            'error': 'Вы не можете написать этому пользователю',
            'message': 'Вы можете изменить доступ чтобы написать пользователю',
            'can_change_permissions': True
        }, status=403)

    chat = ChatService.get_or_create_chat(request.user, recipient)
    serializer = ChatSerializer(chat, context={'request': request})

    return Response(serializer.data, status=201)
