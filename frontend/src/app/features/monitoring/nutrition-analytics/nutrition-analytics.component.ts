import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';
import { NutritionService } from '../../../core/services';
import { NutritionStats } from '../../../core/models';
import { Subject, takeUntil, debounceTime, finalize, timeout, catchError, of, forkJoin } from 'rxjs';

Chart.register(...registerables);

interface OverviewStats {
  avg_calories: number;
  avg_protein: number;
  avg_fat: number;
  avg_carbohydrate: number;
  unique_products: number;
  goal_achievement: number;
  total_intakes: number;
  days_with_data: number;
}

interface TopProduct {
  product_name: string;
  total_intake_count: number;
  total_calories: number;
  total_amount: number;
  avg_amount_per_intake: number;
}

interface EatingPatterns {
  avg_meals_per_day: number;
  most_active_hour: number;
  hourly_distribution: { [hour: string]: number };
  weekly_distribution: { [day: string]: number };
}

interface AIAnalysis {
  overall_assessment: string;
  key_insights: string[];
  recommendations: Array<{
    title: string;
    description: string;
  }>;
  nutritional_balance: {
    protein_score: number;
    protein_comment: string;
    carbs_score: number;
    carbs_comment: string;
    fats_score: number;
    fats_comment: string;
  };
  suggested_goals: Array<{
    title: string;
    description: string;
    target: string;
    icon: string;
  }>;
}

@Component({
  selector: 'app-nutrition-analytics',
  templateUrl: './nutrition-analytics.component.html',
  styleUrls: ['./nutrition-analytics.component.scss']
})
export class NutritionAnalyticsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('nutritionChartCalories') nutritionChartCaloriesRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('nutritionChartMacros') nutritionChartMacrosRef!: ElementRef<HTMLCanvasElement>;

  selectedPeriod = '30';
  overviewStats: OverviewStats | null = null;
  topProducts: TopProduct[] = [];
  timelineData: NutritionStats[] = [];
  eatingPatterns: EatingPatterns | null = null;
  aiAnalysis: AIAnalysis | null = null;

  nutritionChartCalories: Chart | null = null;
  nutritionChartMacros: Chart | null = null;

  // Loading states
  isLoadingOverview = false;
  isLoadingTimeline = false;
  isLoadingTopProducts = false;
  isLoadingMacros = false;
  isLoadingPatterns = false;
  isGeneratingAI = false;
  isLoadingAnalytics = false;

  // Error states
  error = '';
  aiError = '';

  // Component lifecycle
  private destroy$ = new Subject<void>();
  private isComponentDestroyed = false;
  private periodChangeSubject = new Subject<string>();
  
  // Chart control
  private chartUpdateAttempts = 0;
  private maxChartUpdateAttempts = 5;
  private chartUpdateInProgress = false;

  // Cached computed data for template
  private cachedHourlyData: Array<{ hour: string, count: number, percentage: number }> = [];

  // Derived view state (precomputed to avoid heavy CD)
  private caloriesTrendClass = 'neutral';
  private caloriesTrendIcon = 'fa-minus';
  private caloriesTrendText = '';

  private proteinTrendClass = 'neutral';
  private proteinTrendIcon = 'fa-minus';
  private proteinTrendText = '';

  private goalTrendClass = 'neutral';
  private goalTrendIcon = 'fa-minus';
  private goalTrendText = '';

  private macroPercentages: Record<'protein'|'carbs'|'fats', number> = { protein: 0, carbs: 0, fats: 0 };

  private scores = {
    overall: 0,
    calorie: 0,
    macro: 0,
    variety: 0,
    consistency: 0
  };

  private cachedHealthRecommendations: Array<{ icon: string, text: string }> = [];
  productPercentages: number[] = [];

  constructor(
    private nutritionService: NutritionService,
    private titleService: Title,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {
    // Setup debounced period change
    this.periodChangeSubject
      .pipe(
        debounceTime(300),
        takeUntil(this.destroy$)
      )
      .subscribe(period => {
        if (!this.isComponentDestroyed) {
          this.selectedPeriod = period;
          this.loadAnalytics();
        }
      });
  }

  ngOnInit(): void {
    console.log('[NutritionAnalytics] Component initializing...');
    this.titleService.setTitle('Аналитика питания');
    this.loadAnalytics();
  }

  ngAfterViewInit(): void {
    console.log('[NutritionAnalytics] AfterViewInit - Chart refs available:', !!this.nutritionChartCaloriesRef, !!this.nutritionChartMacrosRef);
    // Trigger chart update if data is already loaded
    if (this.timelineData && this.timelineData.length > 0) {
      setTimeout(() => {
        if (!this.isComponentDestroyed) {
          this.safeUpdateChart();
        }
      }, 500);
    }
  }

  ngOnDestroy(): void {
    console.log('[NutritionAnalytics] Component destroying...');
    this.isComponentDestroyed = true;
    
    // Complete all subjects
    this.destroy$.next();
    this.destroy$.complete();
    this.periodChangeSubject.complete();
    
    // Destroy charts
    if (this.nutritionChartCalories) {
      try { this.nutritionChartCalories.destroy(); } catch {}
      this.nutritionChartCalories = null;
    }
    if (this.nutritionChartMacros) {
      try { this.nutritionChartMacros.destroy(); } catch {}
      this.nutritionChartMacros = null;
    }
  }

  loadAnalytics(): void {
    if (this.isComponentDestroyed || this.isLoadingAnalytics) {
      console.log('[NutritionAnalytics] Skipping analytics load - component destroyed or already loading');
      return;
    }

    console.log('[NutritionAnalytics] Loading analytics for period:', this.selectedPeriod);
    this.isLoadingAnalytics = true;
    this.isLoadingOverview = true;
    this.isLoadingTimeline = true;
    this.isLoadingTopProducts = true;
    this.isLoadingPatterns = true;
    this.error = '';
    this.chartUpdateAttempts = 0;

    // Use forkJoin to load all data simultaneously but in a controlled way
    const period = parseInt(this.selectedPeriod);
    
    const requests = forkJoin({
      overview: this.nutritionService.getPeriodStats(period).pipe(
        timeout(15000),
        catchError(error => {
          console.error('[NutritionAnalytics] Overview stats error:', error);
          return of({ stats: [] });
        })
      ),
      timeline: this.nutritionService.getNutritionTimeline(period, 'day').pipe(
        timeout(15000),
        catchError(error => {
          console.error('[NutritionAnalytics] Timeline error:', error);
          return of({ timeline: [] });
        })
      ),
      topProducts: this.nutritionService.getTopProducts(period, 10).pipe(
        timeout(15000),
        catchError(error => {
          console.error('[NutritionAnalytics] Top products error:', error);
          return of({ top_products: [] });
        })
      ),
      patterns: this.nutritionService.getEatingPatterns(period).pipe(
        timeout(15000),
        catchError(error => {
          console.error('[NutritionAnalytics] Eating patterns error:', error);
          return of({
            avg_meals_per_day: 0,
            most_active_hour: 12,
            hourly_distribution: {},
            weekly_distribution: {}
          });
        })
      )
    });

    requests.pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        if (!this.isComponentDestroyed) {
          this.isLoadingAnalytics = false;
          this.isLoadingOverview = false;
          this.isLoadingTimeline = false;
          this.isLoadingTopProducts = false;
          this.isLoadingPatterns = false;
          console.log('[NutritionAnalytics] Analytics loading finished');
          this.cdr.detectChanges();
        }
      })
    ).subscribe({
      next: (results) => {
        if (this.isComponentDestroyed) return;

        console.log('[NutritionAnalytics] All data loaded successfully:', results);
        
        try {
          // Process overview stats
          this.calculateOverviewStats(results.overview.stats);
          console.log('[NutritionAnalytics] Overview stats processed');

          // Process timeline data
          this.timelineData = results.timeline.timeline || [];
          console.log('[NutritionAnalytics] Timeline data processed:', this.timelineData.length, 'items');

          // Process top products
          this.topProducts = results.topProducts.top_products || [];
          console.log('[NutritionAnalytics] Top products processed:', this.topProducts.length, 'items');
          this.updateProductPercentages();

          // Process eating patterns
          this.eatingPatterns = results.patterns;
          console.log('[NutritionAnalytics] Eating patterns processed');
          this.updateHourlyDataCache();

          // Update chart with retry mechanism
          setTimeout(() => {
            if (!this.isComponentDestroyed) {
              this.safeUpdateChart();
            }
          }, 300);

          // Update derived view state once all core data is available
          this.updateDerivedViewState();

          // Auto-trigger AI analysis after data loaded
          this.triggerAutoAI();

        } catch (error) {
          console.error('[NutritionAnalytics] Error processing analytics data:', error);
          this.error = 'Ошибка обработки данных аналитики';
        }
      },
      error: (error) => {
        if (this.isComponentDestroyed) return;
        
        console.error('[NutritionAnalytics] Critical error loading analytics:', error);
        this.error = 'Критическая ошибка загрузки данных аналитики';
      }
    });
  }

  onPeriodChange(): void {
    console.log('[NutritionAnalytics] Period change requested:', this.selectedPeriod);
    this.periodChangeSubject.next(this.selectedPeriod);
  }



  private setDefaultEatingPatterns(): void {
    try {
      this.eatingPatterns = {
        avg_meals_per_day: 0,
        most_active_hour: 12,
        hourly_distribution: {},
        weekly_distribution: {}
      };
      console.log('[NutritionAnalytics] Set default eating patterns');
    } catch (fallbackError) {
      console.error('[NutritionAnalytics] Error setting default patterns:', fallbackError);
    }
  }

  private calculateOverviewStats(stats: NutritionStats[]): void {
    console.log('[NutritionAnalytics] Calculating overview stats with data:', stats?.length || 0, 'items');
    
    try {
      if (!stats || stats.length === 0) {
        console.log('[NutritionAnalytics] No stats data, setting default values');
        this.overviewStats = {
          avg_calories: 0,
          avg_protein: 0,
          avg_fat: 0,
          avg_carbohydrate: 0,
          unique_products: 0,
          goal_achievement: 0,
          total_intakes: 0,
          days_with_data: 0
        };
        return;
      }

      const totalDays = stats.length;
      const totalCalories = stats.reduce((sum, day) => sum + (day.calories || 0), 0);
      const totalProtein = stats.reduce((sum, day) => sum + (day.protein || 0), 0);
      const totalFat = stats.reduce((sum, day) => sum + (day.fat || 0), 0);
      const totalCarbs = stats.reduce((sum, day) => sum + (day.carbohydrate || 0), 0);

      this.overviewStats = {
        avg_calories: totalDays > 0 ? Math.round((totalCalories / totalDays) * 10) / 10 : 0,
        avg_protein: totalDays > 0 ? Math.round((totalProtein / totalDays) * 10) / 10 : 0,
        avg_fat: totalDays > 0 ? Math.round((totalFat / totalDays) * 10) / 10 : 0,
        avg_carbohydrate: totalDays > 0 ? Math.round((totalCarbs / totalDays) * 10) / 10 : 0,
        unique_products: this.topProducts.length,
        goal_achievement: this.calculateGoalAchievement(stats),
        total_intakes: stats.reduce((sum, day) => sum + (day.intakes_count || 0), 0),
        days_with_data: totalDays
      };
      
      console.log('[NutritionAnalytics] Overview stats calculated successfully');
    } catch (error) {
      console.error('[NutritionAnalytics] Error calculating overview stats:', error);
      this.overviewStats = {
        avg_calories: 0,
        avg_protein: 0,
        avg_fat: 0,
        avg_carbohydrate: 0,
        unique_products: 0,
        goal_achievement: 0,
        total_intakes: 0,
        days_with_data: 0
      };
      // Ensure derived state is reset on failure
      this.updateDerivedViewState();
    }
  }

  private calculateGoalAchievement(stats: NutritionStats[]): number {
    // Calculate goal achievement based on actual data consistency and nutrition balance
    if (!stats || stats.length === 0) return 0;
    
    const avgCalories = stats.reduce((sum, day) => sum + (day.calories || 0), 0) / stats.length;
    const avgProtein = stats.reduce((sum, day) => sum + (day.protein || 0), 0) / stats.length;
    
    let score = 60; // Base score
    
    // Calorie balance (up to +20 points)
    if (avgCalories >= 1800 && avgCalories <= 2200) {
      score += 20;
    } else if (avgCalories >= 1500 && avgCalories <= 2500) {
      score += 15;
    } else if (avgCalories >= 1200) {
      score += 10;
    }
    
    // Protein adequacy (up to +15 points)
    if (avgProtein >= 60) {
      score += 15;
    } else if (avgProtein >= 45) {
      score += 10;
    } else if (avgProtein >= 30) {
      score += 5;
    }
    
    // Data consistency (up to +5 points)
    const consistency = (stats.length / parseInt(this.selectedPeriod)) * 100;
    if (consistency >= 90) {
      score += 5;
    } else if (consistency >= 70) {
      score += 3;
    }
    
    return Math.min(Math.max(score, 0), 100);
  }

  private calculateEatingPatterns(intakes: any[]): void {
    if (!intakes || intakes.length === 0) {
      this.eatingPatterns = {
        avg_meals_per_day: 0,
        most_active_hour: 12,
        hourly_distribution: {},
        weekly_distribution: {}
      };
      return;
    }

    // Calculate hourly distribution
    const hourlyCount: { [hour: string]: number } = {};
    for (let i = 0; i < 24; i++) {
      hourlyCount[i.toString()] = 0;
    }

    intakes.forEach(intake => {
      if (intake.consumed_at) {
        const hour = new Date(intake.consumed_at).getHours();
        hourlyCount[hour.toString()]++;
      }
    });

    // Find most active hour
    const mostActiveHour = Object.entries(hourlyCount)
      .reduce((max, [hour, count]) => count > max.count ? { hour: parseInt(hour), count } : max, { hour: 12, count: 0 })
      .hour;

    // Calculate average meals per day
    const uniqueDays = new Set(
      intakes.map(intake => 
        intake.consumed_at ? new Date(intake.consumed_at).toDateString() : ''
      ).filter(Boolean)
    ).size;

    this.eatingPatterns = {
      avg_meals_per_day: uniqueDays > 0 ? Math.round((intakes.length / uniqueDays) * 10) / 10 : 0,
      most_active_hour: mostActiveHour,
      hourly_distribution: hourlyCount,
      weekly_distribution: {} // Could be implemented similarly
    };
  }

  safeUpdateChart(): void {
    if (this.isComponentDestroyed || this.chartUpdateInProgress) {
      console.log('[NutritionAnalytics] Chart update skipped - component destroyed or update in progress');
      return;
    }

    if (this.chartUpdateAttempts >= this.maxChartUpdateAttempts) {
      console.warn('[NutritionAnalytics] Max chart update attempts reached, stopping');
      this.error = 'Ошибка создания графика после нескольких попыток';
      return;
    }

    this.chartUpdateAttempts++;
    this.chartUpdateInProgress = true;
    
    console.log('[NutritionAnalytics] Attempting chart update (attempt', this.chartUpdateAttempts, 'of', this.maxChartUpdateAttempts, ')');
    
    try {
      if (!this.nutritionChartCaloriesRef || !this.nutritionChartMacrosRef) {
        console.log('[NutritionAnalytics] Chart ref not available, attempt:', this.chartUpdateAttempts);
        this.chartUpdateInProgress = false;
        
        if (this.chartUpdateAttempts < this.maxChartUpdateAttempts) {
          setTimeout(() => {
            if (!this.isComponentDestroyed) {
              this.safeUpdateChart();
            }
          }, 1000);
        }
        return;
      }
      
      if (!this.timelineData || this.timelineData.length === 0) {
        console.log('[NutritionAnalytics] No timeline data available yet');
        this.chartUpdateInProgress = false;
        return;
      }
      
      console.log('[NutritionAnalytics] Chart refs available, timeline data length:', this.timelineData.length);

      const canvasCalories = this.nutritionChartCaloriesRef.nativeElement;
      const canvasMacros = this.nutritionChartMacrosRef.nativeElement;
      if (!canvasCalories || !canvasMacros) {
        console.error('[NutritionAnalytics] Canvas element not found');
        this.chartUpdateInProgress = false;
        return;
      }

      const ctxCalories = canvasCalories.getContext('2d');
      const ctxMacros = canvasMacros.getContext('2d');
      if (!ctxCalories || !ctxMacros) {
        console.error('[NutritionAnalytics] Could not get canvas contexts');
        this.chartUpdateInProgress = false;
        return;
      }

      // Destroy existing chart safely
      if (this.nutritionChartCalories) {
        try { this.nutritionChartCalories.destroy(); } catch {}
        this.nutritionChartCalories = null;
      }
      if (this.nutritionChartMacros) {
        try { this.nutritionChartMacros.destroy(); } catch {}
        this.nutritionChartMacros = null;
      }

      this.createCharts(ctxCalories, ctxMacros);
      
    } catch (error) {
      console.error('[NutritionAnalytics] Error in chart update:', error);
      this.chartUpdateInProgress = false;
      if (!this.error) {
        this.error = 'Ошибка обновления графика';
      }
    }
  }

  private createCharts(ctxCalories: CanvasRenderingContext2D, ctxMacros: CanvasRenderingContext2D): void {
    try {
      const labels = this.timelineData.map(data => {
        if (!data.date) return '';
        const date = new Date(data.date);
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      });
      
      console.log('[NutritionAnalytics] Chart labels prepared:', labels.length);

      const caloriesDataset: any[] = [{
        label: 'Калории',
        data: this.timelineData.map(d => Number(d.calories) || 0),
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        fill: true,
        tension: 0.4
      }];

      const macrosDatasets: any[] = [
        {
          label: 'Белки (г)',
          data: this.timelineData.map(d => Number(d.protein) || 0),
          borderColor: '#4ecdc4',
          backgroundColor: 'rgba(78, 205, 196, 0.1)',
          fill: false,
          tension: 0.4
        },
        {
          label: 'Жиры (г)',
          data: this.timelineData.map(d => Number(d.fat) || 0),
          borderColor: '#f39c12',
          backgroundColor: 'rgba(243, 156, 18, 0.1)',
          fill: false,
          tension: 0.4
        },
        {
          label: 'Углеводы (г)',
          data: this.timelineData.map(d => Number(d.carbohydrate) || 0),
          borderColor: '#45b7d1',
          backgroundColor: 'rgba(69, 183, 209, 0.1)',
          fill: false,
          tension: 0.4
        }
      ];
      
      const configCalories: ChartConfiguration = {
        type: 'line' as ChartType,
        data: {
          labels,
          datasets: caloriesDataset
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 750
          },
          plugins: {
            legend: {
              display: true,
              position: 'top'
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            },
            x: {
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            }
          },
          elements: {
            point: {
              radius: 4,
              hoverRadius: 6
            }
          }
        }
      };

      const configMacros: ChartConfiguration = {
        type: 'line' as ChartType,
        data: {
          labels,
          datasets: macrosDatasets
        },
        options: configCalories.options
      } as ChartConfiguration;

      console.log('[NutritionAnalytics] Creating charts...');
      // Create charts outside Angular
      this.zone.runOutsideAngular(() => {
        this.nutritionChartCalories = new Chart(ctxCalories, configCalories);
        this.nutritionChartMacros = new Chart(ctxMacros, configMacros);
      });
      console.log('[NutritionAnalytics] Charts created successfully');
      
      this.chartUpdateInProgress = false;
      this.cdr.detectChanges();
      
    } catch (error) {
      console.error('[NutritionAnalytics] Error creating chart:', error);
      this.chartUpdateInProgress = false;
      if (!this.error) {
        this.error = 'Ошибка создания графика';
      }
      this.cdr.detectChanges();
    }
  }

  // Legacy method for compatibility
  updateChart(): void {
    console.log('[NutritionAnalytics] updateChart() called - delegating to safeUpdateChart()');
    this.safeUpdateChart();
  }

  private triggerAutoAI(): void {
    try {
      if (!this.aiAnalysis && !this.isGeneratingAI && this.overviewStats) {
        console.log('[NutritionAnalytics] Auto-triggering AI analysis');
        this.generateAIAnalysis();
      }
    } catch (e) {
      console.warn('[NutritionAnalytics] Auto AI trigger failed:', e);
    }
  }

  generateAIAnalysis(): void {
    if (!this.overviewStats) {
      this.aiError = 'Недостаточно данных для анализа. Загружаются данные...';
      return;
    }

    this.isGeneratingAI = true;
    this.aiError = '';

    // Use the real AI recommendations API endpoint
    this.nutritionService.generateAIRecommendations(parseInt(this.selectedPeriod)).subscribe({
      next: (response: any) => {
        this.aiAnalysis = response;
        this.isGeneratingAI = false;
      },
      error: (error) => {
        console.error('Error generating AI analysis:', error);
        this.aiError = 'Ошибка генерации анализа. Попробуйте позже.';
        
        // Fallback to mock analysis if API fails
        setTimeout(() => {
          this.aiAnalysis = this.generateMockAIAnalysis();
          this.isGeneratingAI = false;
          this.aiError = '';
        }, 1000);
      }
    });
  }

  private generateMockAIAnalysis(): AIAnalysis {
    const avgCalories = this.overviewStats?.avg_calories || 0;
    const avgProtein = this.overviewStats?.avg_protein || 0;
    const uniqueProducts = this.overviewStats?.unique_products || 0;

    let assessment = '';
    if (avgCalories < 1500) {
      assessment = 'Ваше среднее потребление калорий ниже рекомендуемого. Это может привести к дефициту энергии и питательных веществ.';
    } else if (avgCalories > 2500) {
      assessment = 'Ваше потребление калорий превышает среднюю норму. Рассмотрите возможность сокращения порций или увеличения физической активности.';
    } else {
      assessment = 'Ваше потребление калорий находится в пределах нормы. Продолжайте поддерживать сбалансированное питание.';
    }

    const insights = [
      `В среднем вы потребляете ${this.formatNumber(avgCalories)} калорий в день`,
      `Ваш рацион включает ${uniqueProducts} различных продуктов`,
      `Среднее потребление белка: ${this.formatNumber(avgProtein)}г в день`,
      uniqueProducts > 15 ? 'Хорошее разнообразие в рационе' : 'Стоит увеличить разнообразие продуктов'
    ];

    const recommendations = [
      {
        title: 'Увеличьте потребление овощей',
        description: 'Добавьте в рацион больше свежих овощей для получения витаминов и клетчатки'
      },
      {
        title: 'Контролируйте размер порций',
        description: 'Используйте небольшие тарелки и внимательно отслеживайте количество съеденного'
      },
      {
        title: 'Пейте больше воды',
        description: 'Увеличьте потребление чистой воды до 1.5-2 литров в день'
      }
    ];

    return {
      overall_assessment: assessment,
      key_insights: insights,
      recommendations: recommendations,
      nutritional_balance: {
        protein_score: avgProtein > 50 ? 8 : 6,
        protein_comment: avgProtein > 50 ? 'Достаточное количество белка' : 'Стоит увеличить потребление белка',
        carbs_score: 7,
        carbs_comment: 'Умеренное потребление углеводов',
        fats_score: 6,
        fats_comment: 'Обратите внимание на качество потребляемых жиров'
      },
      suggested_goals: [
        {
          title: 'Ежедневное потребление белка',
          description: 'Увеличить потребление белка до 60г в день',
          target: '60г белка',
          icon: 'fa-dumbbell'
        },
        {
          title: 'Разнообразие продуктов',
          description: 'Попробовать 3 новых продукта на этой неделе',
          target: '3 новых продукта',
          icon: 'fa-seedling'
        }
      ]
    };
  }

  // Helper methods for template
  formatNumber(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') return '0';
    
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    
    return Number(num.toFixed(1)).toString();
  }

  getCaloriesTrend(): string {
    return this.caloriesTrendClass;
  }

  getCaloriesTrendIcon(): string {
    return this.caloriesTrendIcon;
  }

  getCaloriesTrendText(): string {
    return this.caloriesTrendText;
  }

  getProteinTrend(): string {
    return this.proteinTrendClass;
  }

  getProteinTrendIcon(): string {
    return this.proteinTrendIcon;
  }

  getProteinTrendText(): string {
    return this.proteinTrendText;
  }

  getGoalAchievementTrend(): string {
    return this.goalTrendClass;
  }

  getGoalAchievementIcon(): string {
    return this.goalTrendIcon;
  }

  getGoalAchievementText(): string {
    return this.goalTrendText || 'Нет данных';
  }

  getProductPercentage(product: TopProduct, index: number): number {
    return this.productPercentages[index] || 0;
  }

  getMacroPercentage(macro: 'protein' | 'carbs' | 'fats'): number {
    return this.macroPercentages[macro] || 0;
  }

  getHourlyData(): Array<{ hour: string, count: number, percentage: number }> {
    // Return cached computed result to avoid heavy recalculations each CD cycle
    return this.cachedHourlyData;
  }

  private updateHourlyDataCache(): void {
    try {
      if (!this.eatingPatterns?.hourly_distribution) {
        this.cachedHourlyData = [];
        return;
      }

      const values = Object.values(this.eatingPatterns.hourly_distribution);
      if (values.length === 0) {
        this.cachedHourlyData = [];
        return;
      }

      const maxCount = Math.max(...values);
      this.cachedHourlyData = Object.entries(this.eatingPatterns.hourly_distribution).map(([hour, count]) => ({
        hour: hour.padStart(2, '0'),
        count,
        percentage: maxCount > 0 ? (count as number / maxCount) * 100 : 0
      }));
    } catch (error) {
      console.error('[NutritionAnalytics] Error updating hourly data cache:', error);
      this.cachedHourlyData = [];
    }
  }

  private updateProductPercentages(): void {
    if (!this.topProducts || this.topProducts.length === 0) {
      this.productPercentages = [];
      return;
    }
    const maxCalories = this.topProducts[0].total_calories || 0;
    this.productPercentages = this.topProducts.map(p => {
      const percentage = maxCalories > 0 ? Math.round(((p.total_calories || 0) / maxCalories) * 100) : 0;
      // Ограничиваем визуальное отображение 100%, но сохраняем реальное значение
      return percentage;
    });
  }

  getVisualPercentage(index: number): number {
    const percentage = this.productPercentages[index] || 0;
    return Math.min(percentage, 100);
  }

  isOverflowing(index: number): boolean {
    const percentage = this.productPercentages[index] || 0;
    return percentage > 100;
  }

  getOverflowPercentage(index: number): number {
    const percentage = this.productPercentages[index] || 0;
    if (percentage <= 100) return 0;
    
    // Показываем дополнительное заполнение для значений выше 100%
    const overflow = percentage - 100;
    return Math.min(overflow, 100); // Ограничиваем второй слой тоже 100%
  }

  getBalanceClass(score: number): string {
    if (score >= 8) return 'score-good';
    if (score >= 6) return 'score-medium';
    return 'score-poor';
  }

  // Health Score Methods
  getOverallHealthScore(): number {
    return this.scores.overall;
  }

  getCalorieBalanceScore(): number {
    return this.scores.calorie;
  }

  getMacroBalanceScore(): number {
    return this.scores.macro;
  }

  getVarietyScore(): number {
    return this.scores.variety;
  }

  getConsistencyScore(): number {
    return this.scores.consistency;
  }

  getCalorieBalanceClass(): string {
    const score = this.getCalorieBalanceScore();
    if (score >= 20) return 'score-excellent';
    if (score >= 15) return 'score-good';
    if (score >= 10) return 'score-fair';
    return 'score-poor';
  }

  getMacroBalanceClass(): string {
    const score = this.getMacroBalanceScore();
    if (score >= 20) return 'score-excellent';
    if (score >= 15) return 'score-good';
    if (score >= 10) return 'score-fair';
    return 'score-poor';
  }

  getVarietyScoreClass(): string {
    const score = this.getVarietyScore();
    if (score >= 20) return 'score-excellent';
    if (score >= 15) return 'score-good';
    if (score >= 10) return 'score-fair';
    return 'score-poor';
  }

  getConsistencyClass(): string {
    const score = this.getConsistencyScore();
    if (score >= 20) return 'score-excellent';
    if (score >= 15) return 'score-good';
    if (score >= 10) return 'score-fair';
    return 'score-poor';
  }

  getHealthRecommendations(): Array<{ icon: string, text: string }> {
    return this.cachedHealthRecommendations;
  }

  private updateDerivedViewState(): void {
    try {
      // Trends
      const avgCalories = this.overviewStats?.avg_calories ?? 0;
      this.caloriesTrendClass = avgCalories > 2000 ? 'warning' : 'good';
      this.caloriesTrendIcon = avgCalories > 2000 ? 'fa-arrow-up' : 'fa-check';
      this.caloriesTrendText = avgCalories > 2000 ? 'Выше нормы' : 'В норме';

      const avgProtein = this.overviewStats?.avg_protein ?? 0;
      this.proteinTrendClass = avgProtein > 50 ? 'good' : 'warning';
      this.proteinTrendIcon = avgProtein > 50 ? 'fa-arrow-up' : 'fa-arrow-down';
      this.proteinTrendText = avgProtein > 50 ? 'Хорошо' : 'Мало';

      const goal = this.overviewStats?.goal_achievement ?? 0;
      this.goalTrendClass = goal > 80 ? 'good' : goal > 60 ? 'warning' : 'danger';
      this.goalTrendIcon = goal > 80 ? 'fa-arrow-up' : goal > 60 ? 'fa-minus' : 'fa-arrow-down';
      this.goalTrendText = goal > 80 ? 'Отлично' : goal > 60 ? 'Хорошо' : 'Нужно улучшить';

      // Macro percentages - use realistic default values if no data
      const proteinCals = (this.overviewStats?.avg_protein || 0) * 4;
      const carbsCals = (this.overviewStats?.avg_carbohydrate || 0) * 4;
      const fatsCals = (this.overviewStats?.avg_fat || 0) * 9;
      const total = proteinCals + carbsCals + fatsCals;
      
      if (total > 0) {
        this.macroPercentages = {
          protein: Math.round((proteinCals / total) * 100),
          carbs: Math.round((carbsCals / total) * 100),
          fats: Math.round((fatsCals / total) * 100)
        };
      } else {
        // Use realistic default distribution when no data
        this.macroPercentages = {
          protein: 20,
          carbs: 50,
          fats: 30
        };
      }

      // Scores
      const calorieScore = (() => {
        if (!this.overviewStats) return 0;
        const c = this.overviewStats.avg_calories;
        if (c >= 1800 && c <= 2200) return 25;
        if (c >= 1500 && c <= 2500) return 20;
        if (c >= 1200 && c <= 2800) return 15;
        return 10;
      })();

      const macroScore = (() => {
        const p = this.macroPercentages.protein;
        const cc = this.macroPercentages.carbs;
        const f = this.macroPercentages.fats;
        let score = 0;
        score += (p >= 15 && p <= 25) ? 8 : (p >= 10 && p <= 30) ? 6 : 3;
        score += (cc >= 45 && cc <= 65) ? 8 : (cc >= 40 && cc <= 70) ? 6 : 3;
        score += (f >= 20 && f <= 35) ? 9 : (f >= 15 && f <= 40) ? 6 : 3;
        return Math.min(score, 25);
      })();

      const varietyScore = (() => {
        if (!this.overviewStats) return 0;
        const u = this.overviewStats.unique_products;
        if (u >= 20) return 25;
        if (u >= 15) return 20;
        if (u >= 10) return 15;
        if (u >= 5) return 10;
        return 5;
      })();

      const consistencyScore = (() => {
        if (!this.overviewStats) return 0;
        const daysWithData = this.overviewStats.days_with_data;
        const totalDays = parseInt(this.selectedPeriod);
        const consistency = totalDays > 0 ? (daysWithData / totalDays) * 100 : 0;
        if (consistency >= 90) return 25;
        if (consistency >= 80) return 20;
        if (consistency >= 70) return 15;
        if (consistency >= 50) return 10;
        return 5;
      })();

      this.scores = {
        calorie: calorieScore,
        macro: macroScore,
        variety: varietyScore,
        consistency: consistencyScore,
        overall: calorieScore + macroScore + varietyScore + consistencyScore
      };

      // Recommendations
      const recs: Array<{ icon: string, text: string }> = [];
      if (calorieScore < 15) recs.push({ icon: 'fa-balance-scale', text: 'Отрегулировать калорийность' });
      if (macroScore < 15) recs.push({ icon: 'fa-chart-pie', text: 'Сбалансировать БЖУ' });
      if (varietyScore < 15) recs.push({ icon: 'fa-seedling', text: 'Увеличить разнообразие' });
      if (consistencyScore < 15) recs.push({ icon: 'fa-calendar-check', text: 'Вести дневник регулярно' });
      this.cachedHealthRecommendations = recs;

      this.cdr.markForCheck();
    } catch (e) {
      console.error('[NutritionAnalytics] Error updating derived view state:', e);
    }
  }
}
