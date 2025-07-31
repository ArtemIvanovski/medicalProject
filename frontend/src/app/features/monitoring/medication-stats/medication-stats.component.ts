import {Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy} from '@angular/core';
import {MedicationService, MedicationIntake, MedicationStats} from "../../../core/services";

declare var Chart: any;

@Component({
    selector: 'app-medication-stats',
    templateUrl: './medication-stats.component.html',
    styleUrls: ['./medication-stats.component.scss']
})
export class MedicationStatsComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('intakeChart', {static: false}) intakeChartRef!: ElementRef<HTMLCanvasElement>;
    @ViewChild('drugsChart', {static: false}) drugsChartRef!: ElementRef<HTMLCanvasElement>;
    @ViewChild('timelineChart', {static: false}) timelineChartRef!: ElementRef<HTMLCanvasElement>;
    private intakeChartInstance: any;
    private drugsChartInstance: any;
    private timelineChartInstance: any;
    showAddIntakeModal = false;
    showEditIntakeModal = false;
    showCreateReminderModal = false;
    showCreatePatternModal = false;
    editingIntake: MedicationIntake | null = null;

    stats: MedicationStats[] = [];
    intakes: MedicationIntake[] = [];
    isLoading = false;
    selectedPeriod = '30';
    selectedDrug = '';

    totalIntakes = 0;
    uniqueDrugs = 0;
    averagePerDay = 0;
    mostUsedDrug = '';

    uniqueDrugNames: string[] = [];
    timelineData: any[] = [];
    drugDistribution: any[] = [];
    dailyAverages: any[] = [];

    constructor(private medicationService: MedicationService) {
    }

    ngOnInit(): void {
        this.loadStatistics();
    }

    ngAfterViewInit(): void {
        setTimeout(() => {
            this.initializeCharts();
        }, 100);
    }

    ngOnDestroy(): void {
        if (this.intakeChartInstance) {
            this.intakeChartInstance.destroy();
        }
        if (this.drugsChartInstance) {
            this.drugsChartInstance.destroy();
        }
        if (this.timelineChartInstance) {
            this.timelineChartInstance.destroy();
        }
    }

    private loadStatistics(): void {
        this.isLoading = true;

        const days = parseInt(this.selectedPeriod);

        this.medicationService.getMedicationStats(days).subscribe({
            next: (response) => {
                this.stats = response.stats;
                this.calculateSummaryStats();
                this.loadTimelineData();
            },
            error: (error) => {
                console.error('Error loading stats:', error);
                this.isLoading = false;
            }
        });
    }

    private loadTimelineData(): void {
        const days = parseInt(this.selectedPeriod);

        this.medicationService.getMedicationTimeline(days, this.selectedDrug).subscribe({
            next: (response) => {
                this.intakes = response.intakes;
                this.prepareChartData();
                this.isLoading = false;

                setTimeout(() => {
                    this.initializeCharts();
                }, 100);
            },
            error: (error) => {
                console.error('Error loading timeline:', error);
                this.isLoading = false;
            }
        });
    }

    private calculateSummaryStats(): void {
        this.totalIntakes = this.stats.reduce((sum, stat) => sum + stat.total_intakes, 0);
        this.uniqueDrugs = this.stats.length;
        this.averagePerDay = this.totalIntakes / parseInt(this.selectedPeriod);
        this.mostUsedDrug = this.stats[0]?.drug_name || 'Нет данных';

        this.uniqueDrugNames = this.stats.map(stat => stat.drug_name);
    }

    private prepareChartData(): void {
        this.drugDistribution = this.stats.map(stat => ({
            name: stat.drug_name,
            value: stat.total_intakes,
            percentage: (stat.total_intakes / this.totalIntakes * 100).toFixed(1)
        }));

        const dailyIntakes = this.groupIntakesByDay();
        this.dailyAverages = Object.keys(dailyIntakes).map(date => ({
            date,
            count: dailyIntakes[date]
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        this.timelineData = this.groupIntakesByHour();
    }

    private groupIntakesByDay(): { [key: string]: number } {
        const groups: { [key: string]: number } = {};

        this.intakes.forEach(intake => {
            const date = new Date(intake.taken_at).toISOString().split('T')[0];
            groups[date] = (groups[date] || 0) + 1;
        });

        return groups;
    }

    private groupIntakesByHour(): any[] {
        const groups: { [key: number]: number } = {};

        for (let i = 0; i < 24; i++) {
            groups[i] = 0;
        }

        this.intakes.forEach(intake => {
            const hour = new Date(intake.taken_at).getHours();
            groups[hour]++;
        });

        return Object.keys(groups).map(hour => ({
            hour: parseInt(hour),
            count: groups[parseInt(hour)]
        }));
    }

    private initializeCharts(): void {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded');
            return;
        }

        this.createIntakeChart();
        this.createDrugsChart();
        this.createTimelineChart();
    }

    private createIntakeChart(): void {
        if (!this.intakeChartRef) return;

        const ctx = this.intakeChartRef.nativeElement.getContext('2d');

        // Уничтожаем предыдущий график
        if (this.intakeChartInstance) {
            this.intakeChartInstance.destroy();
        }

        this.intakeChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.dailyAverages.map(item => new Date(item.date).toLocaleDateString('ru-RU')),
                datasets: [{
                    label: 'Приемы в день',
                    data: this.dailyAverages.map(item => item.count),
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    private createDrugsChart(): void {
        if (!this.drugsChartRef) return;

        const ctx = this.drugsChartRef.nativeElement.getContext('2d');

        // Уничтожаем предыдущий график
        if (this.drugsChartInstance) {
            this.drugsChartInstance.destroy();
        }

        this.drugsChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: this.drugDistribution.map(item => item.name),
                datasets: [{
                    data: this.drugDistribution.map(item => item.value),
                    backgroundColor: [
                        '#007bff', '#28a745', '#ffc107', '#dc3545',
                        '#6c757d', '#17a2b8', '#fd7e14', '#6f42c1'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    private createTimelineChart(): void {
        if (!this.timelineChartRef) return;

        const ctx = this.timelineChartRef.nativeElement.getContext('2d');

        // Уничтожаем предыдущий график
        if (this.timelineChartInstance) {
            this.timelineChartInstance.destroy();
        }

        this.timelineChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: this.timelineData.map(item => `${item.hour}:00`),
                datasets: [{
                    label: 'Приемы по часам',
                    data: this.timelineData.map(item => item.count),
                    backgroundColor: 'rgba(0, 123, 255, 0.8)',
                    borderColor: '#007bff',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    onPeriodChange(): void {
        this.loadStatistics();
    }

    onDrugChange(): void {
        this.loadTimelineData();
    }

    exportData(): void {
        const data = {
            period: this.selectedPeriod,
            stats: this.stats,
            summary: {
                totalIntakes: this.totalIntakes,
                uniqueDrugs: this.uniqueDrugs,
                averagePerDay: this.averagePerDay,
                mostUsedDrug: this.mostUsedDrug
            }
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `medication-stats-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        window.URL.revokeObjectURL(url);
    }

    openAddIntakeModal(): void {
        this.editingIntake = null;
        this.showAddIntakeModal = true;
    }

    openEditIntakeModal(intake: MedicationIntake): void {
        this.editingIntake = intake;
        this.showEditIntakeModal = true;
    }

    openCreateReminderModal(): void {
        this.showCreateReminderModal = true;
    }

    openCreatePatternModal(): void {
        this.showCreatePatternModal = true;
    }

    closeAddIntakeModal(): void {
        this.showAddIntakeModal = false;
        this.editingIntake = null;
    }

    closeEditIntakeModal(): void {
        this.showEditIntakeModal = false;
        this.editingIntake = null;
    }

    closeCreateReminderModal(): void {
        this.showCreateReminderModal = false;
    }

    closeCreatePatternModal(): void {
        this.showCreatePatternModal = false;
    }

    onIntakeSaved(): void {
        this.loadStatistics();
    }

    onReminderSaved(): void {
        this.loadStatistics();
    }

    onPatternSaved(): void {
        this.loadStatistics();
    }
}