import json

from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .drive_service import DriveService
from .models import DoctorPatient, Invite, Feature
from .models import UserProfile, Address, Gender, BloodType, Allergy, Diagnosis, DiabetesType


@require_http_methods(["GET"])
def get_profile(request):
    print(f"request.user: {request.user}")
    print(f"request.user type: {type(request.user)}")
    print(f"hasattr email: {hasattr(request.user, 'email')}")
    print(f"is_anonymous: {request.user.is_anonymous}")
    print(f"is_authenticated: {request.user.is_authenticated}")

    if request.user.is_anonymous:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    try:
        profile = UserProfile.objects.select_related(
            'user', 'gender', 'blood_type', 'address_home', 'diabetes_type'
        ).prefetch_related('allergies', 'diagnoses').get(user=request.user)

        data = {
            'user': {
                'id': str(profile.user.id),
                'email': profile.user.email,
                'first_name': profile.user.first_name,
                'last_name': profile.user.last_name,
                'patronymic': profile.user.patronymic,
                'birth_date': profile.user.birth_date,
                'phone_number': profile.user.phone_number,
                'avatar_drive_id': profile.user.avatar_drive_id,
            },
            'profile': {
                'gender': profile.gender.name if profile.gender else None,
                'blood_type': profile.blood_type.name if profile.blood_type else None,
                'height': profile.height,
                'weight': profile.weight,
                'waist_circumference': profile.waist_circumference,
                'diabetes_type': profile.diabetes_type.name if profile.diabetes_type else None,
                'allergies': [a.name for a in profile.allergies.all()],
                'diagnoses': [d.name for d in profile.diagnoses.all()],
                'address_home': {
                    'city': profile.address_home.city,
                    'country': profile.address_home.country,
                    'formatted': profile.address_home.formatted,
                    'latitude': profile.address_home.latitude,
                    'longitude': profile.address_home.longitude,
                    'postcode': profile.address_home.postcode,
                    'street': profile.address_home.street,
                } if profile.address_home else None
            }
        }
        return JsonResponse(data)
    except UserProfile.DoesNotExist:
        profile = UserProfile.objects.create(user=request.user)
        return JsonResponse({'user': {'id': str(request.user.id), 'email': request.user.email}, 'profile': {}})


@require_http_methods(["PUT"])
@csrf_exempt
def update_user_info(request):
    if request.user.is_anonymous:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    data = json.loads(request.body)
    user = request.user

    if 'first_name' in data:
        user.first_name = data['first_name']
    if 'last_name' in data:
        user.last_name = data['last_name']
    if 'patronymic' in data:
        user.patronymic = data['patronymic']
    if 'birth_date' in data:
        user.birth_date = data['birth_date']
    if 'phone_number' in data:
        user.phone_number = data['phone_number']

    user.save()
    return JsonResponse({'success': True})


@require_http_methods(["PUT"])
@csrf_exempt
def update_profile_details(request):
    if request.user.is_anonymous:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    data = json.loads(request.body)
    profile, created = UserProfile.objects.get_or_create(user=request.user)

    if 'gender' in data and data['gender']:
        profile.gender = Gender.objects.get(name=data['gender'])
    if 'blood_type' in data and data['blood_type']:
        profile.blood_type = BloodType.objects.get(name=data['blood_type'])
    if 'height' in data:
        profile.height = data['height']
    if 'weight' in data:
        profile.weight = data['weight']
    if 'waist_circumference' in data:
        profile.waist_circumference = data['waist_circumference']
    if 'diabetes_type' in data and data['diabetes_type']:
        profile.diabetes_type = DiabetesType.objects.get(name=data['diabetes_type'])

    profile.save()

    if 'allergies' in data:
        allergies = Allergy.objects.filter(name__in=data['allergies'])
        profile.allergies.set(allergies)

    if 'diagnoses' in data:
        diagnoses = Diagnosis.objects.filter(name__in=data['diagnoses'])
        profile.diagnoses.set(diagnoses)

    return JsonResponse({'success': True})


@require_http_methods(["PUT"])
@csrf_exempt
def update_address(request):
    if request.user.is_anonymous:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    data = json.loads(request.body)
    profile, created = UserProfile.objects.get_or_create(user=request.user)

    address, created = Address.objects.get_or_create(
        latitude=data['latitude'],
        longitude=data['longitude'],
        defaults={
            'city': data['city'],
            'country': data['country'],
            'formatted': data['formatted'],
            'postcode': data.get('postcode'),
            'street': data.get('street'),
        }
    )

    profile.address_home = address
    profile.save()

    return JsonResponse({'success': True})


@require_http_methods(["POST"])
@csrf_exempt
def upload_avatar(request):
    if request.user.is_anonymous:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    if 'avatar' not in request.FILES:
        return JsonResponse({'error': 'No file provided'}, status=400)

    file = request.FILES['avatar']
    drive_service = DriveService()

    try:
        file_id = drive_service.upload_avatar(file, request.user.avatar_drive_id)
        request.user.avatar_drive_id = file_id
        request.user.save()
        return JsonResponse({'success': True, 'file_id': file_id})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_http_methods(["DELETE"])
@csrf_exempt
def delete_avatar(request):
    if request.user.is_anonymous:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    if not request.user.avatar_drive_id:
        return JsonResponse({'error': 'No avatar to delete'}, status=400)

    drive_service = DriveService()

    try:
        drive_service.remove_file(request.user.avatar_drive_id)
        request.user.avatar_drive_id = None
        request.user.save()
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_http_methods(["GET"])
def get_avatar(request, file_id):
    drive_service = DriveService()

    try:
        file_content = drive_service.get_file_content(file_id)
        return HttpResponse(file_content, content_type='image/jpeg')
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=404)


# Reference endpoints
@require_http_methods(["GET"])
def get_genders(request):
    genders = Gender.objects.all().values('id', 'name')
    return JsonResponse(list(genders), safe=False)


@require_http_methods(["GET"])
def get_blood_types(request):
    types = BloodType.objects.all().values('id', 'name', 'description')
    return JsonResponse(list(types), safe=False)


@require_http_methods(["GET"])
def get_allergies(request):
    allergies = Allergy.objects.all().values('id', 'name')
    return JsonResponse(list(allergies), safe=False)


@require_http_methods(["GET"])
def get_diagnoses(request):
    diagnoses = Diagnosis.objects.all().values('id', 'name')
    return JsonResponse(list(diagnoses), safe=False)


@require_http_methods(["GET"])
def get_diabetes_types(request):
    types = DiabetesType.objects.all().values('id', 'name', 'description')
    return JsonResponse(list(types), safe=False)


@require_http_methods(["GET"])
def get_patient_doctors(request):
    if request.user.is_anonymous:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    doctor_relations = DoctorPatient.objects.select_related('doctor').filter(
        patient=request.user,
        is_deleted=False
    )

    doctors_data = []
    for relation in doctor_relations:
        doctor = relation.doctor
        doctors_data.append({
            'id': str(doctor.id),
            'first_name': doctor.first_name or '',
            'last_name': doctor.last_name or '',
            'patronymic': doctor.patronymic or '',
            'phone_number': doctor.phone_number or '',
            'email': doctor.email,
            'avatar_url': f"/api/v1/avatar/{doctor.avatar_drive_id}/" if doctor.avatar_drive_id else None,
            'created_at': relation.created_at.isoformat()
        })

    return JsonResponse({'doctors': doctors_data})


@require_http_methods(["POST"])
@csrf_exempt
def remove_doctor_access(request, doctor_id):
    if request.user.is_anonymous:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    try:
        relations = DoctorPatient.objects.filter(
            doctor_id=doctor_id,
            patient=request.user,
            is_deleted=False
        )

        if not relations.exists():
            return JsonResponse({'error': 'Doctor not found'}, status=404)

        relations.update(is_deleted=True)
        return JsonResponse({'success': True})

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_http_methods(["POST"])
@csrf_exempt
def invite_doctor(request):
    if request.user.is_anonymous:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    try:
        data = json.loads(request.body)

        from django.utils import timezone
        from datetime import timedelta

        invite = Invite.objects.create(
            kind=Invite.Kind.DOCTOR,
            created_by=request.user,
            patient=request.user,
            message=data.get('message', ''),
            expires_at=timezone.now() + timedelta(hours=48)
        )

        feature_codes = data.get('features', [])
        if feature_codes:
            features = Feature.objects.filter(code__in=feature_codes)
            invite.features.set(features)

        invite_link = request.build_absolute_uri(f'/accept-invite/{invite.token}/')

        return JsonResponse({
            'success': True,
            'token': str(invite.token),
            'invite_link': invite_link,
            'expires_at': invite.expires_at.isoformat()
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_http_methods(["GET"])
def get_available_features(request):
    features = Feature.objects.all()
    features_data = []

    for feature in features:
        features_data.append({
            'id': str(feature.id),
            'code': feature.code,
            'name': feature.name,
            'description': feature.description
        })

    return JsonResponse({'features': features_data})


@require_http_methods(["POST"])
@csrf_exempt
def restrict_doctor_access(request, doctor_id):
    if request.user.is_anonymous:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    try:
        data = json.loads(request.body)
        feature_codes = data.get('features', [])

        relation = DoctorPatient.objects.filter(
            doctor_id=doctor_id,
            patient=request.user,
            is_deleted=False
        ).first()

        if not relation:
            return JsonResponse({'error': 'Doctor not found'}, status=404)

        if feature_codes:
            features = Feature.objects.filter(code__in=feature_codes)
            relation.features.set(features)
        else:
            relation.features.clear()

        return JsonResponse({'success': True})

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
