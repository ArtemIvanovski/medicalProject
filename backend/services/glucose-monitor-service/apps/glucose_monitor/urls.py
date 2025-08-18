from django.urls import path
from .views import SingleDataView, BatchDataView

urlpatterns = [
    path('sensor/<str:serial_number>/single/', SingleDataView.as_view(), name='sensor-single-data'),
    path('sensor/<str:serial_number>/batch/', BatchDataView.as_view(), name='sensor-batch-data'),
]
