import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CertificateService, Certificate } from '../../core/services/certificate.service';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { CommonModule } from '@angular/common';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, CardModule, ButtonModule, TagModule, TableModule, ProgressSpinnerModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  certificates: Certificate[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private auth: AuthService,
    private certService: CertificateService,
    private router: Router,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.error = null;
    this.certService.findAll().subscribe({
      next: (certs) => {
        this.certificates = certs;
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

  goTo(path: string) {
    this.router.navigate([path]);
  }

  statusSeverity(status: string) {
    return status === 'ACTIVE' ? 'success' : 'warn';
  }
}
