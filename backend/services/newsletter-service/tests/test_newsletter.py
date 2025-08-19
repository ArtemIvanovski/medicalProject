from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.newsletter.models import NewsletterSubscriber


class NewsletterAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.subscribe_url = reverse('newsletter-subscribe')
        self.unsubscribe_url = reverse('newsletter-unsubscribe')
        self.stats_url = reverse('newsletter-stats')

    def test_subscribe_valid_email(self):
        """Тест успешной подписки с валидным email"""
        data = {'email': 'test@example.com'}
        response = self.client.post(self.subscribe_url, data)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertTrue(NewsletterSubscriber.objects.filter(email='test@example.com').exists())

    def test_subscribe_invalid_email(self):
        """Тест подписки с невалидным email"""
        data = {'email': 'invalid-email'}
        response = self.client.post(self.subscribe_url, data)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_subscribe_duplicate_email(self):
        """Тест подписки с уже существующим email"""
        NewsletterSubscriber.objects.create(email='test@example.com')
        
        data = {'email': 'test@example.com'}
        response = self.client.post(self.subscribe_url, data)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_unsubscribe_existing_email(self):
        """Тест отписки существующего email"""
        NewsletterSubscriber.objects.create(email='test@example.com', is_active=True)
        
        data = {'email': 'test@example.com'}
        response = self.client.post(self.unsubscribe_url, data)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        
        # Проверяем, что подписка деактивирована
        subscriber = NewsletterSubscriber.objects.get(email='test@example.com')
        self.assertFalse(subscriber.is_active)

    def test_unsubscribe_nonexistent_email(self):
        """Тест отписки несуществующего email"""
        data = {'email': 'nonexistent@example.com'}
        response = self.client.post(self.unsubscribe_url, data)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_newsletter_stats(self):
        """Тест получения статистики"""
        # Создаем тестовые подписки
        NewsletterSubscriber.objects.create(email='active1@example.com', is_active=True)
        NewsletterSubscriber.objects.create(email='active2@example.com', is_active=True)
        NewsletterSubscriber.objects.create(email='inactive@example.com', is_active=False)
        
        response = self.client.get(self.stats_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['active_subscribers'], 2)
        self.assertEqual(response.data['data']['total_subscribers_all_time'], 3)
