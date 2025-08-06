import uuid
from decimal import Decimal
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.db.models import Sum


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email обязателен')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    patronymic = models.CharField(max_length=150, blank=True, null=True)
    birth_date = models.DateField(blank=True, null=True)
    phone_number = models.CharField(max_length=255, blank=True, null=True)
    avatar_drive_id = models.CharField(max_length=128, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    class Meta:
        db_table = 'main_app_user'

    def __str__(self):
        return self.email

    def has_perm(self, perm, obj=None):
        return True

    def has_module_perms(self, app_label):
        return True

    @property
    def is_anonymous(self):
        return False

    @property
    def is_authenticated(self):
        return True


class Product(models.Model):
    id = models.AutoField(primary_key=True)
    product_id = models.IntegerField(unique=True)
    name = models.TextField()
    protein = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    fat = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    carbohydrate = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    calories = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    composition = models.TextField(blank=True)
    image_url = models.TextField(blank=True)
    manufacturer = models.TextField(blank=True)
    country = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    isdeleted = models.BooleanField(default=False)

    class Meta:
        db_table = 'products'

    def __str__(self):
        return self.name


class UserProduct(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_products')
    name = models.CharField(max_length=255)
    protein = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    fat = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    carbohydrate = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    calories = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    composition = models.TextField(blank=True, default='')
    manufacturer = models.CharField(max_length=255, blank=True, default='')
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    image_drive_id = models.CharField(max_length=128, blank=True, null=True)

    class Meta:
        db_table = 'nutrition_user_product'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.name}"


class Recipe(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='recipes')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    total_weight = models.DecimalField(max_digits=10, decimal_places=2, default=100)
    servings = models.PositiveIntegerField(default=1)
    calories_per_100g = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    protein_per_100g = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    fat_per_100g = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    carbohydrate_per_100g = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'nutrition_recipe'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.name}"

    def calculate_nutrition(self):
        ingredients = self.ingredients.all()
        total_calories = Decimal('0')
        total_protein = Decimal('0')
        total_fat = Decimal('0')
        total_carbohydrate = Decimal('0')
        total_weight = Decimal('0')

        for ingredient in ingredients:
            if ingredient.product_id:
                product = Product.objects.get(product_id=ingredient.product_id)
                calories = product.calories or 0
                protein = product.protein or 0
                fat = product.fat or 0
                carbohydrate = product.carbohydrate or 0
            else:
                user_product = ingredient.user_product
                calories = user_product.calories
                protein = user_product.protein
                fat = user_product.fat
                carbohydrate = user_product.carbohydrate

            amount_factor = ingredient.amount / 100
            total_calories += calories * amount_factor
            total_protein += protein * amount_factor
            total_fat += fat * amount_factor
            total_carbohydrate += carbohydrate * amount_factor
            total_weight += ingredient.amount

        if total_weight > 0:
            self.calories_per_100g = (total_calories / total_weight) * 100
            self.protein_per_100g = (total_protein / total_weight) * 100
            self.fat_per_100g = (total_fat / total_weight) * 100
            self.carbohydrate_per_100g = (total_carbohydrate / total_weight) * 100
            self.total_weight = total_weight

        self.save()


class RecipeIngredient(models.Model):
    UNIT_CHOICES = [
        ('g', 'граммы'),
        ('ml', 'миллилитры'),
        ('pieces', 'штуки'),
        ('tbsp', 'столовые ложки'),
        ('tsp', 'чайные ложки'),
        ('cup', 'стаканы'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='ingredients')
    product_id = models.IntegerField(null=True, blank=True)
    user_product = models.ForeignKey(UserProduct, on_delete=models.CASCADE, null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES, default='g')
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'nutrition_recipe_ingredient'
        ordering = ['order']

    def __str__(self):
        if self.product_id:
            product = Product.objects.get(product_id=self.product_id)
            return f"{self.recipe.name} - {product.name}"
        return f"{self.recipe.name} - {self.user_product.name}"


class FavoriteProduct(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favorite_products')
    product_id = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'nutrition_favorite_product'
        unique_together = ['user', 'product_id']

    def __str__(self):
        product = Product.objects.get(product_id=self.product_id)
        return f"{self.user.email} - {product.name}"


class DailyGoal(models.Model):
    GENDER_CHOICES = [
        ('male', 'Мужской'),
        ('female', 'Женский'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='daily_goal')
    calories_goal = models.DecimalField(max_digits=10, decimal_places=2)
    protein_goal = models.DecimalField(max_digits=10, decimal_places=3)
    fat_goal = models.DecimalField(max_digits=10, decimal_places=3)
    carbohydrate_goal = models.DecimalField(max_digits=10, decimal_places=3)
    weight = models.DecimalField(max_digits=5, decimal_places=2)
    height = models.PositiveIntegerField()
    age = models.PositiveIntegerField()
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    activity_level = models.DecimalField(max_digits=3, decimal_places=2, default=1.2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'nutrition_daily_goal'

    def __str__(self):
        return f"{self.user.email} - {self.calories_goal} kcal"

    def calculate_goals(self):
        bmr = self.calculate_bmr()
        tdee = bmr * float(self.activity_level)

        self.calories_goal = Decimal(str(round(tdee)))
        self.protein_goal = Decimal(str(round(float(self.weight) * 1.6, 1)))
        self.fat_goal = Decimal(str(round(tdee * 0.25 / 9, 1)))
        self.carbohydrate_goal = Decimal(
            str(round((tdee - float(self.protein_goal) * 4 - float(self.fat_goal) * 9) / 4, 1)))

        self.save()

    def calculate_bmr(self):
        if self.gender == 'male':
            return 9.99 * float(self.weight) + 6.25 * self.height - 4.92 * self.age + 5
        return 9.99 * float(self.weight) + 6.25 * self.height - 4.92 * self.age - 161


class FoodIntake(models.Model):
    UNIT_CHOICES = [
        ('g', 'граммы'),
        ('ml', 'миллилитры'),
        ('pieces', 'штуки'),
        ('tbsp', 'столовые ложки'),
        ('tsp', 'чайные ложки'),
        ('cup', 'стаканы'),
        ('serving', 'порция'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='food_intakes')
    product_id = models.IntegerField(null=True, blank=True)
    user_product = models.ForeignKey(UserProduct, on_delete=models.SET_NULL, null=True, blank=True)
    recipe = models.ForeignKey(Recipe, on_delete=models.SET_NULL, null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES, default='g')
    calories_consumed = models.DecimalField(max_digits=10, decimal_places=2)
    protein_consumed = models.DecimalField(max_digits=10, decimal_places=3)
    fat_consumed = models.DecimalField(max_digits=10, decimal_places=3)
    carbohydrate_consumed = models.DecimalField(max_digits=10, decimal_places=3)
    consumed_at = models.DateTimeField()
    notes = models.TextField(blank=True, default='')
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'nutrition_food_intake'
        ordering = ['-consumed_at']

    def __str__(self):
        if self.product_id:
            product = Product.objects.get(product_id=self.product_id)
            return f"{self.user.email} - {product.name} - {self.consumed_at}"
        elif self.user_product:
            return f"{self.user.email} - {self.user_product.name} - {self.consumed_at}"
        else:
            return f"{self.user.email} - {self.recipe.name} - {self.consumed_at}"

    def calculate_nutrition(self):
        amount_factor = self.amount / 100

        if self.product_id:
            product = Product.objects.get(product_id=self.product_id)
            self.calories_consumed = (product.calories or 0) * amount_factor
            self.protein_consumed = (product.protein or 0) * amount_factor
            self.fat_consumed = (product.fat or 0) * amount_factor
            self.carbohydrate_consumed = (product.carbohydrate or 0) * amount_factor
        elif self.user_product:
            self.calories_consumed = self.user_product.calories * amount_factor
            self.protein_consumed = self.user_product.protein * amount_factor
            self.fat_consumed = self.user_product.fat * amount_factor
            self.carbohydrate_consumed = self.user_product.carbohydrate * amount_factor
        elif self.recipe:
            self.calories_consumed = self.recipe.calories_per_100g * amount_factor
            self.protein_consumed = self.recipe.protein_per_100g * amount_factor
            self.fat_consumed = self.recipe.fat_per_100g * amount_factor
            self.carbohydrate_consumed = self.recipe.carbohydrate_per_100g * amount_factor

    def save(self, *args, **kwargs):
        if not self.calories_consumed:
            self.calculate_nutrition()
        super().save(*args, **kwargs)