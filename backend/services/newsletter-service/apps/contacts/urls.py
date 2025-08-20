from django.urls import path
from .views import (
    ContactCreateView,
    ContactListView,
    ContactDetailView,
    ContactUpdateView
)

urlpatterns = [
    path('create/', ContactCreateView.as_view(), name='contact-create'),
    path('list/', ContactListView.as_view(), name='contact-list'),
    path('<int:pk>/', ContactDetailView.as_view(), name='contact-detail'),
    path('<int:pk>/update/', ContactUpdateView.as_view(), name='contact-update'),
]
