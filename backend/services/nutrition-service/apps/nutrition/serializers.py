from rest_framework import serializers
from decimal import Decimal
from django.utils import timezone
from .models import (
    Product, UserProduct, Recipe, RecipeIngredient,
    FavoriteProduct, DailyGoal, FoodIntake
)


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            'product_id', 'name', 'protein', 'fat', 'carbohydrate',
            'calories', 'composition', 'image_url', 'manufacturer', 'country'
        ]


class UserProductSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = UserProduct
        fields = [
            'id', 'name', 'protein', 'fat', 'carbohydrate',
            'calories', 'composition', 'manufacturer', 'image_url', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_image_url(self, obj):
        if obj.image_drive_id:
            return f"http://localhost:8005/api/v1/product-image/{obj.image_drive_id}/"
        return None


class CreateUserProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProduct
        fields = ['id', 'name', 'protein', 'fat', 'carbohydrate', 'calories', 'composition', 'manufacturer']
        read_only_fields = ['id']

    def validate_calories(self, value):
        if value < 0:
            raise serializers.ValidationError("Калории не могут быть отрицательными")
        return value

    def validate_protein(self, value):
        if value < 0:
            raise serializers.ValidationError("Белки не могут быть отрицательными")
        return value

    def validate_fat(self, value):
        if value < 0:
            raise serializers.ValidationError("Жиры не могут быть отрицательными")
        return value

    def validate_carbohydrate(self, value):
        if value < 0:
            raise serializers.ValidationError("Углеводы не могут быть отрицательными")
        return value


class RecipeIngredientSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    product_info = serializers.SerializerMethodField()

    class Meta:
        model = RecipeIngredient
        fields = [
            'id', 'product_id', 'user_product', 'amount', 'unit',
            'order', 'product_name', 'product_info'
        ]

    def get_product_name(self, obj):
        if obj.product_id:
            try:
                product = Product.objects.get(product_id=obj.product_id)
                return product.name
            except Product.DoesNotExist:
                return "Продукт не найден"
        elif obj.user_product:
            return obj.user_product.name
        return ""

    def get_product_info(self, obj):
        if obj.product_id:
            try:
                product = Product.objects.get(product_id=obj.product_id)
                return ProductSerializer(product).data
            except Product.DoesNotExist:
                return None
        elif obj.user_product:
            return UserProductSerializer(obj.user_product).data
        return None


class RecipeSerializer(serializers.ModelSerializer):
    ingredients = RecipeIngredientSerializer(many=True, read_only=True)
    ingredients_count = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Recipe
        fields = [
            'id', 'name', 'description', 'total_weight', 'servings',
            'calories_per_100g', 'protein_per_100g', 'fat_per_100g',
            'carbohydrate_per_100g', 'ingredients', 'ingredients_count',
            'image_url', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'calories_per_100g', 'protein_per_100g', 'fat_per_100g',
            'carbohydrate_per_100g', 'total_weight', 'created_at', 'updated_at'
        ]

    def get_ingredients_count(self, obj):
        return obj.ingredients.count()

    def get_image_url(self, obj):
        if obj.image_drive_id:
            return f"http://localhost:8005/api/v1/recipe-image/{obj.image_drive_id}/"
        return None


class CreateRecipeSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    servings = serializers.IntegerField(min_value=1, default=1)
    ingredients = serializers.ListField(
        child=serializers.DictField(),
        min_length=1
    )

    def validate_ingredients(self, value):
        for ingredient in value:
            required_fields = ['amount', 'unit']
            if not any(key in ingredient for key in ['product_id', 'user_product_id']):
                raise serializers.ValidationError(
                    "Каждый ингредиент должен содержать product_id или user_product_id"
                )

            for field in required_fields:
                if field not in ingredient:
                    raise serializers.ValidationError(
                        f"Каждый ингредиент должен содержать: {', '.join(required_fields)}"
                    )
        return value


class FavoriteProductSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = FavoriteProduct
        fields = ['id', 'product_id', 'product', 'created_at']
        read_only_fields = ['id', 'created_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        try:
            product = Product.objects.get(product_id=instance.product_id)
            data['product'] = ProductSerializer(product).data
        except Product.DoesNotExist:
            data['product'] = None
        return data


class DailyGoalSerializer(serializers.ModelSerializer):
    bmr = serializers.SerializerMethodField()
    tdee = serializers.SerializerMethodField()

    class Meta:
        model = DailyGoal
        fields = [
            'id', 'calories_goal', 'protein_goal', 'fat_goal', 'carbohydrate_goal',
            'weight', 'height', 'age', 'gender', 'activity_level',
            'bmr', 'tdee', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'calories_goal', 'protein_goal', 'fat_goal',
            'carbohydrate_goal', 'created_at', 'updated_at'
        ]

    def get_bmr(self, obj):
        return obj.calculate_bmr()

    def get_tdee(self, obj):
        return obj.calculate_bmr() * float(obj.activity_level)


class UpdateDailyGoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyGoal
        fields = ['weight', 'height', 'age', 'gender', 'activity_level']

    def validate_weight(self, value):
        if value <= 0 or value > 500:
            raise serializers.ValidationError("Вес должен быть от 1 до 500 кг")
        return value

    def validate_height(self, value):
        if value < 50 or value > 250:
            raise serializers.ValidationError("Рост должен быть от 50 до 250 см")
        return value

    def validate_age(self, value):
        if value < 10 or value > 120:
            raise serializers.ValidationError("Возраст должен быть от 10 до 120 лет")
        return value

    def validate_activity_level(self, value):
        if value < 1.2 or value > 2.5:
            raise serializers.ValidationError("Уровень активности должен быть от 1.2 до 2.5")
        return value


class FoodIntakeSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    product_info = serializers.SerializerMethodField()

    class Meta:
        model = FoodIntake
        fields = [
            'id', 'product_id', 'user_product', 'recipe', 'amount', 'unit',
            'calories_consumed', 'protein_consumed', 'fat_consumed',
            'carbohydrate_consumed', 'consumed_at', 'notes',
            'product_name', 'product_info', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'calories_consumed', 'protein_consumed', 'fat_consumed',
            'carbohydrate_consumed', 'created_at', 'updated_at'
        ]

    def get_product_name(self, obj):
        if obj.product_id:
            try:
                product = Product.objects.get(product_id=obj.product_id)
                return product.name
            except Product.DoesNotExist:
                return "Продукт не найден"
        elif obj.user_product:
            return obj.user_product.name
        elif obj.recipe:
            return obj.recipe.name
        return ""

    def get_product_info(self, obj):
        if obj.product_id:
            try:
                product = Product.objects.get(product_id=obj.product_id)
                return ProductSerializer(product).data
            except Product.DoesNotExist:
                return None
        elif obj.user_product:
            return UserProductSerializer(obj.user_product).data
        elif obj.recipe:
            return RecipeSerializer(obj.recipe).data
        return None


class CreateFoodIntakeSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(required=False, allow_null=True)
    user_product_id = serializers.UUIDField(required=False, allow_null=True)
    recipe_id = serializers.UUIDField(required=False, allow_null=True)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    unit = serializers.ChoiceField(choices=FoodIntake.UNIT_CHOICES, default='g')
    consumed_at = serializers.DateTimeField()
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_consumed_at(self, value):
        if value > timezone.now():
            raise serializers.ValidationError("Время приема пищи не может быть в будущем")
        return value

    def validate(self, data):
        sources = [data.get('product_id'), data.get('user_product_id'), data.get('recipe_id')]
        non_null_sources = [s for s in sources if s is not None]

        if len(non_null_sources) != 1:
            raise serializers.ValidationError(
                "Укажите только один источник: product_id, user_product_id или recipe_id"
            )

        return data


class NutritionStatsSerializer(serializers.Serializer):
    date = serializers.DateField(required=False)
    calories = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    protein = serializers.DecimalField(max_digits=10, decimal_places=3, required=False)
    fat = serializers.DecimalField(max_digits=10, decimal_places=3, required=False)
    carbohydrate = serializers.DecimalField(max_digits=10, decimal_places=3, required=False)
    intakes_count = serializers.IntegerField(required=False)
    
    # Support legacy field names for backwards compatibility
    total_calories = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    total_protein = serializers.DecimalField(max_digits=10, decimal_places=3, required=False)
    total_fat = serializers.DecimalField(max_digits=10, decimal_places=3, required=False)
    total_carbohydrate = serializers.DecimalField(max_digits=10, decimal_places=3, required=False)
    
    # Goal related fields
    goal_calories = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    goal_protein = serializers.DecimalField(max_digits=10, decimal_places=3, required=False)
    goal_fat = serializers.DecimalField(max_digits=10, decimal_places=3, required=False)
    goal_carbohydrate = serializers.DecimalField(max_digits=10, decimal_places=3, required=False)
    
    # Percentage fields
    calories_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    protein_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    fat_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    carbohydrate_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)


class ProductSearchSerializer(serializers.Serializer):
    query = serializers.CharField(max_length=255, required=True)
    include_favorites = serializers.BooleanField(default=True)
    include_user_products = serializers.BooleanField(default=True)
    include_recipes = serializers.BooleanField(default=True)
    limit = serializers.IntegerField(default=20, min_value=1, max_value=100)


class NutritionTimelineSerializer(serializers.Serializer):
    days = serializers.IntegerField(default=7, min_value=1, max_value=90)
    group_by = serializers.ChoiceField(choices=['day', 'week', 'month', 'intake'], default='day')