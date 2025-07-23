from django.urls import path
from . import views

urlpatterns = [
    path('profile/', views.get_profile, name='get_profile'),
    path('profile/user/', views.update_user_info, name='update_user_info'),
    path('profile/details/', views.update_profile_details, name='update_profile_details'),
    path('profile/address/', views.update_address, name='update_address'),
    path('profile/avatar/', views.upload_avatar, name='upload_avatar'),
    path('profile/avatar/delete/', views.delete_avatar, name='delete_avatar'),
    path('avatar/<str:file_id>/', views.get_avatar, name='get_avatar'),
    path('references/genders/', views.get_genders, name='get_genders'),
    path('references/blood-types/', views.get_blood_types, name='get_blood_types'),
    path('references/allergies/', views.get_allergies, name='get_allergies'),
    path('references/diagnoses/', views.get_diagnoses, name='get_diagnoses'),
    path('references/diabetes-types/', views.get_diabetes_types, name='get_diabetes_types'),
]