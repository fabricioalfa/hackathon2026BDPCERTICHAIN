import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CertificateService, Certificate } from '../../core/services/certificate.service';
import { AuthService } from '../../core/services/auth.service';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ToolbarModule } from 'primeng/toolbar';
import { ToastModule } from 'primeng/toast';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-certificates',
  imports: [CommonModule, ButtonModule, TableModule, TagModule, DialogModule, ToolbarModule, ToastModule, DividerModule],
  providers: [MessageService],
  templateUrl: './certificates.component.html',
  styleUrl: './certificates.component.css'
})
export class CertificatesComponent implements OnInit {
  certificates: Certificate[] = [];
  selected: Certificate | null = null;
  showDetail = false;

  constructor(
    readonly certService: CertificateService,
    private auth: AuthService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.certService.findAll().subscribe((certs) => (this.certificates = certs));
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

  logout() {
    this.auth.logout();
  }

  statusSeverity(status: string) {
    return status === 'ACTIVE' ? 'success' : 'warn';
  }
}
