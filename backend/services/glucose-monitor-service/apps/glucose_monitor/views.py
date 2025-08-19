import base64
import binascii
import json
import logging
import os
import datetime

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import SensorRegistrationSerializer, SensorAdminSerializer, SensorSettingsSerializer, \
    MeasurementItemSerializer

logger = logging.getLogger(__name__)

from .models import Sensor, GlucoseData, SensorSettings
from .security import verify_signature, check_nonce, decrypt_payload
from .serializers import SingleDataSerializer, BatchDataSerializer, GlucoseDataSerializer

logger = logging.getLogger(__name__)


class BaseSensorView(APIView):
    AUTH_WINDOW = 300  # 5 минут в секундах

    def authenticate(self, request, serial_number, signature, nonce, timestamp):
        try:
            sensor = Sensor.objects.select_for_update().get(
                serial_number=serial_number,
                is_active=True
            )
        except Sensor.DoesNotExist:
            logger.error(f"Sensor not found: {serial_number}")
            return None, "Invalid sensor"

        # Проверка nonce
        if not check_nonce(sensor, nonce):
            logger.warning(f"Duplicate or invalid nonce: {nonce} for sensor {serial_number}")
            return None, "Invalid nonce"

        # Формирование данных для проверки подписи
        sign_data = {
            'path': request.path,
            'nonce': nonce,
            'timestamp': timestamp,
            'body': request.data
        }

        # Проверка подписи
        if not verify_signature(sign_data, signature, sensor.secret_key):
            logger.warning(f"Invalid signature for sensor {serial_number}")
            return None, "Invalid signature"

        # Обновление последнего запроса
        sensor.last_request = timezone.now()
        sensor.save()

        return sensor, None


class SingleDataView(BaseSensorView):
    permission_classes = [AllowAny]

    def post(self, request, serial_number):
        serializer = SingleDataSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        sensor, error = self.authenticate(
            request,
            serial_number,
            data['signature'],
            data['nonce'],
            data['timestamp']
        )

        if error:
            return Response({"error": error}, status=status.HTTP_401_UNAUTHORIZED)

        # Сохранение данных
        ts = datetime.datetime.utcfromtimestamp(data['timestamp'])
        ts = timezone.make_aware(ts, timezone.utc)
        GlucoseData.objects.create(
            sensor=sensor,
            value=data['value'],
            timestamp=ts,
            sequence_id=data['sequence_id']
        )

        return Response({"status": "success"}, status=status.HTTP_201_CREATED)


class BatchDataView(BaseSensorView):
    permission_classes = [AllowAny]

    def post(self, request, serial_number):
        serializer = BatchDataSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        sensor, error = self.authenticate(
            request,
            serial_number,
            data['signature'],
            data['nonce'],
            data['timestamp']
        )

        if error:
            return Response({"error": error}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            # Дешифровка данных
            encrypted_data = base64.b64decode(data['encrypted_data'])
            decrypted_data = decrypt_payload(encrypted_data, sensor.secret_key)
            measurements = json.loads(decrypted_data.decode('utf-8'))
        except Exception as e:
            logger.error(f"Decryption failed for {serial_number}: {str(e)}")
            return Response({"error": "Data decryption failed"}, status=status.HTTP_400_BAD_REQUEST)

        # Валидация и сохранение данных
        valid_measurements = []
        for item in measurements:
            item_serializer = MeasurementItemSerializer(data=item)
            if item_serializer.is_valid():
                item_data = item_serializer.validated_data
                ts = datetime.datetime.utcfromtimestamp(item_data['timestamp'])
                ts = timezone.make_aware(ts, timezone.utc)
                valid_measurements.append(GlucoseData(
                    sensor=sensor,
                    value=item_data['value'],
                    timestamp=ts,
                    sequence_id=item_data['sequence_id']
                ))
            else:
                logger.warning(f"Invalid measurement data from {serial_number}: {item_serializer.errors}")

        GlucoseData.objects.bulk_create(valid_measurements, ignore_conflicts=True)

        return Response({
            "status": "success",
            "saved": len(valid_measurements),
            "total": len(measurements)
        }, status=status.HTTP_201_CREATED)


class SensorRegistrationView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        """
        Регистрация нового сенсора глюкозы
        Параметры:
        - serial_number: уникальный серийный номер устройства
        - name: необязательное имя для сенсора
        """
        serializer = SensorRegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "Invalid data", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        serial_number = serializer.validated_data['serial_number']

        # Проверка, не зарегистрирован ли уже сенсор
        if Sensor.objects.filter(serial_number=serial_number).exists():
            return Response(
                {"error": "Sensor with this serial number already registered"},
                status=status.HTTP_409_CONFLICT
            )

        try:
            # Генерация секретного ключа (32 байта = 64 hex chars)
            secret_key = binascii.hexlify(os.urandom(32)).decode('utf-8')

            # Создание сенсора
            sensor = Sensor.objects.create(
                serial_number=serial_number,
                secret_key=secret_key,
                user=request.user,
                name=serializer.validated_data.get('name', '')
            )
            SensorSettings.objects.create(sensor=sensor)

            logger.info(f"New sensor registered: {sensor.serial_number} for user {request.user.email}")

            return Response({
                "status": "success",
                "sensor_id": str(sensor.id),
                "serial_number": sensor.serial_number,
                "secret_key": secret_key,
                "message": "Keep this secret key secure. It will not be shown again."
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Sensor registration failed: {str(e)}")
            return Response(
                {"error": "Registration failed", "details": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SensorManagementView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Получение списка сенсоров пользователя"""
        sensors = Sensor.objects.filter(
            user=request.user,
            is_active=True
        ).values('id', 'serial_number', 'name', 'created_at', 'last_request')

        return Response({
            "count": sensors.count(),
            "sensors": list(sensors)
        })

    def patch(self, request, sensor_id):
        """Обновление информации о сенсоре"""
        try:
            sensor = Sensor.objects.get(
                id=sensor_id,
                user=request.user
            )
        except Sensor.DoesNotExist:
            return Response(
                {"error": "Sensor not found or access denied"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = SensorRegistrationSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        if 'name' in serializer.validated_data:
            sensor.name = serializer.validated_data['name']
            sensor.save()

        return Response({
            "status": "success",
            "sensor_id": str(sensor.id),
            "name": sensor.name
        })

    def delete(self, request, sensor_id):
        """Деактивация сенсора"""
        try:
            sensor = Sensor.objects.get(
                id=sensor_id,
                user=request.user
            )
        except Sensor.DoesNotExist:
            return Response(
                {"error": "Sensor not found or access denied"},
                status=status.HTTP_404_NOT_FOUND
            )

        sensor.is_active = False
        sensor.save()

        return Response({
            "status": "success",
            "message": f"Sensor {sensor.serial_number} deactivated"
        })


class AdminSensorView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        sensors = Sensor.objects.all().order_by('-created_at')
        serializer = SensorAdminSerializer(sensors, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = SensorAdminSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serial_number = serializer.validated_data['serial_number']
        if Sensor.objects.filter(serial_number=serial_number).exists():
            return Response({"error": "Sensor with this serial number already exists"}, status=status.HTTP_409_CONFLICT)
        secret_key = binascii.hexlify(os.urandom(32)).decode('utf-8')
        sensor = Sensor.objects.create(
            serial_number=serial_number,
            name=serializer.validated_data.get('name', ''),
            secret_key=secret_key,
            user=serializer.validated_data.get('user')
        )
        SensorSettings.objects.create(sensor=sensor)
        out = SensorAdminSerializer(sensor).data
        out['secret_key'] = secret_key
        return Response(out, status=status.HTTP_201_CREATED)

    def patch(self, request, sensor_id):
        try:
            sensor = Sensor.objects.get(id=sensor_id)
        except Sensor.DoesNotExist:
            return Response({"error": "Sensor not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = SensorAdminSerializer(sensor, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, sensor_id):
        try:
            sensor = Sensor.objects.get(id=sensor_id)
        except Sensor.DoesNotExist:
            return Response({"error": "Sensor not found"}, status=status.HTTP_404_NOT_FOUND)
        sensor.is_active = False
        sensor.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SensorSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, sensor_id):
        try:
            sensor = Sensor.objects.get(id=sensor_id, user=request.user)
        except Sensor.DoesNotExist:
            return Response({"error": "Sensor not found or access denied"}, status=status.HTTP_404_NOT_FOUND)
        settings_obj, _ = SensorSettings.objects.get_or_create(sensor=sensor)
        return Response(SensorSettingsSerializer(settings_obj).data)

    def patch(self, request, sensor_id):
        try:
            sensor = Sensor.objects.get(id=sensor_id, user=request.user)
        except Sensor.DoesNotExist:
            return Response({"error": "Sensor not found or access denied"}, status=status.HTTP_404_NOT_FOUND)
        settings_obj, _ = SensorSettings.objects.get_or_create(sensor=sensor)
        serializer = SensorSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SensorBatteryView(APIView):
    permission_classes = [AllowAny]  # battery endpoint can be unauthenticated but signed by device

    def post(self, request, serial_number):
        from rest_framework import serializers as drf_serializers

        class BatterySerializer(drf_serializers.Serializer):
            signature = drf_serializers.CharField(max_length=88)
            nonce = drf_serializers.IntegerField(min_value=1)
            timestamp = drf_serializers.IntegerField()
            battery_level = drf_serializers.IntegerField(min_value=0, max_value=100)

        serializer = BatterySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        sensor, error = BaseSensorView().authenticate(
            request, serial_number, data['signature'], data['nonce'], data['timestamp']
        )
        if error:
            return Response({"error": error}, status=status.HTTP_401_UNAUTHORIZED)

        settings_obj, _ = SensorSettings.objects.get_or_create(sensor=sensor)
        settings_obj.battery_level = data['battery_level']
        settings_obj.save()
        return Response({"status": "ok"})


class SensorClaimView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, claim_token):
        try:
            sensor = Sensor.objects.get(claim_token=claim_token, user__isnull=True)
        except Sensor.DoesNotExist:
            return Response({"error": "Invalid or used claim token"}, status=status.HTTP_400_BAD_REQUEST)
        sensor.user = request.user
        sensor.claim_used_at = timezone.now()
        sensor.save()
        return Response({"status": "claimed", "sensor_id": str(sensor.id)})
