import time
import logging
from django.core.cache import cache
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Sensor, SensorData
from .serializers import SingleDataSerializer, BatchDataSerializer
from .security import verify_signature, generate_data_payload

logger = logging.getLogger(__name__)


class BaseSensorView(APIView):
    AUTH_WINDOW = 300

    def authenticate(self, request, serial_number, signature, nonce, timestamp):
        current_time = time.time()
        if abs(current_time - timestamp.timestamp()) > self.AUTH_WINDOW:
            return None, "Timestamp outside allowed window"

        cache_key = f"sensor_nonce:{serial_number}:{nonce}"
        if cache.get(cache_key):
            return None, "Duplicate nonce detected"

        try:
            sensor = Sensor.objects.select_for_update().get(
                serial_number=serial_number
            )
        except Sensor.DoesNotExist:
            return None, "Invalid sensor"

        # Проверка подписи
        payload = generate_data_payload(request.data)
        if not verify_signature(payload, signature, sensor.secret_key):
            return None, "Invalid signature"

        # Обновление последнего запроса
        sensor.last_request = timezone.now()
        sensor.save()

        # Сохранение nonce в кэш
        cache.set(cache_key, True, timeout=self.AUTH_WINDOW * 2)

        return sensor, None


class SingleDataView(BaseSensorView):
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
            logger.warning(f"Auth failed for {serial_number}: {error}")
            return Response({"error": error}, status=status.HTTP_401_UNAUTHORIZED)

        # Сохранение данных
        SensorData.objects.create(
            sensor=sensor,
            value=data['value'],
            timestamp=data['timestamp'],
            sequence_id=data['sequence_id']
        )

        return Response({"status": "success"}, status=status.HTTP_201_CREATED)


class BatchDataView(BaseSensorView):
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
            logger.warning(f"Auth failed for {serial_number}: {error}")
            return Response({"error": error}, status=status.HTTP_401_UNAUTHORIZED)

        records = [
            SensorData(
                sensor=sensor,
                value=item['value'],
                timestamp=item['timestamp'],
                sequence_id=item['sequence_id']
            )
            for item in data['data']
        ]

        SensorData.objects.bulk_create(records)

        return Response({
            "status": "success",
            "saved": len(records)
        }, status=status.HTTP_201_CREATED)