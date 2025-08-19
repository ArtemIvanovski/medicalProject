from django.urls import path
from .views import (
    SingleDataView, BatchDataView,
    SensorRegistrationView, SensorManagementView,
    AdminSensorView, SensorSettingsView, SensorBatteryView, SensorClaimView
)

urlpatterns = [
    path('sensor/<str:serial_number>/single/', SingleDataView.as_view(), name='sensor-single-data'),
    path('sensor/<str:serial_number>/batch/', BatchDataView.as_view(), name='sensor-batch-data'),
    path('register/', SensorRegistrationView.as_view(), name='sensor-registration'),
    path('sensors/', SensorManagementView.as_view(), name='sensor-management'),
    path('sensors/<uuid:sensor_id>/', SensorManagementView.as_view(), name='sensor-detail'),

    path('admin/sensors/', AdminSensorView.as_view(), name='admin-sensor-list-create'),
    path('admin/sensors/<uuid:sensor_id>/', AdminSensorView.as_view(), name='admin-sensor-update-delete'),
    path('sensors/<uuid:sensor_id>/settings/', SensorSettingsView.as_view(), name='sensor-settings'),
    path('sensor/<str:serial_number>/battery/', SensorBatteryView.as_view(), name='sensor-battery'),
    path('sensor/claim/<uuid:claim_token>/', SensorClaimView.as_view(), name='sensor-claim'),
]
