from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.paginator import Paginator
from django.db.models import Q
from .models import Contact
from .serializers import (
    ContactCreateSerializer, 
    ContactListSerializer, 
    ContactDetailSerializer,
    ContactUpdateSerializer
)

class ContactCreateView(generics.CreateAPIView):
    serializer_class = ContactCreateSerializer
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        contact = serializer.save()
        
        return Response({
            'success': True,
            'message': 'Ваше сообщение успешно отправлено. Мы свяжемся с вами в ближайшее время.',
            'contact_id': contact.id
        }, status=status.HTTP_201_CREATED)

class ContactListView(generics.ListAPIView):
    serializer_class = ContactListSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = Contact.objects.all()
        
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
            
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(email__icontains=search) |
                Q(subject__icontains=search)
            )
            
        return queryset
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        
        page_size = int(request.query_params.get('page_size', 20))
        page_number = int(request.query_params.get('page', 1))
        
        paginator = Paginator(queryset, page_size)
        page = paginator.get_page(page_number)
        
        serializer = self.get_serializer(page.object_list, many=True)
        
        return Response({
            'success': True,
            'data': serializer.data,
            'pagination': {
                'total_items': paginator.count,
                'total_pages': paginator.num_pages,
                'current_page': page_number,
                'page_size': page_size,
                'has_next': page.has_next(),
                'has_previous': page.has_previous()
            }
        })

class ContactDetailView(generics.RetrieveAPIView):
    queryset = Contact.objects.all()
    serializer_class = ContactDetailSerializer
    permission_classes = [IsAuthenticated]

class ContactUpdateView(generics.UpdateAPIView):
    queryset = Contact.objects.all()
    serializer_class = ContactUpdateSerializer
    permission_classes = [IsAuthenticated]
    
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        self.perform_update(serializer)
        
        return Response({
            'success': True,
            'message': 'Контакт успешно обновлен',
            'data': ContactDetailSerializer(instance).data
        })
