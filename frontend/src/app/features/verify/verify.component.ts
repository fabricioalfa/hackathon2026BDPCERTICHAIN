import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CertificateService, Certificate } from '../../core/services/certificate.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-verify',
  imports: [CommonModule, FormsModule, ToastModule, InputTextModule, ButtonModule, CardModule, TagModule],
  providers: [MessageService],
  templateUrl: './verify.component.html',
  styleUrl: './verify.component.css'
})
export class VerifyComponent {
  uuid = '';
  hash = '';
  cert: Certificate | null = null;
  checking = false;

  constructor(
    private route: ActivatedRoute,
    private certService: CertificateService,
    private messageService: MessageService
  ) {
    this.route.queryParamMap.subscribe((params) => {
      const u = params.get('uuid');
      if (u) {
        this.uuid = u;
      }
    });
  }

  verify() {
    if (!this.uuid || !this.hash) {
      this.messageService.add({ severity: 'warn', summary: 'Datos requeridos', detail: 'Ingresa UUID y hash del documento' });
      return;
    }
    this.checking = true;
    this.certService.verifyPublic(this.uuid, this.hash).subscribe({
      next: (cert) => {
        this.checking = false;
        this.cert = cert;
      },
      error: (err) => {
        this.checking = false;
        this.cert = null;
        const msg = err.error?.message || 'El certificado no pudo ser validado';
        this.messageService.add({ severity: 'error', summary: 'No válido', detail: msg });
      }
    });
  }

  statusSeverity(status: string) {
    return status === 'ACTIVE' ? 'success' : 'warn';
  }
}
