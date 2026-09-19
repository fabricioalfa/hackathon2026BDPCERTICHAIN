import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CertificateService, Certificate } from '../../core/services/certificate.service';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { AvatarModule } from 'primeng/avatar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ChartModule } from 'primeng/chart';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const DOC_TYPES: { code: string; label: string }[] = [
  { code: 'IDENTIDAD', label: 'Carnet de identidad' },
  { code: 'GARANTIA_PERSONAL', label: 'Garantía personal' },
  { code: 'CUSTODIA', label: 'Documento en custodia' },
  { code: 'INSTITUCIONAL', label: 'Certificación institucional' },
  { code: 'CONSTANCIA', label: 'Constancia' }
];

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    TagModule,
    TableModule,
    AvatarModule,
    ProgressSpinnerModule,
    ChartModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  certificates: Certificate[] = [];
  loading = true;
  error: string | null = null;

  totalCount = 0;
  activeCount = 0;
  activePct = 0;
  monthCount = 0;
  monthTrend = 0;
  uniqueHolders = 0;
  recent: Certificate[] = [];

  barData: unknown = null;
  barOptions: unknown = null;
  donutData: unknown = null;
  donutOptions: unknown = null;
  lineData: unknown = null;
  lineOptions: unknown = null;

  readonly todayLabel: string;
  readonly displayName: string;

  constructor(
    private auth: AuthService,
    private certService: CertificateService,
    private router: Router,
    private messageService: MessageService
  ) {
    const label = new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date());
    this.todayLabel = label.charAt(0).toUpperCase() + label.slice(1);
    this.displayName = auth.fullNameValue ?? auth.usernameValue ?? 'Usuario';
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.error = null;
    this.certService.findAll().subscribe({
      next: (certs) => {
        this.certificates = certs;
        this.computeStats();
        this.buildCharts();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 401) {
          this.messageService.add({ severity: 'error', summary: 'Sesión expirada', detail: 'Por favor inicia sesión de nuevo' });
          this.auth.logout();
        } else {
          this.error = err.error?.message || 'No se pudo cargar la lista de certificados';
          this.messageService.add({ severity: 'error', summary: 'Error', detail: this.error ?? undefined });
        }
      }
    });
  }

  private computeStats() {
    this.totalCount = this.certificates.length;
    this.activeCount = this.certificates.filter((c) => c.status === 'ACTIVE').length;
    this.activePct = this.totalCount > 0 ? Math.round((this.activeCount / this.totalCount) * 100) : 0;

    const now = new Date();
    let cur = 0;
    let prev = 0;
    const holders = new Set<string>();
    for (const cert of this.certificates) {
      const d = cert.issueDate ? new Date(cert.issueDate) : null;
      if (d && !isNaN(+d)) {
        if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) cur++;
        const prevRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        if (d.getFullYear() === prevRef.getFullYear() && d.getMonth() === prevRef.getMonth()) prev++;
      }
      holders.add(cert.holderDni || cert.holderName);
    }
    this.monthCount = cur;
    this.monthTrend = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0;
    this.uniqueHolders = holders.size;

    this.recent = [...this.certificates]
      .sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''))
      .slice(0, 8);
  }

  private buildCharts() {
    const types = DOC_TYPES.map((t) => t.code);
    const labels = DOC_TYPES.map((t) => t.label);
    const values = types.map((t) => this.certificates.filter((c) => c.docType === t).length);

    this.barData = {
      labels,
      datasets: [
        {
          label: 'Certificados',
          data: values,
          backgroundColor: (context: { chart: { ctx: CanvasRenderingContext2D; chartArea: { top: number; bottom: number } } }) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return 'rgba(37, 99, 235, 0.35)';
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(37, 99, 235, 0.85)');
            gradient.addColorStop(1, 'rgba(37, 99, 235, 0.12)');
            return gradient;
          },
          borderRadius: 8,
          borderSkipped: 'start',
          barPercentage: 0.55
        }
      ]
    };

    this.barOptions = {
      maintainAspectRatio: false,
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, border: { display: false } },
        y: { beginAtZero: true, grid: { color: '#eef2f8' }, border: { display: false }, ticks: { precision: 0 } }
      }
    };

    const inactive = this.totalCount - this.activeCount;
    this.donutData = {
      labels: ['Activos', 'Inactivos'],
      datasets: [
        {
          data: [this.activeCount, inactive],
          backgroundColor: ['#22c55e', '#f59e0b'],
          borderWidth: 0,
          hoverOffset: 6
        }
      ]
    };

    this.donutOptions = {
      maintainAspectRatio: false,
      responsive: true,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, padding: 20 }
        }
      }
    };

    const now = new Date();
    const lineLabels: string[] = [];
    const lineCounts: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
      lineLabels.push(MONTHS[ref.getMonth()]);
      lineCounts.push(
        this.certificates.filter((c) => {
          const d = c.issueDate ? new Date(c.issueDate) : null;
          return !!d && !isNaN(+d) && d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
        }).length
      );
    }

    this.lineData = {
      labels: lineLabels,
      datasets: [
        {
          label: 'Emisiones',
          data: lineCounts,
          borderColor: '#2563eb',
          backgroundColor: (context: { chart: { ctx: CanvasRenderingContext2D; chartArea: { top: number; bottom: number } } }) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return 'rgba(37, 99, 235, 0.2)';
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(37, 99, 235, 0.25)');
            gradient.addColorStop(1, 'rgba(37, 99, 235, 0.01)');
            return gradient;
          },
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#2563eb',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          borderWidth: 2.5
        }
      ]
    };

    this.lineOptions = {
      maintainAspectRatio: false,
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, border: { display: false } },
        y: { beginAtZero: true, grid: { color: '#eef2f8' }, border: { display: false }, ticks: { precision: 0 } }
      }
    };
  }

  initialsOf(title: string): string {
    return title
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  docTypeLabel(code: string): string {
    return DOC_TYPES.find((t) => t.code === code)?.label ?? code;
  }

  goTo(path: string) {
    this.router.navigate([path]);
  }

  statusSeverity(status: string) {
    return status === 'ACTIVE' ? 'success' : 'warn';
  }
}