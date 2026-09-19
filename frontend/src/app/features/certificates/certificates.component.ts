import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CertificateService, Certificate } from '../../core/services/certificate.service';
import { AuthService } from '../../core/services/auth.service';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-certificates',
  imports: [CommonModule, ButtonModule, TableModule, TagModule, DialogModule, DividerModule, CardModule, ProgressSpinnerModule],
  templateUrl: './certificates.component.html',
  styleUrl: './certificates.component.css'
})
export class CertificatesComponent implements OnInit {
  certificates: Certificate[] = [];
  selected: Certificate | null = null;
  showDetail = false;
  loading = true;
  error: string | null = null;

  constructor(
    readonly certService: CertificateService,
    private auth: AuthService,
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

  view(cert: Certificate) {
    this.selected = cert;
    this.showDetail = true;
  }

  openDoc(uuid: string) {
    window.open(this.certService.documentUrl(uuid), '_blank');
  }

  copy(text: string) {
    navigator.clipboard.writeText(text);
    this.messageService.add({ severity: 'info', summary: 'Copiado', detail: 'Valor copiado al portapapeles' });
  }

  statusSeverity(status: string) {
    return status === 'ACTIVE' ? 'success' : 'warn';
  }
}
