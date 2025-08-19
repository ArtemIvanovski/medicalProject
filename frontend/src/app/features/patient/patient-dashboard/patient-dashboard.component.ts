import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Title } from '@angular/platform-browser';

declare var Chart: any;

interface GlucoseData {
  value: number;
  unit: string;
  trend: string;
  lastUpdate: Date;
}

interface SystemParams {
  minRange: number;
  maxRange: number;
  calibrationCoeff: number;
  interval: number;
  batteryLevel: number;
  daysToReplace: number;
}

interface Ranges {
  tir: number;
  tar: number;
  tbr: number;
}

interface DailyStats {
  calories: number;
  activity: string;
  insulin: number;
}

interface DoctorInfo {
  fullName: string;
  phone: string;
  schedule: string;
}

interface TrustedPerson {
  name: string;
  relation: string;
  email?: string;
  phone?: string;
}

interface SensorInfo {
  id: string;
  installDate: Date;
  type: string;
  softwareVersion: string;
  status: string;
}

interface ChatMessage {
  sender: string;
  content: string;
  timestamp: Date;
}

@Component({
  selector: 'app-patient-dashboard',
  templateUrl: './patient-dashboard.component.html',
  styleUrls: ['./patient-dashboard.component.scss']
})
export class PatientDashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('dailyChart', { static: false }) dailyChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chatMessagesContainer', { static: false }) chatMessagesRef!: ElementRef;

  constructor(private titleService: Title) {}

  currentGlucose: GlucoseData = {
    value: 8.2,
    unit: 'ммоль/л',
    trend: 'медленно растёт',
    lastUpdate: new Date()
  };

  systemParams: SystemParams = {
    minRange: 3.9,
    maxRange: 10.0,
    calibrationCoeff: 1.05,
    interval: 5,
    batteryLevel: 80,
    daysToReplace: 5
  };

  ranges: Ranges = {
    tir: 65,
    tar: 30,
    tbr: 5
  };

  dailyStats: DailyStats = {
    calories: 1800,
    activity: '40 минут ходьбы',
    insulin: 6
  };

  doctorInfo: DoctorInfo = {
    fullName: 'Иванова А.А.',
    phone: '+375 (29) 000-11-22',
    schedule: 'Пн-Пт 8:00 - 17:00'
  };

  trustedPersons: TrustedPerson[] = [
    { name: 'Петров П.П.', relation: 'сын', email: 'petrov@example.com' },
    { name: 'Иванова И.И.', relation: 'дочь', phone: '+375 (44) 123-45-67' }
  ];

  sensorInfo: SensorInfo = {
    id: 'CGM-12345',
    installDate: new Date('2025-02-01'),
    type: 'Имплантируемый, заводская калибровка',
    softwareVersion: 'v2.0.7',
    status: 'Активен'
  };

  chatMessages: ChatMessage[] = [
    { sender: 'Врач', content: 'Добрый день! Как вы себя чувствуете?', timestamp: new Date() },
    { sender: 'Вы', content: 'Здравствуйте! Всё нормально, сахар немного повышен.', timestamp: new Date() }
  ];

  newMessage = '';

  ngOnInit(): void {
    this.titleService.setTitle('Панель пациента');
    this.loadPatientData();
  }

  ngAfterViewInit(): void {
    this.initializeChart();
  }

  private loadPatientData(): void {
    // TODO: Загрузка данных пациента с сервера
    // this.patientService.getCurrentGlucose().subscribe(data => {
    //   this.currentGlucose = data;
    // });

    // this.patientService.getSystemParams().subscribe(params => {
    //   this.systemParams = params;
    // });

    // Обновляем данные каждые 5 минут
    setInterval(() => {
      this.updateGlucoseData();
    }, 5 * 60 * 1000);
  }

  private updateGlucoseData(): void {
    // TODO: Обновление данных глюкозы
    this.currentGlucose.lastUpdate = new Date();
  }

  private initializeChart(): void {
    if (!this.dailyChartRef) return;

    const timeLabels = [
      "00:00", "01:00", "02:00", "03:00", "04:00", "05:00", "06:00",
      "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
      "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
      "19:00", "20:00", "21:00", "22:00", "23:00"
    ];

    const dailyData = timeLabels.map(() => {
      const val = Math.random() * 10 + 2.5;
      return parseFloat(val.toFixed(1));
    });

    const ctx = this.dailyChartRef.nativeElement.getContext('2d');

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: timeLabels,
        datasets: [{
          label: 'Глюкоза (ммоль/л)',
          data: dailyData,
          borderColor: '#2980b9',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.2,
          fill: false
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            title: {
              display: true,
              text: 'Глюкоза (ммоль/л)'
            },
            min: 2,
            max: 14,
            grid: {
              color: '#eee'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Время суток'
            },
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  getTrendClass(): string {
    switch (this.currentGlucose.trend) {
      case 'стабильно': return 'trend-stable';
      case 'медленно растёт': return 'trend-up';
      case 'быстро растёт': return 'trend-fastup';
      case 'снижается': return 'trend-down';
      default: return 'trend-stable';
    }
  }

  getTrendSymbol(): string {
    switch (this.currentGlucose.trend) {
      case 'стабильно': return '→';
      case 'медленно растёт': return '↗';
      case 'быстро растёт': return '↑';
      case 'снижается': return '↘';
      default: return '→';
    }
  }

  addEvent(eventType: string): void {
    // TODO: Добавление события мониторинга
    console.log('Adding event:', eventType);

    switch (eventType) {
      case 'insulin':
        // Открыть модальное окно для ввода дозы инсулина
        break;
      case 'pill':
        // Открыть модальное окно для выбора препарата
        break;
      case 'food':
        // Открыть модальное окно для ввода приема пищи
        break;
      case 'activity':
        // Открыть модальное окно для ввода физической активности
        break;
    }
  }

  sendMessage(): void {
    if (this.newMessage.trim()) {
      this.chatMessages.push({
        sender: 'Вы',
        content: this.newMessage,
        timestamp: new Date()
      });

      this.newMessage = '';

      // Прокрутка чата вниз
      setTimeout(() => {
        if (this.chatMessagesRef) {
          this.chatMessagesRef.nativeElement.scrollTop =
              this.chatMessagesRef.nativeElement.scrollHeight;
        }
      }, 100);

      // TODO: Отправка сообщения на сервер
      // this.chatService.sendMessage(message).subscribe();
    }
  }
}