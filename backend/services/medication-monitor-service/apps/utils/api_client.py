import requests
from django.conf import settings
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


class SafeSession(requests.Session):
    """Сессия с повторными попытками и таймаутами"""

    def __init__(self):
        super().__init__()
        self.timeout = settings.REQUEST_TIMEOUT
        retry_strategy = Retry(
            total=settings.MAX_RETRIES,
            backoff_factor=0.3,
            status_forcelist=[429, 500, 502, 503, 504]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.mount("https://", adapter)
        self.mount("http://", adapter)

    def request(self, method, url, **kwargs):
        kwargs.setdefault('timeout', self.timeout)
        return super().request(method, url, **kwargs)