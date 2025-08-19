from datetime import datetime

from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .drive_service import DriveService
from .models import (
    Recipe, FavoriteProduct, DailyGoal, FoodIntake, UserProfile, Gender
)
from .models import UserProduct
from .serializers import (
    ProductSerializer, UserProductSerializer, CreateUserProductSerializer,
    RecipeSerializer, CreateRecipeSerializer, FavoriteProductSerializer,
    DailyGoalSerializer, UpdateDailyGoalSerializer, FoodIntakeSerializer,
    CreateFoodIntakeSerializer, NutritionStatsSerializer, ProductSearchSerializer,
    NutritionTimelineSerializer
)
from .services import (
    ProductSearchService, NutritionStatsService, RecipeService, DailyGoalService
)


@require_http_methods(["POST"])
@csrf_exempt
def upload_product_image(request, product_id):
    if request.user.is_anonymous:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    if 'image' not in request.FILES:
        return JsonResponse({'error': 'No file provided'}, status=400)

    try:
        user_product = UserProduct.objects.get(
            id=product_id,
            user=request.user,
            is_deleted=False
        )
    except UserProduct.DoesNotExist:
        return JsonResponse({'error': 'Product not found'}, status=404)

    file = request.FILES['image']
    drive_service = DriveService()

    try:
        file_id = drive_service.upload_product_image(file, user_product.image_drive_id)
        user_product.image_drive_id = file_id
        user_product.save()
        return JsonResponse({'success': True, 'file_id': file_id})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_http_methods(["DELETE"])
@csrf_exempt
def delete_product_image(request, product_id):
    if request.user.is_anonymous:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    try:
        user_product = UserProduct.objects.get(
            id=product_id,
            user=request.user,
            is_deleted=False
        )
    except UserProduct.DoesNotExist:
        return JsonResponse({'error': 'Product not found'}, status=404)

    if not user_product.image_drive_id:
        return JsonResponse({'error': 'No image to delete'}, status=400)

    drive_service = DriveService()

    try:
        drive_service.remove_file(user_product.image_drive_id)
        user_product.image_drive_id = None
        user_product.save()
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_http_methods(["GET"])
def get_product_image(request, file_id):
    drive_service = DriveService()

    try:
        print(f"Attempting to get product image with file_id: {file_id}")
        file_content = drive_service.get_file_content(file_id)
        print(f"Successfully retrieved file content, size: {len(file_content)} bytes")
        return HttpResponse(file_content, content_type='image/jpeg')
    except Exception as e:
        print(f"Error getting product image: {str(e)}")
        return JsonResponse({'error': str(e)}, status=404)


@require_http_methods(["POST"])
@csrf_exempt
def upload_recipe_image(request, recipe_id):
    if request.user.is_anonymous:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    if 'image' not in request.FILES:
        return JsonResponse({'error': 'No file provided'}, status=400)

    try:
        recipe = Recipe.objects.get(
            id=recipe_id,
            user=request.user,
            is_deleted=False
        )
    except Recipe.DoesNotExist:
        return JsonResponse({'error': 'Recipe not found'}, status=404)

    file = request.FILES['image']
    drive_service = DriveService()

    try:
        file_id = drive_service.upload_product_image(file, recipe.image_drive_id)
        recipe.image_drive_id = file_id
        recipe.save()
        return JsonResponse({'success': True, 'file_id': file_id})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_http_methods(["DELETE"])
@csrf_exempt
def delete_recipe_image(request, recipe_id):
    if request.user.is_anonymous:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    try:
        recipe = Recipe.objects.get(
            id=recipe_id,
            user=request.user,
            is_deleted=False
        )
    except Recipe.DoesNotExist:
        return JsonResponse({'error': 'Recipe not found'}, status=404)

    if not recipe.image_drive_id:
        return JsonResponse({'error': 'No image to delete'}, status=400)

    drive_service = DriveService()

    try:
        drive_service.remove_file(recipe.image_drive_id)
        recipe.image_drive_id = None
        recipe.save()
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_http_methods(["GET"])
def get_recipe_image(request, file_id):
    drive_service = DriveService()

    try:
        print(f"Attempting to get recipe image with file_id: {file_id}")
        file_content = drive_service.get_file_content(file_id)
        print(f"Successfully retrieved file content, size: {len(file_content)} bytes")
        return HttpResponse(file_content, content_type='image/jpeg')
    except Exception as e:
        print(f"Error getting recipe image: {str(e)}")
        return JsonResponse({'error': str(e)}, status=404)


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

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # Return the created object using UserProductSerializer to include all fields
        instance = serializer.instance
        response_serializer = UserProductSerializer(instance)
        headers = self.get_success_headers(serializer.data)
        
        return Response(response_serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class UserProductDetailView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserProductSerializer

    def get_queryset(self):
        return UserProduct.objects.filter(user=self.request.user, is_deleted=False)

    def perform_destroy(self, instance):
        if instance.image_drive_id:
            from .drive_service import DriveService
            drive_service = DriveService()
            try:
                drive_service.remove_file(instance.image_drive_id)
            except Exception:
                pass
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

    def get_queryset(self):
        return Recipe.objects.filter(user=self.request.user, is_deleted=False).prefetch_related('ingredients')

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return CreateRecipeSerializer
        return RecipeSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        name = serializer.validated_data['name']
        description = serializer.validated_data.get('description', '')
        servings = serializer.validated_data.get('servings', 1)
        ingredients_data = serializer.validated_data['ingredients']

        updated_recipe = RecipeService.update_recipe_with_ingredients(
            recipe_id=instance.id,
            user=request.user,
            recipe_data={'name': name, 'description': description, 'servings': servings},
            ingredients_data=ingredients_data
        )

        return Response(RecipeSerializer(updated_recipe).data, status=status.HTTP_200_OK)

    def perform_destroy(self, instance):
        if hasattr(instance, 'image_drive_id') and instance.image_drive_id:
            from .drive_service import DriveService
            drive_service = DriveService()
            try:
                drive_service.remove_file(instance.image_drive_id)
            except Exception:
                pass
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
        # Always get or create daily goal from user profile
        daily_goal = DailyGoalService.get_or_create_daily_goal(request.user)
        if daily_goal:
            serializer = DailyGoalSerializer(daily_goal)
            return Response(serializer.data)
        else:
            return Response({'error': 'Unable to create daily goal'}, status=500)

    def post(self, request):
        # Get or create daily goal first to ensure it's synced with profile
        daily_goal = DailyGoalService.get_or_create_daily_goal(request.user)
        
        serializer = UpdateDailyGoalSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        # Update only the allowed fields
        for key, value in serializer.validated_data.items():
            setattr(daily_goal, key, value)

        daily_goal.calculate_goals()

        response_serializer = DailyGoalSerializer(daily_goal)
        return Response(response_serializer.data, status=200)


class FoodIntakeListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = FoodIntake.objects.filter(user=self.request.user, is_deleted=False)
        
        # Filter by date if provided
        date_param = self.request.query_params.get('date')
        if date_param:
            try:
                from datetime import datetime, time
                filter_date = datetime.strptime(date_param, '%Y-%m-%d').date()
                # Filter by date range (start of day to end of day)
                start_datetime = datetime.combine(filter_date, time.min)
                end_datetime = datetime.combine(filter_date, time.max)
                queryset = queryset.filter(
                    consumed_at__gte=start_datetime,
                    consumed_at__lte=end_datetime
                )
            except ValueError:
                pass  # Invalid date format, return all results
                
        return queryset.order_by('-consumed_at')

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
        # FoodIntake doesn't have image_drive_id, so we just mark it as deleted
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
        # timeline contains dictionaries with nutrition stats, format them properly
        formatted_timeline = []
        for day_stats in timeline:
            formatted_day = {
                'date': day_stats['date'].isoformat() if day_stats['date'] else None,
                'calories': float(day_stats.get('calories', 0)),
                'protein': float(day_stats.get('protein', 0)),
                'fat': float(day_stats.get('fat', 0)),
                'carbohydrate': float(day_stats.get('carbohydrate', 0)),
                'intakes_count': len(day_stats.get('intakes', []))
            }
            formatted_timeline.append(formatted_day)
            
        return Response({
            'days': days,
            'group_by': group_by,
            'timeline': formatted_timeline
        })
    else:
        # timeline contains FoodIntake objects, serialize them
        intake_serializer = FoodIntakeSerializer(timeline, many=True)
        return Response({
            'days': days,
            'group_by': group_by,
            'intakes': intake_serializer.data
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

    # Get or create daily goal from user profile
    daily_goal = DailyGoalService.get_or_create_daily_goal(request.user)
    goal_data = DailyGoalSerializer(daily_goal).data if daily_goal else None

    recent_intakes = FoodIntake.objects.filter(
        user=request.user,
        is_deleted=False
    ).order_by('-consumed_at')[:2]

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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def analytics_overview(request):
    """Get analytics overview for a specific period"""
    days = int(request.GET.get('days', 30))
    if days < 1 or days > 365:
        return Response({'error': 'Days must be between 1 and 365'}, status=400)

    # Get period stats
    period_stats = NutritionStatsService.get_period_stats(request.user, days)
    
    # Calculate overview metrics
    if not period_stats:
        return Response({
            'avg_calories': 0,
            'avg_protein': 0,
            'avg_fat': 0,
            'avg_carbohydrate': 0,
            'unique_products': 0,
            'goal_achievement': 0,
            'total_intakes': 0,
            'days_with_data': 0
        })

    total_days = len(period_stats)
    avg_calories = sum(stat.calories or 0 for stat in period_stats) / total_days if total_days > 0 else 0
    avg_protein = sum(stat.protein or 0 for stat in period_stats) / total_days if total_days > 0 else 0
    avg_fat = sum(stat.fat or 0 for stat in period_stats) / total_days if total_days > 0 else 0
    avg_carbs = sum(stat.carbohydrate or 0 for stat in period_stats) / total_days if total_days > 0 else 0

    # Get unique products count
    from datetime import timedelta
    start_date = timezone.now().date() - timedelta(days=days)
    unique_products = FoodIntake.objects.filter(
        user=request.user,
        is_deleted=False,
        consumed_at__date__gte=start_date
    ).values('product_id', 'user_product_id', 'recipe_id').distinct().count()

    # Calculate goal achievement (simplified)
    daily_goal = DailyGoalService.get_or_create_daily_goal(request.user)
    goal_achievement = 0
    if daily_goal and daily_goal.calories_goal > 0:
        goal_achievement = min(100, (avg_calories / daily_goal.calories_goal) * 100)

    return Response({
        'avg_calories': round(avg_calories, 1),
        'avg_protein': round(avg_protein, 1),
        'avg_fat': round(avg_fat, 1),
        'avg_carbohydrate': round(avg_carbs, 1),
        'unique_products': unique_products,
        'goal_achievement': round(goal_achievement, 1),
        'total_intakes': sum(getattr(stat, 'intakes_count', 0) for stat in period_stats),
        'days_with_data': total_days
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def eating_patterns(request):
    """Get eating patterns analysis"""
    days = int(request.GET.get('days', 30))
    if days < 1 or days > 365:
        return Response({'error': 'Days must be between 1 and 365'}, status=400)

    from datetime import timedelta
    start_date = timezone.now().date() - timedelta(days=days)
    
    intakes = FoodIntake.objects.filter(
        user=request.user,
        is_deleted=False,
        consumed_at__date__gte=start_date
    ).order_by('consumed_at')

    if not intakes:
        return Response({
            'avg_meals_per_day': 0,
            'most_active_hour': 12,
            'hourly_distribution': {},
            'weekly_distribution': {}
        })

    # Calculate hourly distribution
    hourly_count = {}
    daily_meals = {}
    
    for intake in intakes:
        hour = intake.consumed_at.hour
        day = intake.consumed_at.date()
        
        hourly_count[hour] = hourly_count.get(hour, 0) + 1
        daily_meals[day] = daily_meals.get(day, 0) + 1

    # Find most active hour
    most_active_hour = max(hourly_count, key=hourly_count.get) if hourly_count else 12

    # Calculate average meals per day
    avg_meals_per_day = sum(daily_meals.values()) / len(daily_meals) if daily_meals else 0

    # Format hourly distribution for frontend
    formatted_hourly = {str(hour): hourly_count.get(hour, 0) for hour in range(24)}

    return Response({
        'avg_meals_per_day': round(avg_meals_per_day, 1),
        'most_active_hour': most_active_hour,
        'hourly_distribution': formatted_hourly,
        'weekly_distribution': {}  # Could be implemented similarly
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ai_recommendations(request):
    """Generate AI-powered nutrition recommendations"""
    days = request.data.get('days', 30)
    if days < 7 or days > 365:
        return Response({'error': 'Days must be between 7 and 365'}, status=400)

    try:
        # Get user's nutrition data
        period_stats = NutritionStatsService.get_period_stats(request.user, days)
        top_products_data = NutritionStatsService.get_top_products(request.user, days, 10)
        daily_goal = DailyGoalService.get_or_create_daily_goal(request.user)

        # Even if we have no data, generate default recommendations
        if not period_stats or len(period_stats) == 0:
            return Response({
                'overall_assessment': 'Недостаточно данных для полного анализа. Начните записывать свое питание для получения персональных рекомендаций.',
                'key_insights': [
                    'Для точного анализа необходимо вести дневник питания',
                    'Регулярные записи помогут выявить паттерны питания',
                    'Рекомендуется записывать все приемы пищи в течение недели'
                ],
                'recommendations': [
                    {
                        'title': 'Начните вести дневник питания',
                        'description': 'Записывайте все, что едите и пьете в течение дня'
                    },
                    {
                        'title': 'Установите цели',
                        'description': 'Определите свои цели по калориям и макронутриентам'
                    },
                    {
                        'title': 'Пейте больше воды',
                        'description': 'Поддерживайте водный баланс, употребляя 1.5-2 литра воды в день'
                    }
                ],
                'nutritional_balance': {
                    'protein_score': 5,
                    'protein_comment': 'Нет данных для анализа',
                    'carbs_score': 5,
                    'carbs_comment': 'Нет данных для анализа',
                    'fats_score': 5,
                    'fats_comment': 'Нет данных для анализа'
                },
                'suggested_goals': [
                    {
                        'title': 'Ведите дневник питания',
                        'description': 'Записывайте питание минимум 7 дней для получения анализа',
                        'target': '7 дней записей',
                        'icon': 'fa-calendar-check'
                    }
                ]
            })

        # Calculate averages safely
        total_days = len(period_stats)
        avg_calories = sum(getattr(stat, 'total_calories', 0) or 0 for stat in period_stats) / total_days if total_days > 0 else 0
        avg_protein = sum(getattr(stat, 'total_protein', 0) or 0 for stat in period_stats) / total_days if total_days > 0 else 0
        avg_fat = sum(getattr(stat, 'total_fat', 0) or 0 for stat in period_stats) / total_days if total_days > 0 else 0
        avg_carbs = sum(getattr(stat, 'total_carbohydrate', 0) or 0 for stat in period_stats) / total_days if total_days > 0 else 0

        # Generate AI analysis using a simple rule-based system
        analysis = generate_nutrition_analysis(
            avg_calories, avg_protein, avg_fat, avg_carbs,
            top_products_data, daily_goal
        )

        return Response(analysis)

    except Exception as e:
        print(f"Error generating AI recommendations: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({'error': f'Failed to generate recommendations: {str(e)}'}, status=500)


def generate_nutrition_analysis(avg_calories, avg_protein, avg_fat, avg_carbs, top_products, daily_goal):
    """Generate nutrition analysis using rule-based AI"""
    
    # Ensure we have valid numbers
    avg_calories = float(avg_calories) if avg_calories else 0
    avg_protein = float(avg_protein) if avg_protein else 0
    avg_fat = float(avg_fat) if avg_fat else 0
    avg_carbs = float(avg_carbs) if avg_carbs else 0
    
    # Calculate macro percentages
    total_macros_cals = (avg_protein * 4) + (avg_fat * 9) + (avg_carbs * 4)
    protein_percent = (avg_protein * 4 / total_macros_cals * 100) if total_macros_cals > 0 else 0
    fat_percent = (avg_fat * 9 / total_macros_cals * 100) if total_macros_cals > 0 else 0
    carbs_percent = (avg_carbs * 4 / total_macros_cals * 100) if total_macros_cals > 0 else 0

    # Generate overall assessment
    assessment = ""
    if avg_calories < 1200:
        assessment = "Ваше потребление калорий значительно ниже рекомендуемого минимума. Это может привести к дефициту питательных веществ и замедлению метаболизма."
    elif avg_calories < 1500:
        assessment = "Потребление калорий ниже среднего. Убедитесь, что получаете достаточно энергии для поддержания здоровья."
    elif avg_calories > 2500:
        assessment = "Потребление калорий превышает среднюю норму. Рассмотрите сокращение порций или увеличение физической активности."
    else:
        assessment = "Ваше потребление калорий находится в здоровом диапазоне. Продолжайте поддерживать сбалансированное питание."

    # Generate key insights
    insights = [
        f"Среднее потребление калорий: {avg_calories:.0f} ккал/день",
        f"Белки составляют {protein_percent:.1f}% от общей калорийности",
        f"Жиры составляют {fat_percent:.1f}% от общей калорийности",
        f"Углеводы составляют {carbs_percent:.1f}% от общей калорийности"
    ]

    if len(top_products) > 5:
        insights.append(f"В рационе присутствует {len(top_products)} различных продуктов")

    # Generate recommendations
    recommendations = []
    
    if protein_percent < 15:
        recommendations.append({
            "title": "Увеличьте потребление белка",
            "description": "Добавьте в рацион больше белковых продуктов: мясо, рыбу, яйца, бобовые, орехи"
        })
    
    if fat_percent > 35:
        recommendations.append({
            "title": "Сократите потребление жиров",
            "description": "Ограничьте жирную пищу и отдайте предпочтение полезным жирам из орехов, авокадо, рыбы"
        })
    
    if carbs_percent > 65:
        recommendations.append({
            "title": "Контролируйте углеводы",
            "description": "Сократите простые углеводы и увеличьте долю сложных углеводов из овощей и цельнозерновых"
        })

    if avg_calories < 1500:
        recommendations.append({
            "title": "Увеличьте калорийность рациона",
            "description": "Добавьте здоровые высококалорийные продукты: орехи, семена, авокадо"
        })

    recommendations.append({
        "title": "Пейте больше воды",
        "description": "Поддерживайте водный баланс, употребляя 1.5-2 литра чистой воды в день"
    })

    # Nutritional balance scoring
    protein_score = min(10, max(1, (protein_percent / 2.5)))  # Optimal around 20-25%
    carbs_score = min(10, max(1, 10 - abs(carbs_percent - 50) / 5))  # Optimal around 45-55%
    fats_score = min(10, max(1, 10 - abs(fat_percent - 30) / 3))  # Optimal around 25-35%

    # Generate comments
    protein_comment = "Отлично" if protein_score >= 8 else "Нужно корректировать" if protein_score >= 6 else "Требует внимания"
    carbs_comment = "Сбалансированно" if carbs_score >= 8 else "Умеренно" if carbs_score >= 6 else "Нуждается в коррекции"
    fats_comment = "В норме" if fats_score >= 8 else "Можно улучшить" if fats_score >= 6 else "Требует изменений"

    # Suggested goals
    suggested_goals = []
    
    if avg_protein < 60:
        suggested_goals.append({
            "title": "Увеличить потребление белка",
            "description": "Достичь 60г белка в день для лучшего восстановления мышц",
            "target": "60г белка/день",
            "icon": "fa-dumbbell"
        })
    
    if len(top_products) < 15:
        suggested_goals.append({
            "title": "Разнообразить рацион",
            "description": "Попробовать новые продукты для получения различных питательных веществ",
            "target": "15+ разных продуктов",
            "icon": "fa-seedling"
        })

    return {
        "overall_assessment": assessment,
        "key_insights": insights,
        "recommendations": recommendations,
        "nutritional_balance": {
            "protein_score": int(protein_score),
            "protein_comment": protein_comment,
            "carbs_score": int(carbs_score),
            "carbs_comment": carbs_comment,
            "fats_score": int(fats_score),
            "fats_comment": fats_comment
        },
        "suggested_goals": suggested_goals
    }