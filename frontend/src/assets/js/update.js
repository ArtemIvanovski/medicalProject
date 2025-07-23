// Обновление уведомлений (через API endpoint)
async function updateNotifications() {
    try {
        const response = await fetch('/api/notifications_count/');
        if (response.ok) {
            const data = await response.json();
            const count = data.notifications;
            const displayValue = (count > 9) ? "9+" : count;
            document.getElementById("notifications-badge").textContent = displayValue;
        }
    } catch (error) {
        console.error('Ошибка при обновлении уведомлений:', error);
    }
}

// Обновление сообщений (через API endpoint)
async function updateMessages() {
    try {
        const response = await fetch('/api/messages_count/');
        if (response.ok) {
            const data = await response.json();
            const count = data.messages;
            const displayValue = (count > 9) ? "9+" : count;
            document.getElementById("messages-badge").textContent = displayValue;
        }
    } catch (error) {
        console.error('Ошибка при обновлении сообщений:', error);
    }
}

// Вызываем обновление сразу при загрузке страницы
updateNotifications();
updateMessages();

// Устанавливаем таймер на обновление каждые 30 секунд
setInterval(() => {
    updateNotifications();
    updateMessages();
}, 30000);