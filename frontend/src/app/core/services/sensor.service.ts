import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  SensorCreateRequest,
  SensorData,
  SensorListResponse,
  SensorSettings,
  SensorSettingsUpdateRequest,
  SensorStatus,
  SensorUpdateRequest
} from "../models/sensor.models";



@Injectable({
  providedIn: 'root'
})
export class SensorService {

  constructor(private http: HttpClient) {}

  // Получить список всех сенсоров пользователя
  getSensors(): Observable<SensorListResponse> {
    return this.http.get<SensorListResponse>(`${environment.glucoseApiUrl}/sensors/`)
      .pipe(catchError(this.handleError));
  }

  // Получить информацию о конкретном сенсоре
  getSensor(sensorId: string): Observable<SensorData> {
    return this.http.get<SensorData>(`${environment.glucoseApiUrl}/sensors/${sensorId}/`)
      .pipe(catchError(this.handleError));
  }

  // Деактивировать сенсор
  deactivateSensor(sensorId: string): Observable<any> {
    return this.http.patch<any>(`${environment.glucoseApiUrl}/sensors/${sensorId}/`, { active: false })
      .pipe(catchError(this.handleError));
  }

  // Создать новый сенсор
  createSensor(sensorData: SensorCreateRequest): Observable<SensorData> {
    return this.http.post<SensorData>(`${environment.glucoseApiUrl}/sensors/`, sensorData)
      .pipe(catchError(this.handleError));
  }

  // Обновить информацию о сенсоре и его настройки
  updateSensor(sensorId: string, updateData: any): Observable<any> {
    return this.http.patch<any>(`${environment.glucoseApiUrl}/sensors/${sensorId}/`, updateData)
      .pipe(catchError(this.handleError));
  }

  // Удалить сенсор
  deleteSensor(sensorId: string): Observable<void> {
    return this.http.delete<void>(`${environment.glucoseApiUrl}/sensors/${sensorId}/`)
      .pipe(catchError(this.handleError));
  }

  // Зарегистрировать новый сенсор
  registerSensor(serialNumber: string, secretKey: string): Observable<SensorData> {
    return this.http.post<SensorData>(`${environment.glucoseApiUrl}/register/`, {
      serial_number: serialNumber,
      secret_key: secretKey
    }).pipe(catchError(this.handleError));
  }

  // Получить интервалы опроса (опции для выбора)
  getPollingIntervalOptions(): { value: number; label: string }[] {
    return [
      { value: 1, label: '1 минута' },
      { value: 2, label: '2 минуты' },
      { value: 3, label: '3 минуты' },
      { value: 5, label: '5 минут' },
      { value: 10, label: '10 минут' },
      { value: 15, label: '15 минут' },
      { value: 20, label: '20 минут' },
      { value: 30, label: '30 минут' }
    ];
  }



  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Неизвестная ошибка!';
    
    if (error.error instanceof ErrorEvent) {
      // Ошибка на стороне клиента
      errorMessage = `Ошибка: ${error.error.message}`;
    } else {
      // Ошибка на стороне сервера
      switch (error.status) {
        case 400:
          errorMessage = 'Неверные данные';
          break;
        case 401:
          errorMessage = 'Необходима авторизация';
          break;
        case 403:
          errorMessage = 'Доступ запрещен';
          break;
        case 404:
          errorMessage = 'Сенсор не найден';
          break;
        case 500:
          errorMessage = 'Ошибка сервера';
          break;
        default:
          errorMessage = `Ошибка: ${error.status}`;
      }
    }
    
    return throwError(errorMessage);
  }
}
