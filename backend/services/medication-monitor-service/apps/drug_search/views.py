from datetime import timedelta

from django.db.models import Count, Sum, Avg
from django.utils import timezone
from django.db import models
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .exceptions import DrugSearchException
from .models import Drug, MedicationIntake
from .models import FavoriteDrug, MedicationPattern, MedicationPatternItem, MedicationReminder
from .serializers import DrugSearchSerializer
from .serializers import (
    FavoriteDrugSerializer,
    MedicationPatternSerializer,
    CreateMedicationPatternSerializer,
    MedicationReminderSerializer,
    CreateMedicationReminderSerializer,
    ApplyPatternSerializer
)
from .serializers import (
    MedicationIntakeSerializer,
    CreateMedicationIntakeSerializer,
    MedicationStatsSerializer
)
from .services import TabletkaByClient


class FavoriteDrugListView(ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FavoriteDrugSerializer

    def get_queryset(self):
        return FavoriteDrug.objects.filter(user=self.request.user).select_related('drug')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_favorite_drug(request, drug_id):
    try:
        favorite = FavoriteDrug.objects.get(
            user=request.user,
            drug_id=drug_id
        )
        favorite.delete()
        return Response({'success': True})
    except FavoriteDrug.DoesNotExist:
        return Response({'error': 'Favorite not found'}, status=404)


class MedicationPatternListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return MedicationPattern.objects.filter(
            user=self.request.user,
            is_deleted=False
        ).prefetch_related('items__drug')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateMedicationPatternSerializer
        return MedicationPatternSerializer

    def perform_create(self, serializer):
        name = serializer.validated_data['name']
        description = serializer.validated_data.get('description', '')
        items_data = serializer.validated_data['items']

        pattern = MedicationPattern.objects.create(
            user=self.request.user,
            name=name,
            description=description
        )

        for order, item_data in enumerate(items_data):
            drug, created = Drug.objects.get_or_create(
                name=item_data['drug_name'],
                form=item_data['drug_form'],
                defaults={'description': ''}
            )

            MedicationPatternItem.objects.create(
                pattern=pattern,
                drug=drug,
                amount=item_data['amount'],
                unit=item_data['unit'],
                notes=item_data.get('notes', ''),
                order=order
            )


class MedicationPatternDetailView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MedicationPatternSerializer

    def get_queryset(self):
        return MedicationPattern.objects.filter(
            user=self.request.user,
            is_deleted=False
        ).prefetch_related('items__drug')

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def apply_medication_pattern(request):
    serializer = ApplyPatternSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    pattern_id = serializer.validated_data['pattern_id']
    taken_at = serializer.validated_data['taken_at']

    try:
        pattern = MedicationPattern.objects.get(
            id=pattern_id,
            user=request.user,
            is_deleted=False,
            is_active=True
        )
    except MedicationPattern.DoesNotExist:
        return Response({'error': 'Pattern not found'}, status=404)

    intakes_created = []
    for item in pattern.items.all():
        intake = MedicationIntake.objects.create(
            user=request.user,
            drug=item.drug,
            taken_at=taken_at,
            amount=item.amount,
            unit=item.unit,
            notes=f"Применен шаблон: {pattern.name}. {item.notes}".strip()
        )
        intakes_created.append(intake)

    return Response({
        'success': True,
        'intakes_created': len(intakes_created),
        'pattern_name': pattern.name
    })


class MedicationReminderListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return MedicationReminder.objects.filter(user=self.request.user).select_related('drug')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateMedicationReminderSerializer
        return MedicationReminderSerializer

    def perform_create(self, serializer):
        drug_name = serializer.validated_data['drug_name']
        drug_form = serializer.validated_data['drug_form']

        drug, created = Drug.objects.get_or_create(
            name=drug_name,
            form=drug_form,
            defaults={'description': ''}
        )

        MedicationReminder.objects.create(
            user=self.request.user,
            drug=drug,
            title=serializer.validated_data['title'],
            amount=serializer.validated_data['amount'],
            unit=serializer.validated_data['unit'],
            frequency=serializer.validated_data['frequency'],
            time=serializer.validated_data['time'],
            weekdays=serializer.validated_data.get('weekdays', []),
            start_date=serializer.validated_data['start_date'],
            end_date=serializer.validated_data.get('end_date'),
            notes=serializer.validated_data.get('notes', '')
        )


class MedicationReminderDetailView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MedicationReminderSerializer

    def get_queryset(self):
        return MedicationReminder.objects.filter(user=self.request.user).select_related('drug')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def active_reminders_today(request):
    from datetime import date

    today = date.today()
    weekday = today.strftime('%A').lower()

    reminders = MedicationReminder.objects.filter(
        user=request.user,
        is_active=True,
        start_date__lte=today
    ).filter(
        models.Q(end_date__isnull=True) | models.Q(end_date__gte=today)
    ).filter(
        models.Q(frequency='daily') |
        models.Q(frequency='weekly') |
        models.Q(frequency='custom', weekdays__contains=[weekday])
    ).select_related('drug').order_by('time')

    serializer = MedicationReminderSerializer(reminders, many=True)
    return Response({
        'date': today,
        'weekday': weekday,
        'reminders': serializer.data
    })


class MedicationIntakeListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return MedicationIntake.objects.filter(
            user=self.request.user,
            is_deleted=False
        ).select_related('drug')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateMedicationIntakeSerializer
        return MedicationIntakeSerializer

    def perform_create(self, serializer):
        drug_name = serializer.validated_data['drug_name']
        drug_form = serializer.validated_data['drug_form']

        drug, created = Drug.objects.get_or_create(
            name=drug_name,
            form=drug_form,
            defaults={'description': ''}
        )

        MedicationIntake.objects.create(
            user=self.request.user,
            drug=drug,
            taken_at=serializer.validated_data['taken_at'],
            amount=serializer.validated_data['amount'],
            unit=serializer.validated_data['unit'],
            notes=serializer.validated_data.get('notes', '')
        )


class MedicationIntakeDetailView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MedicationIntakeSerializer

    def get_queryset(self):
        return MedicationIntake.objects.filter(
            user=self.request.user,
            is_deleted=False
        ).select_related('drug')

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def medication_stats(request):
    period_days = int(request.GET.get('days', 7))
    start_date = timezone.now() - timedelta(days=period_days)

    stats = MedicationIntake.objects.filter(
        user=request.user,
        is_deleted=False,
        taken_at__gte=start_date
    ).values(
        'drug__id',
        'drug__name',
        'drug__form'
    ).annotate(
        total_intakes=Count('id'),
        total_amount=Sum('amount'),
        avg_amount=Avg('amount'),
        last_taken=models.Max('taken_at')
    ).order_by('-total_intakes')

    serializer = MedicationStatsSerializer(stats, many=True)
    return Response({
        'period_days': period_days,
        'stats': serializer.data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def medication_timeline(request):
    days = int(request.GET.get('days', 7))
    drug_id = request.GET.get('drug_id')

    queryset = MedicationIntake.objects.filter(
        user=request.user,
        is_deleted=False,
        taken_at__gte=timezone.now() - timedelta(days=days)
    ).select_related('drug')

    if drug_id:
        queryset = queryset.filter(drug_id=drug_id)

    intakes = queryset.order_by('-taken_at')
    serializer = MedicationIntakeSerializer(intakes, many=True)

    return Response({
        'days': days,
        'drug_id': drug_id,
        'intakes': serializer.data
    })


class DrugSearchAPIView(APIView):
    """
    API для поиска лекарств по названию
    """

    def get(self, request):
        serializer = DrugSearchSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(
                {"error": "Invalid request", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        query = serializer.validated_data['query']

        try:
            client = TabletkaByClient()
            results = client.search_drugs(query)
            return Response({"query": query, "results": results})

        except DrugSearchException as e:
            return Response(
                {"error": "Drug search failed", "message": str(e)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
