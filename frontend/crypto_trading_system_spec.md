# Техническое задание: Система автоматической торговли криптовалютой

## 1. Общее описание проекта

### 1.1 Назначение системы
Разработка веб-платформы для автоматической торговли криптовалютой на основе торговых сигналов, получаемых из закрытых Telegram каналов. Система должна автоматически парсить сигналы, интерпретировать их и выполнять торговые операции на выбранных пользователем биржах.

### 1.2 Цели проекта
- Автоматизация процесса торговли криптовалютой
- Снижение человеческого фактора при принятии торговых решений
- Обеспечение быстрого входа в сделки по сигналам
- Управление рисками через автоматические стоп-лоссы и тейк-профиты

### 1.3 Ключевые особенности
- Парсинг сигналов из закрытых Telegram каналов
- Интеграция с 5 ведущими криптовалютными биржами
- Гибкие настройки риск-менеджмента
- Веб-интерфейс для управления торговлей
- Система подписок и платежей

## 2. Архитектура системы

### 2.1 Общая архитектура

```puml
@startuml system_architecture
!theme plain

package "Frontend" {
  component [Web Dashboard] as WD
  component [User Settings] as US
  component [Trading Interface] as TI
}

package "Backend Services" {
  component [Authentication Service] as AS
  component [Payment Service] as PS
  component [Signal Parser] as SP
  component [Trading Engine] as TE
  component [Risk Manager] as RM
  component [Order Manager] as OM
}

package "External Services" {
  component [Telegram API] as TG
  database [Signal Channels] as SC
  component [Bybit API] as BY
  component [Binance API] as BN
  component [HTX API] as HT
  component [OKX API] as OK
  component [MEXC API] as MX
  component [Payment Gateway] as PG
}

database "System Database" {
  component [Users] as U
  component [Signals] as S
  component [Orders] as O
  component [Settings] as SET
}

WD --> AS
WD --> TI
US --> AS
TI --> TE

AS --> U
PS --> PG
PS --> U

SP --> TG
TG --> SC
SP --> S

TE --> OM
TE --> RM
OM --> BY
OM --> BN
OM --> HT
OM --> OK
OM --> MX

RM --> O
TE --> O
@enduml
```

### 2.2 Диаграмма последовательности торгового процесса

```puml
@startuml trading_sequence
!theme plain

actor User
participant "Web Dashboard" as WD
participant "Signal Parser" as SP
participant "Trading Engine" as TE
participant "Risk Manager" as RM
participant "Order Manager" as OM
participant "Exchange API" as EX
participant "Telegram" as TG

User -> WD: Настройка торговых параметров
WD -> WD: Сохранение настроек пользователя

loop Непрерывный мониторинг
    SP -> TG: Мониторинг новых сообщений
    TG -> SP: Новый сигнал
    SP -> SP: Парсинг и валидация сигнала
    SP -> TE: Передача обработанного сигнала
    
    TE -> RM: Проверка риск-параметров
    RM -> TE: Подтверждение/отклонение сделки
    
    alt Сделка одобрена
        TE -> OM: Создание ордера
        OM -> EX: Размещение ордера на бирже
        EX -> OM: Подтверждение ордера
        OM -> TE: Уведомление о размещении
        
        TE -> OM: Установка Take Profit ордеров
        TE -> OM: Установка Stop Loss ордера
        
        loop Мониторинг позиции
            OM -> EX: Проверка статуса ордеров
            EX -> OM: Статус ордеров
            
            alt Take Profit достигнут
                OM -> TE: Уведомление о частичном закрытии
                TE -> OM: Перенос Stop Loss в безубыток
            end
        end
    end
end

TE -> WD: Обновление статуса торговли
WD -> User: Отображение результатов
@enduml
```

## 3. Функциональные требования

### 3.1 Модуль парсинга Telegram сигналов

#### 3.1.1 Основные функции
- Подключение к Telegram API через сессию аккаунта
- Мониторинг указанных закрытых каналов в реальном времени
- Парсинг торговых сигналов согласно предустановленным шаблонам
- Валидация и нормализация данных сигналов

#### 3.1.2 Формат обрабатываемых сигналов
```
Пример сигнала:
FUTURE TRADE (SEASON 2)
$RATS
Margin : 100-300$ 
Leverage : 5-25X
Type : Cross
Future Wallet: 1500$
Entry Price : 0.014- 0.018
TP1: 0.019
TP2: 0.02
TP3: 0.0205
TP4: 0.021
STOP LOSS 🛑 : 0.012
Holding Time: NA
CMC LINK : https://coinmarketcap.com/currencies/rats-ordinals/
```

#### 3.1.3 Алгоритм парсинга
```puml
@startuml signal_parsing
!theme plain

start
:Получение нового сообщения;
:Проверка на соответствие формату сигнала;

if (Сообщение содержит торговый сигнал?) then (да)
  :Извлечение тикера валюты;
  :Извлечение цены входа;
  :Извлечение уровней Take Profit;
  :Извлечение Stop Loss;
  :Извлечение типа позиции (Long/Short);
  :Извлечение плеча;
  :Извлечение типа маржи (Cross/Isolated);
  
  :Валидация числовых значений;
  :Проверка на лишние/недостающие нули;
  :Нормализация данных;
  
  if (Данные валидны?) then (да)
    :Сохранение сигнала в БД;
    :Отправка в торговый движок;
  else (нет)
    :Логирование ошибки;
    :Уведомление администратора;
  endif
else (нет)
  :Игнорирование сообщения;
endif

stop
@enduml
```

### 3.2 Веб-интерфейс пользователя

#### 3.2.1 Страницы системы
1. **Регистрация/Авторизация**
   - Форма регистрации нового пользователя
   - Авторизация существующих пользователей
   - Восстановление пароля

2. **Выбор тарифного плана**
   - Отображение доступных планов подписки
   - Интеграция с платежной системой
   - Подтверждение оплаты

3. **Настройки биржи**
   - Выбор биржи из списка: Bybit, Binance, HTX, OKX, MEXC
   - Ввод API ключей (API Key, Secret Key)
   - Тестирование подключения к бирже

4. **Торговые настройки**
   - Настройка плеча (leverage) для сделок
   - Установка размера позиции (% от депозита или фиксированная сумма)
   - Настройка типа маржи (Cross/Isolated)
   - Настройка автоматического Stop Loss (в %)
   - Включение/отключение автоторговли

5. **Торговая панель**
   - Отображение активных позиций
   - История сделок
   - Текущий баланс
   - Статистика прибыли/убытков

#### 3.2.2 Use Case диаграмма

```puml
@startuml use_cases
!theme plain

left to right direction

actor "User" as user
actor "Admin" as admin

package "Trading System" {
  usecase "Регистрация" as UC1
  usecase "Авторизация" as UC2
  usecase "Оплата подписки" as UC3
  usecase "Настройка биржи" as UC4
  usecase "API ключи" as UC5
  usecase "Торговые настройки" as UC6
  usecase "Просмотр позиций" as UC7
  usecase "История торговли" as UC8
  usecase "Управление сигналами" as UC9
  usecase "Мониторинг системы" as UC10
}

user --> UC1
user --> UC2
user --> UC3
user --> UC4
user --> UC5
user --> UC6
user --> UC7
user --> UC8

admin --> UC9
admin --> UC10

UC4 ..> UC5 : includes
UC6 ..> UC4 : extends
@enduml
```

### 3.3 Торговый движок

#### 3.3.1 Основные функции
- Получение обработанных сигналов от парсера
- Применение пользовательских настроек к сигналу
- Расчет размера позиции
- Выставление ордеров через API бирж
- Управление позициями и ордерами

#### 3.3.2 Алгоритм обработки сигнала

```puml
@startuml signal_processing
!theme plain

start
:Получение нового сигнала;
:Загрузка настроек пользователя;

if (Автоторговля включена?) then (да)
  :Проверка доступности средств;
  :Расчет размера позиции;
  
  if (Достаточно средств?) then (да)
    :Создание рыночного ордера;
    :Размещение ордера на бирже;
    
    if (Ордер исполнен?) then (да)
      :Установка Take Profit ордеров;
      :Установка Stop Loss ордера;
      :Запуск мониторинга позиции;
    else (нет)
      :Логирование ошибки;
    endif
  else (нет)
    :Уведомление о недостатке средств;
  endif
else (нет)
  :Уведомление пользователя о новом сигнале;
endif

stop
@enduml
```

### 3.4 Система управления рисками

#### 3.4.1 Функции риск-менеджмента
- Проверка максимального размера позиции
- Валидация плеча согласно настройкам пользователя
- Автоматический перенос Stop Loss в безубыток после первого Take Profit
- Контроль общего риска портфеля

#### 3.4.2 Алгоритм управления Take Profit

```puml
@startuml take_profit_management
!theme plain

start
:Мониторинг активной позиции;

if (Достигнут TP1?) then (да)
  :Частичное закрытие позиции (25%);
  :Перенос Stop Loss в точку входа;
  
  if (Достигнут TP2?) then (да)
    :Частичное закрытие позиции (25%);
    :Перенос Stop Loss выше точки входа;
    
    if (Достигнут TP3?) then (да)
      :Частичное закрытие позиции (25%);
      :Трейлинг Stop Loss;
      
      if (Достигнут TP4?) then (да)
        :Закрытие оставшейся позиции (25%);
        :Завершение сделки;
      endif
    endif
  endif
else (нет)
  if (Достигнут Stop Loss?) then (да)
    :Полное закрытие позиции;
    :Фиксация убытка;
  endif
endif

stop
@enduml
```

## 4. Интеграция с биржами

### 4.1 Поддерживаемые биржи
1. **Bybit** - основная биржа для фьючерсной торговли
2. **Binance** - крупнейшая криптовалютная биржа
3. **HTX** (бывший Huobi) - азиатская биржа
4. **OKX** - глобальная торговая платформа
5. **MEXC** - биржа с широким выбором альткоинов

### 4.2 Требуемые API методы для каждой биржи

#### 4.2.1 Методы для получения информации
- Получение баланса аккаунта
- Получение информации о торговых парах
- Получение текущих цен
- Получение информации о позициях
- История ордеров

#### 4.2.2 Методы для торговли
- Размещение рыночных ордеров
- Размещение лимитных ордеров
- Размещение стоп-ордеров
- Отмена ордеров
- Изменение плеча
- Переключение режима маржи

### 4.3 Диаграмма взаимодействия с API биржи

```puml
@startuml exchange_api_interaction
!theme plain

participant "Trading Engine" as TE
participant "Order Manager" as OM
participant "Exchange API" as API
participant "Exchange" as EX

TE -> OM: Создать позицию
OM -> API: Проверить баланс
API -> EX: GET /account/balance
EX -> API: Данные баланса
API -> OM: Баланс получен

OM -> API: Установить плечо
API -> EX: POST /leverage/set
EX -> API: Плечо установлено

OM -> API: Создать рыночный ордер
API -> EX: POST /order/market
EX -> API: Ордер создан
API -> OM: ID ордера

OM -> API: Создать Take Profit ордера
loop Для каждого TP уровня
    API -> EX: POST /order/limit
    EX -> API: TP ордер создан
end

OM -> API: Создать Stop Loss ордер
API -> EX: POST /order/stop
EX -> API: SL ордер создан

OM -> TE: Позиция открыта
@enduml
```

## 5. База данных

### 5.1 Схема базы данных

```puml
@startuml database_schema
!define table(x) class x << (T,#FFAAAA) >>
!define pk(x) <u>x</u>
!define fk(x) <i>x</i>

table(users) {
  pk(id): INT
  email: VARCHAR(255)
  password_hash: VARCHAR(255)
  created_at: DATETIME
  subscription_expires: DATETIME
  is_active: BOOLEAN
}

table(exchange_settings) {
  pk(id): INT
  fk(user_id): INT
  exchange_name: ENUM
  api_key: VARCHAR(255)
  api_secret: VARCHAR(255)
  is_active: BOOLEAN
  created_at: DATETIME
}

table(trading_settings) {
  pk(id): INT
  fk(user_id): INT
  leverage: INT
  position_size_type: ENUM
  position_size_value: DECIMAL
  margin_type: ENUM
  auto_stop_loss_percent: DECIMAL
  auto_trading_enabled: BOOLEAN
}

table(signals) {
  pk(id): INT
  channel_name: VARCHAR(100)
  ticker: VARCHAR(20)
  entry_price_min: DECIMAL
  entry_price_max: DECIMAL
  take_profit_1: DECIMAL
  take_profit_2: DECIMAL
  take_profit_3: DECIMAL
  take_profit_4: DECIMAL
  stop_loss: DECIMAL
  leverage: INT
  margin_type: ENUM
  signal_time: DATETIME
  processed: BOOLEAN
}

table(orders) {
  pk(id): INT
  fk(user_id): INT
  fk(signal_id): INT
  exchange_name: ENUM
  exchange_order_id: VARCHAR(100)
  ticker: VARCHAR(20)
  order_type: ENUM
  side: ENUM
  quantity: DECIMAL
  price: DECIMAL
  status: ENUM
  created_at: DATETIME
  filled_at: DATETIME
}

table(positions) {
  pk(id): INT
  fk(user_id): INT
  fk(signal_id): INT
  exchange_name: ENUM
  ticker: VARCHAR(20)
  side: ENUM
  entry_price: DECIMAL
  quantity: DECIMAL
  current_pnl: DECIMAL
  status: ENUM
  opened_at: DATETIME
  closed_at: DATETIME
}

users ||--o{ exchange_settings
users ||--o{ trading_settings  
users ||--o{ orders
users ||--o{ positions
signals ||--o{ orders
signals ||--o{ positions
@enduml
```

## 6. Технические требования

### 6.1 Технологический стек

#### 6.1.1 Backend
- **Язык программирования**: Python 3.9+
- **Framework**: FastAPI или Django REST Framework
- **База данных**: PostgreSQL 13+
- **ORM**: SQLAlchemy или Django ORM
- **Очереди задач**: Celery + Redis
- **WebSocket**: для real-time уведомлений

#### 6.1.2 Frontend
- **Framework**: React.js или Vue.js
- **UI библиотека**: Material-UI или Ant Design
- **State management**: Redux или Vuex
- **Графики**: TradingView Charting Library или Chart.js

#### 6.1.3 Инфраструктура
- **Контейнеризация**: Docker + Docker Compose
- **Веб-сервер**: Nginx
- **Мониторинг**: Grafana + Prometheus
- **Логирование**: ELK Stack (Elasticsearch, Logstash, Kibana)

### 6.2 Требования к производительности
- Время обработки сигнала: не более 5 секунд
- Время размещения ордера: не более 3 секунд
- Поддержка одновременной работы: до 1000 пользователей
- Доступность системы: 99.5%

### 6.3 Требования к безопасности
- Шифрование API ключей в базе данных (AES-256)
- HTTPS для всех соединений
- JWT токены для аутентификации
- Rate limiting для API запросов
- Логирование всех торговых операций

## 7. Интеграция с платежной системой

### 7.1 Поддерживаемые способы оплаты
- Банковские карты (Visa, MasterCard)
- Криптовалютные платежи (BTC, ETH, USDT)
- Электронные кошельки (PayPal, WebMoney)

### 7.2 Тарифные планы
- **Базовый**: $99/месяц - 1 биржа, базовые настройки
- **Продвинутый**: $199/месяц - 3 биржи, расширенные настройки
- **Профессиональный**: $399/месяц - все биржи, все функции

## 8. Мониторинг и логирование

### 8.1 Ключевые метрики
- Количество обработанных сигналов
- Время отклика API бирж
- Процент успешных сделок
- Количество активных пользователей
- Суммарный объем торгов

### 8.2 Типы логов
- Торговые операции (все ордера и их статусы)
- Ошибки парсинга сигналов
- Ошибки API бирж
- Действия пользователей
- Системные ошибки

## 9. Этапы разработки

### 9.1 Этап 1 (MVP) - 4 недели
- Базовая архитектура системы
- Парсинг сигналов из одного Telegram канала
- Интеграция с одной биржей (Bybit)
- Простой веб-интерфейс для настроек
- Базовая функциональность торговли

### 9.2 Этап 2 - 3 недели
- Интеграция с остальными биржами
- Расширенные настройки риск-менеджмента
- Улучшенный пользовательский интерфейс
- Система платежей и подписок

### 9.3 Этап 3 - 2 недели
- Мониторинг и аналитика
- Оптимизация производительности
- Тестирование и отладка
- Развертывание в продакшен

## 10. Риски и ограничения

### 10.1 Технические риски
- Нестабильность API бирж
- Ограничения скорости запросов
- Сбои в работе Telegram API
- Изменения формата сигналов

### 10.2 Финансовые риски
- Потери от неправильной торговли
- Слипедж при исполнении ордеров
- Комиссии бирж
- Волатильность криптовалютного рынка

### 10.3 Регулятивные риски
- Изменения в законодательстве о криптовалютах
- Блокировка бирж в некоторых юрисдикциях
- Требования по KYC/AML

## 11. Заключение

Данная система представляет собой комплексное решение для автоматизации криптовалютной торговли. Успех проекта зависит от качественной реализации всех компонентов, особенно парсинга сигналов и интеграции с биржами. Важно предусмотреть механизмы обработки ошибок и восстановления после сбоев, а также обеспечить высокий уровень безопасности для защиты средств пользователей.