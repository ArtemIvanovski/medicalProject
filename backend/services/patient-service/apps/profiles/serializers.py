from rest_framework import serializers
from .models import User, DoctorPatient, Invite, Feature


class DoctorSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'patronymic', 'phone_number', 'email', 'avatar_url']

    def get_avatar_url(self, obj):
        if obj.avatar_drive_id:
            return f"/api/v1/avatar/{obj.avatar_drive_id}/"
        return None


class DoctorPatientSerializer(serializers.ModelSerializer):
    doctor = DoctorSerializer(read_only=True)

    class Meta:
        model = DoctorPatient
        fields = ['id', 'doctor', 'created_at']


class FeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feature
        fields = ['id', 'code', 'name', 'description']


class InviteDoctorSerializer(serializers.ModelSerializer):
    features = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    invite_link = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Invite
        fields = ['token', 'message', 'expires_at', 'features', 'invite_link']
        read_only_fields = ['token', 'expires_at', 'invite_link']

    def get_invite_link(self, obj):
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(f'/accept-invite/{obj.token}/')
        return None

    def create(self, validated_data):
        from django.utils import timezone
        from datetime import timedelta

        features_codes = validated_data.pop('features', [])

        invite = Invite.objects.create(
            kind=Invite.Kind.DOCTOR,
            created_by=self.context['request'].user,
            patient=self.context['request'].user,
            expires_at=timezone.now() + timedelta(hours=48),
            **validated_data
        )

        if features_codes:
            features = Feature.objects.filter(code__in=features_codes)
            invite.features.set(features)

        return invite