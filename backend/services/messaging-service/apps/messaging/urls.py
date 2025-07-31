from django.urls import path
from . import views

app_name = 'messaging'

urlpatterns = [
    path('chats/', views.ChatListView.as_view(), name='chat-list'),
    path('contacts/', views.ContactListView.as_view(), name='contact-list'),
    path('chats/<uuid:chat_id>/messages/', views.get_chat_messages, name='chat-messages'),
    path('messages/send/', views.send_message, name='send-message'),
    path('messages/<uuid:message_id>/edit/', views.edit_message, name='edit-message'),
    path('messages/<uuid:message_id>/delete/', views.delete_message, name='delete-message'),
    path('chats/<uuid:chat_id>/mark-read/', views.mark_as_read, name='mark-as-read'),
    path('messages/search/', views.search_messages, name='search-messages'),
    path('files/<str:file_id>/', views.get_file, name='get-file'),
    path('chats/create/', views.create_or_get_chat, name='create-chat'),
]
