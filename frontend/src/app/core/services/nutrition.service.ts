import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from "../../../environments/environment";
import {
    DailyGoal,
    DashboardData,
    FoodIntake,
    NutritionStats,
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

    createUserProduct(data: any): Observable<UserProduct> {
        return this.http.post<UserProduct>(`${environment.nutritionApiUrl}/user-products/`, data);
    }

    uploadProductImage(productId: string, file: File): Observable<any> {
        const formData = new FormData();
        formData.append('image', file);
        return this.http.post<any>(`${environment.nutritionApiUrl}/user-products/${productId}/image/`, formData);
    }
}