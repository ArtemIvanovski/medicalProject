from django.urls import path
from .views import (
    SingleDataView, BatchDataView,
    SensorRegistrationView, SensorManagementView,
    AdminSensorView, SensorSettingsView, SensorBatteryView, SensorBatteryInfoView, SensorClaimView,
    SensorSyncView, EnhancedBatchDataView, SensorStatusView
)

urlpatterns = [
    # Основные endpoints для отправки данных
    path('sensor/<str:serial_number>/single/', SingleDataView.as_view(), name='sensor-single-data'),
    path('sensor/<str:serial_number>/batch/', BatchDataView.as_view(), name='sensor-batch-data'),
    
    # Новые безопасные endpoints
    path('sensor/<str:serial_number>/sync/', SensorSyncView.as_view(), name='sensor-sync'),
    path('sensor/<str:serial_number>/enhanced-batch/', EnhancedBatchDataView.as_view(), name='sensor-enhanced-batch'),
    path('sensor/<str:serial_number>/status/', SensorStatusView.as_view(), name='sensor-status'),
    
    # Управление сенсорами
    path('register/', SensorRegistrationView.as_view(), name='sensor-registration'),
    path('sensors/', SensorManagementView.as_view(), name='sensor-management'),
    path('sensors/<uuid:sensor_id>/', SensorManagementView.as_view(), name='sensor-detail'),

    # Административные endpoints
    path('admin/sensors/', AdminSensorView.as_view(), name='admin-sensor-list-create'),
    path('admin/sensors/<uuid:sensor_id>/', AdminSensorView.as_view(), name='admin-sensor-update-delete'),
    
    # Настройки и дополнительные функции
    path('sensors/<uuid:sensor_id>/settings/', SensorSettingsView.as_view(), name='sensor-settings'),
    path('sensor/<str:serial_number>/battery/', SensorBatteryView.as_view(), name='sensor-battery'),
    path('sensor/<str:serial_number>/battery-info/', SensorBatteryInfoView.as_view(), name='sensor-battery-info'),
    path('sensor/claim/<uuid:claim_token>/', SensorClaimView.as_view(), name='sensor-claim'),
]
