from django.urls import path
from .views import (
    DrugSearchAPIView,
    MedicationIntakeListCreateView,
    MedicationIntakeDetailView,
    medication_stats,
    medication_timeline,
    FavoriteDrugListView,
    remove_favorite_drug,
    MedicationPatternListCreateView,
    MedicationPatternDetailView,
    apply_medication_pattern,
    MedicationReminderListCreateView,
    MedicationReminderDetailView,
    active_reminders_today
)

app_name = "drug_search"

urlpatterns = [
    path('search/', DrugSearchAPIView.as_view(), name='drug-search'),
    path('intakes/', MedicationIntakeListCreateView.as_view(), name='medication-intakes'),
    path('intakes/<uuid:pk>/', MedicationIntakeDetailView.as_view(), name='medication-intake-detail'),
    path('stats/', medication_stats, name='medication-stats'),
    path('timeline/', medication_timeline, name='medication-timeline'),

    path('favorites/', FavoriteDrugListView.as_view(), name='favorite-drugs'),
    path('favorites/<uuid:drug_id>/remove/', remove_favorite_drug, name='remove-favorite-drug'),

    path('patterns/', MedicationPatternListCreateView.as_view(), name='medication-patterns'),
    path('patterns/<uuid:pk>/', MedicationPatternDetailView.as_view(), name='medication-pattern-detail'),
    path('patterns/apply/', apply_medication_pattern, name='apply-medication-pattern'),

    path('reminders/', MedicationReminderListCreateView.as_view(), name='medication-reminders'),
    path('reminders/<uuid:pk>/', MedicationReminderDetailView.as_view(), name='medication-reminder-detail'),
    path('reminders/today/', active_reminders_today, name='active-reminders-today'),
]