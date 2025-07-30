from django.urls import path
from .views import DrugSearchAPIView

app_name = "drug_search"

urlpatterns = [
    path('search/', DrugSearchAPIView.as_view(), name='drug-search'),
]