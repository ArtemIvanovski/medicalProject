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
    path('user/<uuid:user_id>/avatar/', views.get_user_avatar_by_id, name='get_user_avatar_by_id'),
    path('user/<uuid:user_id>/', views.get_user_info_by_id, name='get_user_info_by_id'),
    path('references/genders/', views.get_genders, name='get_genders'),
    path('references/blood-types/', views.get_blood_types, name='get_blood_types'),
    path('references/allergies/', views.get_allergies, name='get_allergies'),
    path('references/diagnoses/', views.get_diagnoses, name='get_diagnoses'),
    path('references/diabetes-types/', views.get_diabetes_types, name='get_diabetes_types'),

    path('features/', views.get_available_features, name='get_available_features'),

    path('doctors/', views.get_patient_doctors, name='get_patient_doctors'),
    path('doctors/<uuid:doctor_id>/remove/', views.remove_doctor_access, name='remove_doctor_access'),
    path('doctors/<uuid:doctor_id>/restrict/', views.restrict_doctor_access, name='restrict_doctor_access'),
    path('doctors/invite/', views.invite_doctor, name='invite_doctor'),
    path('doctors/<uuid:doctor_id>/permissions/', views.get_doctor_permissions, name='get_doctor_permissions'),
    path('doctors/<uuid:doctor_id>/permissions/update/', views.update_doctor_permissions,
         name='update_doctor_permissions'),

    path('trusted/', views.get_patient_trusted_persons, name='get_patient_trusted_persons'),
    path('trusted/<uuid:trusted_id>/remove/', views.remove_trusted_access, name='remove_trusted_access'),
    path('trusted/<uuid:trusted_id>/restrict/', views.restrict_trusted_access, name='restrict_trusted_access'),
    path('trusted/invite/', views.invite_trusted_person, name='invite_trusted_person'),
    path('trusted/<uuid:trusted_id>/permissions/', views.get_trusted_permissions, name='get_trusted_permissions'),
    path('trusted/<uuid:trusted_id>/permissions/update/', views.update_trusted_permissions,
         name='update_trusted_permissions'),
]
