import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {environment} from "../../../environments/environment";
import {
    DailyGoal,
    DashboardData,
    FoodIntake,
    NutritionStats,
    Recipe,
    SearchResults,
    UserProduct
} from "../models/nutrition.models";


@Injectable({
    providedIn: 'root'
})
export class NutritionService {
    constructor(private http: HttpClient) {
    }

    searchProducts(query: string, limit: number = 30): Observable<SearchResults> {
        const params = {query, limit: limit.toString()};
        return this.http.get<SearchResults>(`${environment.nutritionApiUrl}/search/`, {params});
    }

    getDashboard(): Observable<DashboardData> {
        return this.http.get<DashboardData>(`${environment.nutritionApiUrl}/dashboard/`);
    }

    getDailyStats(date?: string): Observable<NutritionStats> {
        let params = new HttpParams();
        if (date) {
            params = params.set('date', date);
        }
        return this.http.get<NutritionStats>(
            `${environment.nutritionApiUrl}/stats/daily/`,
            { params }
        );
    }

    getDailyGoal(): Observable<DailyGoal> {
        return this.http.get<DailyGoal>(`${environment.nutritionApiUrl}/daily-goal/`);
    }

    updateDailyGoal(data: Partial<DailyGoal>): Observable<DailyGoal> {
        return this.http.put<DailyGoal>(`${environment.nutritionApiUrl}/daily-goal/`, data);
    }

    getFoodIntakes(date?: string): Observable<{ results: FoodIntake[] }> {
        let params = new HttpParams();
        if (date) {
            params = params.set('date', date);
        }
        return this.http.get<{ results: FoodIntake[] }>(
            `${environment.nutritionApiUrl}/intakes/`,
            { params }
        );
    }

    createFoodIntake(data: any): Observable<FoodIntake> {
        return this.http.post<FoodIntake>(`${environment.nutritionApiUrl}/intakes/`, data);
    }

    quickAddIntake(data: any): Observable<FoodIntake> {
        return this.http.post<FoodIntake>(`${environment.nutritionApiUrl}/intakes/quick-add/`, data);
    }

    addToFavorites(productId: number): Observable<any> {
        return this.http.post<any>(`${environment.nutritionApiUrl}/favorites/`, {product_id: productId});
    }

    removeFromFavorites(productId: number): Observable<any> {
        return this.http.delete<any>(`${environment.nutritionApiUrl}/favorites/${productId}/remove/`);
    }

    getUserProducts(): Observable<UserProduct[]> {
        return this.http.get<{results: UserProduct[]}>(`${environment.nutritionApiUrl}/user-products/`).pipe(
            map(response => response.results)
        );
    }

    createUserProduct(data: any): Observable<UserProduct> {
        return this.http.post<UserProduct>(`${environment.nutritionApiUrl}/user-products/`, data);
    }

    updateUserProduct(id: string, data: any): Observable<UserProduct> {
        return this.http.put<UserProduct>(`${environment.nutritionApiUrl}/user-products/${id}/`, data);
    }

    deleteUserProduct(id: string): Observable<any> {
        return this.http.delete<any>(`${environment.nutritionApiUrl}/user-products/${id}/`);
    }

    uploadProductImage(productId: string, file: File): Observable<any> {
        const formData = new FormData();
        formData.append('image', file);
        return this.http.post<any>(`${environment.nutritionApiUrl}/user-products/${productId}/image/`, formData);
    }

    deleteProductImage(productId: string): Observable<any> {
        return this.http.delete<any>(`${environment.nutritionApiUrl}/user-products/${productId}/image/delete/`);
    }

    // Recipe management methods
    getRecipes(): Observable<Recipe[]> {
        return this.http.get<{results: Recipe[]}>(`${environment.nutritionApiUrl}/recipes/`).pipe(
            map(response => response.results)
        );
    }

    createRecipe(data: any): Observable<Recipe> {
        return this.http.post<Recipe>(`${environment.nutritionApiUrl}/recipes/`, data);
    }

    getRecipe(id: string): Observable<Recipe> {
        return this.http.get<Recipe>(`${environment.nutritionApiUrl}/recipes/${id}/`);
    }

    updateRecipe(id: string, data: any): Observable<Recipe> {
        return this.http.put<Recipe>(`${environment.nutritionApiUrl}/recipes/${id}/`, data);
    }

    deleteRecipe(id: string): Observable<any> {
        return this.http.delete<any>(`${environment.nutritionApiUrl}/recipes/${id}/`);
    }

    uploadRecipeImage(recipeId: string, file: File): Observable<any> {
        const formData = new FormData();
        formData.append('image', file);
        return this.http.post<any>(`${environment.nutritionApiUrl}/recipes/${recipeId}/image/`, formData);
    }

    deleteRecipeImage(recipeId: string): Observable<any> {
        return this.http.delete<any>(`${environment.nutritionApiUrl}/recipes/${recipeId}/image/delete/`);
    }

    // Food Intake management methods
    updateFoodIntake(id: string, data: any): Observable<FoodIntake> {
        return this.http.put<FoodIntake>(`${environment.nutritionApiUrl}/intakes/${id}/`, data);
    }

    deleteFoodIntake(id: string): Observable<any> {
        return this.http.delete<any>(`${environment.nutritionApiUrl}/intakes/${id}/`);
    }
}