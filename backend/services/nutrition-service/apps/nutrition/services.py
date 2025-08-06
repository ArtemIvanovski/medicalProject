from datetime import date, datetime, timedelta
from decimal import Decimal
from django.db.models import Q, Sum, Avg, Count, F
from django.utils import timezone
from .models import Product, UserProduct, Recipe, FoodIntake, FavoriteProduct, DailyGoal


class ProductSearchService:
    @staticmethod
    def search_products(user, query, include_favorites=True, include_user_products=True,
                        include_recipes=True, limit=20):
        results = {
            'products': [],
            'user_products': [],
            'recipes': [],
            'favorites': []
        }

        if not query or len(query.strip()) < 2:
            if include_favorites:
                favorites = FavoriteProduct.objects.filter(user=user).select_related()[:limit]
                for fav in favorites:
                    try:
                        product = Product.objects.get(product_id=fav.product_id)
                        results['favorites'].append(product)
                    except Product.DoesNotExist:
                        continue
            return results

        search_query = query.strip().lower()

        if include_favorites:
            favorite_products = Product.objects.filter(
                product_id__in=FavoriteProduct.objects.filter(user=user).values_list('product_id', flat=True),
                name__icontains=search_query,
                isdeleted=False
            )[:limit // 4]
            results['favorites'] = list(favorite_products)

        products_query = Product.objects.filter(
            Q(name__icontains=search_query) |
            Q(manufacturer__icontains=search_query)
        ).filter(isdeleted=False).exclude(
            product_id__in=[p.product_id for p in results['favorites']]
        )[:limit // 2]
        results['products'] = list(products_query)

        if include_user_products:
            user_products = UserProduct.objects.filter(
                user=user,
                is_deleted=False,
                name__icontains=search_query
            )[:limit // 4]
            results['user_products'] = list(user_products)

        if include_recipes:
            recipes = Recipe.objects.filter(
                user=user,
                is_deleted=False,
                name__icontains=search_query
            )[:limit // 4]
            results['recipes'] = list(recipes)

        return results


class NutritionCalculatorService:
    @staticmethod
    def calculate_bmr(weight, height, age, gender):
        if gender == 'male':
            return 9.99 * float(weight) + 6.25 * height - 4.92 * age + 5
        return 9.99 * float(weight) + 6.25 * height - 4.92 * age - 161

    @staticmethod
    def calculate_daily_goals(weight, height, age, gender, activity_level=1.2):
        bmr = NutritionCalculatorService.calculate_bmr(weight, height, age, gender)
        tdee = bmr * activity_level

        calories = round(tdee)
        protein = round(float(weight) * 1.6, 1)
        fat = round(tdee * 0.25 / 9, 1)
        carbohydrate = round((tdee - protein * 4 - fat * 9) / 4, 1)

        return {
            'calories_goal': Decimal(str(calories)),
            'protein_goal': Decimal(str(protein)),
            'fat_goal': Decimal(str(fat)),
            'carbohydrate_goal': Decimal(str(carbohydrate))
        }


class NutritionStatsService:
    @staticmethod
    def get_daily_stats(user, target_date=None):
        if target_date is None:
            target_date = timezone.now().date()

        start_datetime = timezone.make_aware(datetime.combine(target_date, datetime.min.time()))
        end_datetime = start_datetime + timedelta(days=1)

        intakes = FoodIntake.objects.filter(
            user=user,
            is_deleted=False,
            consumed_at__gte=start_datetime,
            consumed_at__lt=end_datetime
        ).aggregate(
            total_calories=Sum('calories_consumed') or Decimal('0'),
            total_protein=Sum('protein_consumed') or Decimal('0'),
            total_fat=Sum('fat_consumed') or Decimal('0'),
            total_carbohydrate=Sum('carbohydrate_consumed') or Decimal('0')
        )

        try:
            daily_goal = DailyGoal.objects.get(user=user)
        except DailyGoal.DoesNotExist:
            daily_goal = None

        if daily_goal:
            calories_percentage = (intakes[
                                       'total_calories'] / daily_goal.calories_goal * 100) if daily_goal.calories_goal > 0 else 0
            protein_percentage = (
                        intakes['total_protein'] / daily_goal.protein_goal * 100) if daily_goal.protein_goal > 0 else 0
            fat_percentage = (intakes['total_fat'] / daily_goal.fat_goal * 100) if daily_goal.fat_goal > 0 else 0
            carbohydrate_percentage = (intakes[
                                           'total_carbohydrate'] / daily_goal.carbohydrate_goal * 100) if daily_goal.carbohydrate_goal > 0 else 0
        else:
            calories_percentage = protein_percentage = fat_percentage = carbohydrate_percentage = 0

        return {
            'date': target_date,
            'total_calories': intakes['total_calories'],
            'total_protein': intakes['total_protein'],
            'total_fat': intakes['total_fat'],
            'total_carbohydrate': intakes['total_carbohydrate'],
            'goal_calories': daily_goal.calories_goal if daily_goal else Decimal('0'),
            'goal_protein': daily_goal.protein_goal if daily_goal else Decimal('0'),
            'goal_fat': daily_goal.fat_goal if daily_goal else Decimal('0'),
            'goal_carbohydrate': daily_goal.carbohydrate_goal if daily_goal else Decimal('0'),
            'calories_percentage': round(calories_percentage, 2),
            'protein_percentage': round(protein_percentage, 2),
            'fat_percentage': round(fat_percentage, 2),
            'carbohydrate_percentage': round(carbohydrate_percentage, 2)
        }

    @staticmethod
    def get_period_stats(user, days=7):
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days - 1)

        stats = []
        current_date = start_date

        while current_date <= end_date:
            daily_stats = NutritionStatsService.get_daily_stats(user, current_date)
            stats.append(daily_stats)
            current_date += timedelta(days=1)

        return stats

    @staticmethod
    def get_nutrition_timeline(user, days=7, group_by='day'):
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)

        intakes = FoodIntake.objects.filter(
            user=user,
            is_deleted=False,
            consumed_at__gte=start_date
        ).order_by('consumed_at')

        if group_by == 'day':
            timeline = {}
            for intake in intakes:
                date_key = intake.consumed_at.date().isoformat()
                if date_key not in timeline:
                    timeline[date_key] = {
                        'date': intake.consumed_at.date(),
                        'calories': Decimal('0'),
                        'protein': Decimal('0'),
                        'fat': Decimal('0'),
                        'carbohydrate': Decimal('0'),
                        'intakes': []
                    }

                timeline[date_key]['calories'] += intake.calories_consumed
                timeline[date_key]['protein'] += intake.protein_consumed
                timeline[date_key]['fat'] += intake.fat_consumed
                timeline[date_key]['carbohydrate'] += intake.carbohydrate_consumed
                timeline[date_key]['intakes'].append(intake)

            return list(timeline.values())

        return list(intakes)

    @staticmethod
    def get_top_products(user, days=30, limit=10):
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)

        product_stats = {}

        intakes = FoodIntake.objects.filter(
            user=user,
            is_deleted=False,
            consumed_at__gte=start_date
        ).select_related('user_product', 'recipe')

        for intake in intakes:
            key = None
            name = ""

            if intake.product_id:
                try:
                    product = Product.objects.get(product_id=intake.product_id)
                    key = f"product_{intake.product_id}"
                    name = product.name
                except Product.DoesNotExist:
                    continue
            elif intake.user_product:
                key = f"user_product_{intake.user_product.id}"
                name = intake.user_product.name
            elif intake.recipe:
                key = f"recipe_{intake.recipe.id}"
                name = intake.recipe.name

            if key:
                if key not in product_stats:
                    product_stats[key] = {
                        'name': name,
                        'type': key.split('_')[0],
                        'id': key.split('_')[1],
                        'total_calories': Decimal('0'),
                        'total_times': 0,
                        'avg_amount': Decimal('0'),
                        'total_amount': Decimal('0')
                    }

                product_stats[key]['total_calories'] += intake.calories_consumed
                product_stats[key]['total_times'] += 1
                product_stats[key]['total_amount'] += intake.amount

        for stats in product_stats.values():
            if stats['total_times'] > 0:
                stats['avg_amount'] = stats['total_amount'] / stats['total_times']

        sorted_products = sorted(
            product_stats.values(),
            key=lambda x: x['total_times'],
            reverse=True
        )

        return sorted_products[:limit]


class RecipeService:
    @staticmethod
    def create_recipe_with_ingredients(user, recipe_data, ingredients_data):
        recipe = Recipe.objects.create(
            user=user,
            name=recipe_data['name'],
            description=recipe_data.get('description', ''),
            servings=recipe_data.get('servings', 1)
        )

        from .models import RecipeIngredient

        for order, ingredient_data in enumerate(ingredients_data):
            RecipeIngredient.objects.create(
                recipe=recipe,
                product_id=ingredient_data.get('product_id'),
                user_product_id=ingredient_data.get('user_product_id'),
                amount=ingredient_data['amount'],
                unit=ingredient_data.get('unit', 'g'),
                order=order
            )

        recipe.calculate_nutrition()
        return recipe