import binascii
import binascii
import logging
import os

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import SensorRegistrationSerializer, SensorAdminSerializer, SensorSettingsSerializer, \
    MeasurementItemSerializer

logger = logging.getLogger(__name__)

from .models import Sensor, GlucoseData, SensorSettings, SensorBatchData
from .security import (
    verify_signature, check_nonce_advanced, sync_sensor_time, decrypt_batch_data
)
from .serializers import SingleDataSerializer, BatchDataSerializer

logger = logging.getLogger(__name__)


class BaseSensorView(APIView):
    AUTH_WINDOW = 300  # 5 минут в секундах

    @transaction.atomic
    def authenticate(self, request, serial_number, signature, nonce, timestamp):
        try:
            sensor = Sensor.objects.select_for_update().get(
                serial_number=serial_number,
                active=True
            )
        except Sensor.DoesNotExist:
            logger.error(f"Sensor not found: {serial_number}")
            return None, "Invalid sensor"

        # Проверка nonce с новой продвинутой системой
        nonce_valid, nonce_error = check_nonce_advanced(sensor, nonce, timestamp)
        if not nonce_valid:
            logger.warning(f"Nonce validation failed for {serial_number}: {nonce_error}")
            return None, f"Invalid nonce: {nonce_error}"

        # Формирование данных для проверки подписи (БЕЗ подписи в body!)
        body_without_signature = request.data.copy()
        body_without_signature.pop('signature', None)  # Удаляем подпись из body
        
        sign_data = {
            'path': request.path,
            'nonce': nonce,
            'timestamp': timestamp,
            'body': body_without_signature
        }

        # Логирование для отладки (можно убрать в продакшене)
        logger.debug(f"Signature verification for {serial_number}: nonce={nonce}, path={request.path}")

        # Проверка подписи
        if not verify_signature(sign_data, signature, sensor.secret_key):
            logger.warning(f"Invalid signature for sensor {serial_number}")
            return None, "Invalid signature"

        # Обновление последнего запроса и статуса синхронизации
        sensor.last_request = timezone.now()
        if sensor.sync_status != 'synchronized':
            sensor.sync_status = 'synchronized'
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
        GlucoseData.objects.create(
            sensor=sensor,
            value=data['value']
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
            # Дешифровка данных с новой функцией
            measurements = decrypt_batch_data(data['encrypted_data'], sensor.secret_key)
        except Exception as e:
            logger.error(f"Batch decryption failed for {serial_number}: {str(e)}")
            return Response({"error": "Data decryption failed"}, status=status.HTTP_400_BAD_REQUEST)

        # Валидация и сохранение данных
        valid_measurements = []
        for item in measurements:
            item_serializer = MeasurementItemSerializer(data=item)
            if item_serializer.is_valid():
                item_data = item_serializer.validated_data
                valid_measurements.append(GlucoseData(
                    sensor=sensor,
                    value=item_data['value']
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

    def get(self, request, sensor_id=None):
        """Получение списка сенсоров пользователя или конкретного сенсора"""
        if sensor_id:
            # Получение конкретного сенсора с настройками
            try:
                sensor = Sensor.objects.get(
                    id=sensor_id,
                    user=request.user
                )
                settings_obj, _ = SensorSettings.objects.get_or_create(sensor=sensor)
                
                return Response({
                    'id': str(sensor.id),
                    'serial_number': sensor.serial_number,
                    'name': sensor.name,
                    'active': sensor.active,
                    'sync_status': sensor.sync_status,
                    'created_at': sensor.created_at,
                    'last_request': sensor.last_request,
                    'time_active': sensor.time_active,
                    'time_deactive': sensor.time_deactive,
                    'battery_level': settings_obj.battery_level,
                    'low_glucose_threshold': settings_obj.low_glucose_threshold,
                    'high_glucose_threshold': settings_obj.high_glucose_threshold,
                    'polling_interval_minutes': settings_obj.polling_interval_minutes,
                    'activation_time': settings_obj.activation_time,
                    'expiration_time': settings_obj.expiration_time
                })
            except Sensor.DoesNotExist:
                return Response(
                    {"error": "Sensor not found or access denied"},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # Получение списка всех сенсоров (активных и неактивных)
            active_sensors = Sensor.objects.filter(
                user=request.user,
                active=True
            ).select_related('settings')
            
            inactive_sensors = Sensor.objects.filter(
                user=request.user,
                active=False
            ).select_related('settings')
            
            def format_sensor(sensor):
                settings_obj, _ = SensorSettings.objects.get_or_create(sensor=sensor)
                return {
                    'id': str(sensor.id),
                    'serial_number': sensor.serial_number,
                    'name': sensor.name,
                    'active': sensor.active,
                    'created_at': sensor.created_at,
                    'last_request': sensor.last_request,
                    'time_active': sensor.time_active,
                    'time_deactive': sensor.time_deactive,
                    'battery_level': settings_obj.battery_level,
                    'low_glucose_threshold': settings_obj.low_glucose_threshold,
                    'high_glucose_threshold': settings_obj.high_glucose_threshold,
                    'polling_interval_minutes': settings_obj.polling_interval_minutes,
                    'activation_time': settings_obj.activation_time,
                    'expiration_time': settings_obj.expiration_time
                }

            return Response({
                "active_sensors": [format_sensor(s) for s in active_sensors],
                "inactive_sensors": [format_sensor(s) for s in inactive_sensors],
                "has_active": active_sensors.exists()
            })

    def patch(self, request, sensor_id):
        """Обновление информации о сенсоре и настройках"""
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

        data = request.data
        updated_fields = {}
        
        # Обновление основной информации о сенсоре
        if 'name' in data:
            sensor.name = data['name']
            updated_fields['name'] = sensor.name
            
        if 'active' in data:
            sensor.active = data['active']
            if not sensor.active:  # Деактивация
                from django.utils import timezone
                sensor.time_deactive = timezone.now()
            updated_fields['active'] = sensor.active
            
        sensor.save()
        
        # Обновление настроек сенсора
        settings_obj, _ = SensorSettings.objects.get_or_create(sensor=sensor)
        settings_updated = False
        
        for field in ['low_glucose_threshold', 'high_glucose_threshold', 'polling_interval_minutes']:
            if field in data:
                setattr(settings_obj, field, data[field])
                updated_fields[field] = data[field]
                settings_updated = True
                
        if settings_updated:
            settings_obj.save()

        return Response({
            "status": "success",
            "sensor_id": str(sensor.id),
            "updated_fields": updated_fields
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


class SensorBatteryInfoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, serial_number):
        """Получение данных о батарее сенсора для пользователя"""
        try:
            sensor = Sensor.objects.get(
                serial_number=serial_number,
                user=request.user,
                active=True
            )
            settings_obj, _ = SensorSettings.objects.get_or_create(sensor=sensor)
            return Response({
                'battery_level': settings_obj.battery_level
            })
        except Sensor.DoesNotExist:
            return Response(
                {"error": "Sensor not found or access denied"},
                status=status.HTTP_404_NOT_FOUND
            )


class SensorBatteryView(APIView):
    permission_classes = [AllowAny]

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


class SensorSyncView(BaseSensorView):
    """Синхронизация времени и восстановление связи с сенсором"""
    permission_classes = [AllowAny]

    def post(self, request, serial_number):
        from rest_framework import serializers as drf_serializers

        class SyncSerializer(drf_serializers.Serializer):
            signature = drf_serializers.CharField(max_length=88)
            nonce = drf_serializers.IntegerField(min_value=1)
            timestamp = drf_serializers.IntegerField()
            device_timestamp = drf_serializers.IntegerField()
            request_new_window = drf_serializers.BooleanField(default=False)

        serializer = SyncSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        
        # Для синхронизации используем специальную аутентификацию
        try:
            sensor = Sensor.objects.get(serial_number=serial_number, active=True)
        except Sensor.DoesNotExist:
            return Response({"error": "Sensor not found"}, status=status.HTTP_404_NOT_FOUND)

        # Специальная проверка подписи для синхронизации
        body_without_signature = request.data.copy()
        body_without_signature.pop('signature', None)
        
        sign_data = {
            'path': request.path,
            'nonce': data['nonce'],
            'timestamp': data['timestamp'],
            'body': body_without_signature
        }

        if not verify_signature(sign_data, data['signature'], sensor.secret_key):
            return Response({"error": "Invalid signature"}, status=status.HTTP_401_UNAUTHORIZED)

        # Выполняем синхронизацию времени
        sync_result = sync_sensor_time(sensor, data['device_timestamp'])

        # Если запрошено новое окно nonce
        if data.get('request_new_window', False):
            # Создаем новое окно, начинающееся с текущего nonce
            new_window_start = ((data['nonce'] // sensor.nonce_window_size) * sensor.nonce_window_size)
            sensor.nonce_window_start = new_window_start
            sensor.sync_status = 'synchronized'
            sensor.save()
            
            # Очищаем старые nonce
            from .models import SensorNonceTracking
            SensorNonceTracking.objects.filter(
                sensor=sensor,
                nonce_value__lt=new_window_start
            ).delete()

        return Response({
            "status": "synchronized",
            "sync_info": sync_result,
            "nonce_window": {
                "start": sensor.nonce_window_start,
                "size": sensor.nonce_window_size,
                "end": sensor.nonce_window_start + sensor.nonce_window_size
            }
        }, status=status.HTTP_200_OK)


class EnhancedBatchDataView(BaseSensorView):
    """Улучшенная обработка batch-данных с поддержкой накопления"""
    permission_classes = [AllowAny]

    def post(self, request, serial_number):
        from rest_framework import serializers as drf_serializers

        class EnhancedBatchSerializer(drf_serializers.Serializer):
            signature = drf_serializers.CharField(max_length=88)
            nonce = drf_serializers.IntegerField(min_value=1)
            timestamp = drf_serializers.IntegerField()
            encrypted_data = drf_serializers.CharField()
            batch_id = drf_serializers.CharField(max_length=64, required=False)
            is_final = drf_serializers.BooleanField(default=True)

        serializer = EnhancedBatchSerializer(data=request.data)
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
            measurements = decrypt_batch_data(data['encrypted_data'], sensor.secret_key)
        except Exception as e:
            logger.error(f"Enhanced batch decryption failed for {serial_number}: {str(e)}")
            return Response({"error": "Data decryption failed"}, status=status.HTTP_400_BAD_REQUEST)

        # Если это не финальная часть batch - сохраняем для накопления
        if not data.get('is_final', True):
            SensorBatchData.objects.create(
                sensor=sensor,
                encrypted_payload=data['encrypted_data'],
                measurements_count=len(measurements),
                is_processed=False
            )
            return Response({
                "status": "batch_stored",
                "message": "Batch data stored for processing"
            }, status=status.HTTP_202_ACCEPTED)

        # Если это финальная часть - обрабатываем все накопленные данные
        all_measurements = measurements.copy()
        
        # Получаем все неообработанные batch-данные для этого сенсора
        pending_batches = SensorBatchData.objects.filter(
            sensor=sensor,
            is_processed=False
        ).order_by('created_at')

        for batch in pending_batches:
            try:
                batch_measurements = decrypt_batch_data(batch.encrypted_payload, sensor.secret_key)
                all_measurements.extend(batch_measurements)
                batch.mark_processed()
            except Exception as e:
                logger.error(f"Failed to process batch {batch.id}: {str(e)}")

        # Валидация и сохранение всех данных
        valid_measurements = []
        for item in all_measurements:
            item_serializer = MeasurementItemSerializer(data=item)
            if item_serializer.is_valid():
                item_data = item_serializer.validated_data
                valid_measurements.append(GlucoseData(
                    sensor=sensor,
                    value=item_data['value']
                ))
            else:
                logger.warning(f"Invalid measurement data from {serial_number}: {item_serializer.errors}")

        GlucoseData.objects.bulk_create(valid_measurements, ignore_conflicts=True)

        return Response({
            "status": "success",
            "saved": len(valid_measurements),
            "total": len(all_measurements),
            "processed_batches": pending_batches.count()
        }, status=status.HTTP_201_CREATED)


class SensorStatusView(BaseSensorView):
    """Получение статуса сенсора и информации о синхронизации"""
    permission_classes = [AllowAny]

    def get(self, request, serial_number):
        try:
            sensor = Sensor.objects.get(serial_number=serial_number, active=True)
        except Sensor.DoesNotExist:
            return Response({"error": "Sensor not found"}, status=status.HTTP_404_NOT_FOUND)

        # Проверяем количество неообработанных batch-данных
        pending_batches_count = SensorBatchData.objects.filter(
            sensor=sensor,
            is_processed=False
        ).count()

        # Проверяем активные nonce
        from .models import SensorNonceTracking
        active_nonces_count = SensorNonceTracking.objects.filter(
            sensor=sensor,
            expires_at__gt=timezone.now()
        ).count()

        return Response({
            "sensor_id": str(sensor.id),
            "serial_number": sensor.serial_number,
            "sync_status": sensor.sync_status,
            "last_request": sensor.last_request,
            "nonce_window": {
                "start": sensor.nonce_window_start,
                "size": sensor.nonce_window_size,
                "current_end": sensor.nonce_window_start + sensor.nonce_window_size
            },
            "pending_batches": pending_batches_count,
            "active_nonces": active_nonces_count,
            "device_clock_offset": sensor.device_clock_offset,
            "last_sync": sensor.last_sync_timestamp
        })
