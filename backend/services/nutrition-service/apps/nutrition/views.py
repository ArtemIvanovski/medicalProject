from datetime import datetime
from django.db import models
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Product, UserProduct, Recipe, RecipeIngredient,
    FavoriteProduct, DailyGoal, FoodIntake
)
from .serializers import (
    ProductSerializer, UserProductSerializer, CreateUserProductSerializer,
    RecipeSerializer, CreateRecipeSerializer, FavoriteProductSerializer,
    DailyGoalSerializer, UpdateDailyGoalSerializer, FoodIntakeSerializer,
    CreateFoodIntakeSerializer, NutritionStatsSerializer, ProductSearchSerializer,
    NutritionTimelineSerializer
)
from .services import (
    ProductSearchService, NutritionCalculatorService,
    NutritionStatsService, RecipeService
)


class ProductSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = ProductSearchSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        query = serializer.validated_data['query']
        include_favorites = serializer.validated_data['include_favorites']
        include_user_products = serializer.validated_data['include_user_products']
        include_recipes = serializer.validated_data['include_recipes']
        limit = serializer.validated_data['limit']

        results = ProductSearchService.search_products(
            user=request.user,
            query=query,
            include_favorites=include_favorites,
            include_user_products=include_user_products,
            include_recipes=include_recipes,
            limit=limit
        )

        return Response({
            'query': query,
            'favorites': ProductSerializer(results['favorites'], many=True).data,
            'products': ProductSerializer(results['products'], many=True).data,
            'user_products': UserProductSerializer(results['user_products'], many=True).data,
            'recipes': RecipeSerializer(results['recipes'], many=True).data
        })


class UserProductListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserProduct.objects.filter(user=self.request.user, is_deleted=False)

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateUserProductSerializer
        return UserProductSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class UserProductDetailView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserProductSerializer

    def get_queryset(self):
        return UserProduct.objects.filter(user=self.request.user, is_deleted=False)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()


class RecipeListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Recipe.objects.filter(user=self.request.user, is_deleted=False).prefetch_related('ingredients')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateRecipeSerializer
        return RecipeSerializer

    def perform_create(self, serializer):
        name = serializer.validated_data['name']
        description = serializer.validated_data.get('description', '')
        servings = serializer.validated_data.get('servings', 1)
        ingredients_data = serializer.validated_data['ingredients']

        recipe = RecipeService.create_recipe_with_ingredients(
            user=self.request.user,
            recipe_data={'name': name, 'description': description, 'servings': servings},
            ingredients_data=ingredients_data
        )

        return Response(RecipeSerializer(recipe).data, status=status.HTTP_201_CREATED)


class RecipeDetailView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = RecipeSerializer

    def get_queryset(self):
        return Recipe.objects.filter(user=self.request.user, is_deleted=False).prefetch_related('ingredients')

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()


class FavoriteProductListView(ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FavoriteProductSerializer

    def get_queryset(self):
        return FavoriteProduct.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_favorite_product(request, product_id):
    try:
        favorite = FavoriteProduct.objects.get(
            user=request.user,
            product_id=product_id
        )
        favorite.delete()
        return Response({'success': True})
    except FavoriteProduct.DoesNotExist:
        return Response({'error': 'Favorite not found'}, status=404)


class DailyGoalView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            daily_goal = DailyGoal.objects.get(user=request.user)
            serializer = DailyGoalSerializer(daily_goal)
            return Response(serializer.data)
        except DailyGoal.DoesNotExist:
            return Response({'error': 'Daily goal not set'}, status=404)

    def post(self, request):
        serializer = UpdateDailyGoalSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        daily_goal, created = DailyGoal.objects.get_or_create(
            user=request.user,
            defaults=serializer.validated_data
        )

        if not created:
            for key, value in serializer.validated_data.items():
                setattr(daily_goal, key, value)

        daily_goal.calculate_goals()

        serializer = DailyGoalSerializer(daily_goal)
        return Response(serializer.data, status=201 if created else 200)


class FoodIntakeListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return FoodIntake.objects.filter(user=self.request.user, is_deleted=False)

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateFoodIntakeSerializer
        return FoodIntakeSerializer

    def perform_create(self, serializer):
        product_id = serializer.validated_data.get('product_id')
        user_product_id = serializer.validated_data.get('user_product_id')
        recipe_id = serializer.validated_data.get('recipe_id')

        food_intake = FoodIntake.objects.create(
            user=self.request.user,
            product_id=product_id,
            user_product_id=user_product_id,
            recipe_id=recipe_id,
            amount=serializer.validated_data['amount'],
            unit=serializer.validated_data.get('unit', 'g'),
            consumed_at=serializer.validated_data['consumed_at'],
            notes=serializer.validated_data.get('notes', '')
        )

        return Response(FoodIntakeSerializer(food_intake).data, status=201)


class FoodIntakeDetailView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FoodIntakeSerializer

    def get_queryset(self):
        return FoodIntake.objects.filter(user=self.request.user, is_deleted=False)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def daily_nutrition_stats(request):
    date_str = request.GET.get('date')
    if date_str:
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=400)
    else:
        target_date = timezone.now().date()

    stats = NutritionStatsService.get_daily_stats(request.user, target_date)
    serializer = NutritionStatsSerializer(stats)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def nutrition_timeline(request):
    serializer = NutritionTimelineSerializer(data=request.query_params)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    days = serializer.validated_data['days']
    group_by = serializer.validated_data['group_by']

    timeline = NutritionStatsService.get_nutrition_timeline(
        user=request.user,
        days=days,
        group_by=group_by
    )

    if group_by == 'day':
        return Response({
            'days': days,
            'group_by': group_by,
            'timeline': timeline
        })
    else:
        serializer = FoodIntakeSerializer(timeline, many=True)
        return Response({
            'days': days,
            'group_by': group_by,
            'intakes': serializer.data
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def nutrition_period_stats(request):
    days = int(request.GET.get('days', 7))
    if days < 1 or days > 90:
        return Response({'error': 'Days must be between 1 and 90'}, status=400)

    stats = NutritionStatsService.get_period_stats(request.user, days)
    serializer = NutritionStatsSerializer(stats, many=True)

    return Response({
        'period_days': days,
        'stats': serializer.data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def top_products(request):
    days = int(request.GET.get('days', 30))
    limit = int(request.GET.get('limit', 10))

    if days < 1 or days > 365:
        return Response({'error': 'Days must be between 1 and 365'}, status=400)

    if limit < 1 or limit > 50:
        return Response({'error': 'Limit must be between 1 and 50'}, status=400)

    top_products = NutritionStatsService.get_top_products(
        user=request.user,
        days=days,
        limit=limit
    )

    return Response({
        'period_days': days,
        'limit': limit,
        'top_products': top_products
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def nutrition_dashboard(request):
    today_stats = NutritionStatsService.get_daily_stats(request.user)
    week_stats = NutritionStatsService.get_period_stats(request.user, 7)
    top_products_week = NutritionStatsService.get_top_products(request.user, 7, 5)

    try:
        daily_goal = DailyGoal.objects.get(user=request.user)
        goal_data = DailyGoalSerializer(daily_goal).data
    except DailyGoal.DoesNotExist:
        goal_data = None

    recent_intakes = FoodIntake.objects.filter(
        user=request.user,
        is_deleted=False
    ).order_by('-consumed_at')[:10]

    return Response({
        'today': NutritionStatsSerializer(today_stats).data,
        'week_stats': NutritionStatsSerializer(week_stats, many=True).data,
        'top_products': top_products_week,
        'daily_goal': goal_data,
        'recent_intakes': FoodIntakeSerializer(recent_intakes, many=True).data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quick_add_intake(request):
    data = request.data.copy()
    data['consumed_at'] = timezone.now().isoformat()

    serializer = CreateFoodIntakeSerializer(data=data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    product_id = serializer.validated_data.get('product_id')
    user_product_id = serializer.validated_data.get('user_product_id')
    recipe_id = serializer.validated_data.get('recipe_id')

    food_intake = FoodIntake.objects.create(
        user=request.user,
        product_id=product_id,
        user_product_id=user_product_id,
        recipe_id=recipe_id,
        amount=serializer.validated_data['amount'],
        unit=serializer.validated_data.get('unit', 'g'),
        consumed_at=timezone.now(),
        notes=serializer.validated_data.get('notes', '')
    )

    return Response({
        'success': True,
        'intake': FoodIntakeSerializer(food_intake).data
    }, status=201)