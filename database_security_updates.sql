-- Добавление новых полей для улучшенной безопасности
-- Эти изменения обеспечивают лучшую защиту от replay-атак и поддержку восстановления связи

-- 1. Добавляем поля для управления временными окнами nonce
ALTER TABLE public.main_app_sensor 
ADD COLUMN IF NOT EXISTS nonce_window_start BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS nonce_window_size INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS last_sync_timestamp BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS device_clock_offset INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'synchronized';

-- 2. Создаем таблицу для отслеживания использованных nonce в текущем окне
CREATE TABLE IF NOT EXISTS public.main_app_sensor_nonce_tracking (
    id BIGSERIAL PRIMARY KEY,
    sensor_id UUID NOT NULL REFERENCES public.main_app_sensor(id) ON DELETE CASCADE,
    nonce_value BIGINT NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '10 minutes'),
    UNIQUE(sensor_id, nonce_value)
);

-- Индекс для быстрого поиска nonce
CREATE INDEX IF NOT EXISTS idx_sensor_nonce_tracking_sensor_nonce 
ON public.main_app_sensor_nonce_tracking(sensor_id, nonce_value);

-- Индекс для очистки старых записей
CREATE INDEX IF NOT EXISTS idx_sensor_nonce_tracking_expires 
ON public.main_app_sensor_nonce_tracking(expires_at);

-- 3. Создаем таблицу для хранения накопленных данных (для batch-отправки)
CREATE TABLE IF NOT EXISTS public.main_app_sensor_batch_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sensor_id UUID NOT NULL REFERENCES public.main_app_sensor(id) ON DELETE CASCADE,
    encrypted_payload TEXT NOT NULL, -- Зашифрованные данные измерений
    measurements_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE NULL,
    is_processed BOOLEAN DEFAULT FALSE
);

-- Индекс для поиска необработанных batch-данных
CREATE INDEX IF NOT EXISTS idx_sensor_batch_data_unprocessed 
ON public.main_app_sensor_batch_data(sensor_id, is_processed, created_at);

-- 4. Комментарии для документации
COMMENT ON COLUMN public.main_app_sensor.nonce_window_start IS 'Начальное значение текущего окна nonce';
COMMENT ON COLUMN public.main_app_sensor.nonce_window_size IS 'Размер окна nonce (по умолчанию 1000)';
COMMENT ON COLUMN public.main_app_sensor.last_sync_timestamp IS 'Последняя синхронизация времени с устройством';
COMMENT ON COLUMN public.main_app_sensor.device_clock_offset IS 'Смещение часов устройства относительно сервера (секунды)';
COMMENT ON COLUMN public.main_app_sensor.sync_status IS 'Статус синхронизации: synchronized, needs_sync, syncing';

COMMENT ON TABLE public.main_app_sensor_nonce_tracking IS 'Отслеживание использованных nonce для защиты от replay-атак';
COMMENT ON TABLE public.main_app_sensor_batch_data IS 'Хранение накопленных данных для batch-обработки';

-- 5. Функция для очистки старых nonce (вызывать периодически)
CREATE OR REPLACE FUNCTION cleanup_expired_nonces()
RETURNS void AS $$
BEGIN
    DELETE FROM public.main_app_sensor_nonce_tracking 
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 6. Обновляем существующий сенсор для тестирования
UPDATE public.main_app_sensor 
SET 
    nonce_window_start = 1000,
    nonce_window_size = 1000,
    last_sync_timestamp = EXTRACT(EPOCH FROM NOW())::BIGINT,
    device_clock_offset = 0,
    sync_status = 'synchronized'
WHERE serial_number = 'GLU-6F60C3CB95B2';

-- 7. Создаем представление для мониторинга безопасности
CREATE OR REPLACE VIEW public.sensor_security_status AS
SELECT 
    s.id,
    s.serial_number,
    s.name,
    s.active,
    s.sync_status,
    s.nonce_window_start,
    s.nonce_window_size,
    s.request_counter,
    s.last_request,
    s.last_sync_timestamp,
    s.device_clock_offset,
    COUNT(nt.id) as active_nonces,
    COUNT(bd.id) as pending_batches
FROM public.main_app_sensor s
LEFT JOIN public.main_app_sensor_nonce_tracking nt ON s.id = nt.sensor_id AND nt.expires_at > NOW()
LEFT JOIN public.main_app_sensor_batch_data bd ON s.id = bd.sensor_id AND bd.is_processed = FALSE
GROUP BY s.id, s.serial_number, s.name, s.active, s.sync_status, 
         s.nonce_window_start, s.nonce_window_size, s.request_counter, 
         s.last_request, s.last_sync_timestamp, s.device_clock_offset;

COMMENT ON VIEW public.sensor_security_status IS 'Представление для мониторинга состояния безопасности сенсоров';
