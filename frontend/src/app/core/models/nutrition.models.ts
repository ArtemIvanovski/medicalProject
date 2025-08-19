export interface Product {
    product_id: number;
    name: string;
    protein: number;
    fat: number;
    carbohydrate: number;
    calories: number;
    composition?: string;
    image_url?: string;
    manufacturer?: string;
    country?: string;
}

export interface UserProduct {
    id: string;
    name: string;
    description?: string;
    protein: number;
    fat: number;
    carbohydrate: number;
    calories: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
    potassium?: number;
    cholesterol?: number;
    vitamin_a?: number;
    vitamin_c?: number;
    calcium?: number;
    iron?: number;
    composition?: string;
    manufacturer?: string;
    image_url?: string;
    created_at: string;
    updated_at: string;
}

export interface Recipe {
    id: string;
    name: string;
    description?: string;
    total_weight: number;
    servings: number;
    calories_per_100g: number;
    protein_per_100g: number;
    fat_per_100g: number;
    carbohydrate_per_100g: number;
    ingredients_count: number;
    ingredients?: RecipeIngredient[];
    image_url?: string;
    created_at: string;
    updated_at: string;
}

export interface RecipeIngredient {
    id?: string;
    product_id?: number;
    user_product_id?: string;
    product_name?: string;
    amount: number;
    unit: string;
    order?: number;
    product?: Product;
    user_product?: UserProduct;
    product_info?: Product | UserProduct;
}

export interface SearchResults {
    query: string;
    favorites: Product[];
    products: Product[];
    user_products: UserProduct[];
    recipes: Recipe[];
}

export interface DailyGoal {
    id: string;
    calories_goal: number;
    protein_goal: number;
    fat_goal: number;
    carbohydrate_goal: number;
    weight?: number;
    height?: number;
    age?: number;
    gender?: string;
    activity_level?: number;
    created_at: string;
    updated_at: string;
}

export interface FoodIntake {
    id: string;
    product_id?: number;
    user_product?: UserProduct;
    recipe?: Recipe;
    amount: number;
    unit: string;
    calories_consumed: number;
    protein_consumed: number;
    fat_consumed: number;
    carbohydrate_consumed: number;
    consumed_at: string;
    notes?: string;
    product_name: string;
    product_info?: Product | UserProduct | Recipe;
    created_at: string;
    updated_at: string;
}

export interface NutritionStats {
    date?: string;
    calories: number;
    protein: number;
    fat: number;
    carbohydrate: number;
    intakes_count?: number;
}

export interface DashboardData {
    today_stats: NutritionStats;
    goal: DailyGoal | null;
    recent_intakes: FoodIntake[];
    top_products: any[];
    week_stats: NutritionStats[];
}