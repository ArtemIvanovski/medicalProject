from django.urls import path
from . import views

app_name = 'nutrition'

urlpatterns = [
    path('search/', views.ProductSearchView.as_view(), name='product-search'),

    path('user-products/', views.UserProductListCreateView.as_view(), name='user-products'),
    path('user-products/<uuid:pk>/', views.UserProductDetailView.as_view(), name='user-product-detail'),

    path('recipes/', views.RecipeListCreateView.as_view(), name='recipes'),
    path('recipes/<uuid:pk>/', views.RecipeDetailView.as_view(), name='recipe-detail'),

    path('favorites/', views.FavoriteProductListView.as_view(), name='favorite-products'),
    path('favorites/<int:product_id>/remove/', views.remove_favorite_product, name='remove-favorite'),

    path('daily-goal/', views.DailyGoalView.as_view(), name='daily-goal'),

    path('intakes/', views.FoodIntakeListCreateView.as_view(), name='food-intakes'),
    path('intakes/<uuid:pk>/', views.FoodIntakeDetailView.as_view(), name='food-intake-detail'),
    path('intakes/quick-add/', views.quick_add_intake, name='quick-add-intake'),

    path('stats/daily/', views.daily_nutrition_stats, name='daily-stats'),
    path('stats/period/', views.nutrition_period_stats, name='period-stats'),
    path('stats/timeline/', views.nutrition_timeline, name='nutrition-timeline'),
    path('stats/top-products/', views.top_products, name='top-products'),

    path('dashboard/', views.nutrition_dashboard, name='nutrition-dashboard'),
]