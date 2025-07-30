import requests
from bs4 import BeautifulSoup
import re
import time
import random
from django.core.cache import cache
from django.conf import settings
from .exceptions import DrugSearchException


class TabletkaByClient:
    BASE_URL = "https://tabletka.by"
    AUTOCOMPLETE_URL = f"{BASE_URL}/ajax-request/autocomplete/"

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'X-Requested-With': 'XMLHttpRequest'
        })
        self.csrf_token = None
        self.last_request_time = 0
        self.min_delay = 0.5
        self._init_session()

    def _init_session(self):
        """Инициализация сессии и получение CSRF токена"""
        try:
            response = self.session.get(self.BASE_URL, timeout=10)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')
            csrf_input = soup.find('input', {'name': '_csrf'})
            if csrf_input:
                self.csrf_token = csrf_input.get('value')

            if not self.csrf_token:
                csrf_meta = soup.find('meta', {'name': 'csrf-token'})
                if csrf_meta:
                    self.csrf_token = csrf_meta.get('content')

            if not self.csrf_token:
                raise DrugSearchException("CSRF token not found")

        except Exception as e:
            raise DrugSearchException(f"Session initialization failed: {str(e)}")

    def _throttle_request(self):
        """Контроль частоты запросов"""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.min_delay:
            time.sleep(self.min_delay - time_since_last)
        self.last_request_time = time.time()
        time.sleep(random.uniform(0.1, 0.3))  # Случайная задержка

    def search_drugs(self, query):
        """Поиск лекарств по запросу"""
        if not query or len(query.strip()) < 2:
            return []

        # Проверяем кэш
        cache_key = f"drug_search:{query.lower()}"
        cached_result = cache.get(cache_key)
        if cached_result:
            return cached_result

        self._throttle_request()

        try:
            data = {'query': query}
            if self.csrf_token:
                data['_csrf'] = self.csrf_token

            response = self.session.post(
                self.AUTOCOMPLETE_URL,
                data=data,
                headers={
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Origin': self.BASE_URL,
                    'Referer': f"{self.BASE_URL}/"
                },
                timeout=10
            )

            if response.status_code == 200:
                json_data = response.json()
                if json_data.get('status') == 1:
                    results = self._parse_results(json_data.get('data', ''))
                    # Кэшируем на 1 час
                    cache.set(cache_key, results, timeout=3600)
                    return results
                else:
                    return []
            elif response.status_code in [403, 419]:
                self._init_session()  # Обновляем сессию
                return self.search_drugs(query)  # Повторяем запрос
            else:
                raise DrugSearchException(f"API returned {response.status_code}")

        except Exception as e:
            raise DrugSearchException(f"Search failed: {str(e)}")

    def _parse_results(self, html_data):
        """Парсинг HTML результатов"""
        if not html_data:
            return []

        soup = BeautifulSoup(html_data, 'html.parser')
        items = soup.find_all('li', class_='select-check-item')

        results = []
        for item in items:
            text = item.get_text().replace('\xa0', ' ').strip()
            if text:
                # Извлекаем основное название лекарства
                match = re.search(r'^(.*?)(?:\+|&nbsp|$)', text)
                if match:
                    drug_name = match.group(1).strip()
                    if drug_name not in results:  # Убираем дубликаты
                        results.append(drug_name)

        return results