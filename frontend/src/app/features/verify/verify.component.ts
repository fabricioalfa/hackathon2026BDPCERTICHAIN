import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CertificateService, Certificate, VerificationResult } from '../../core/services/certificate.service';
import { MessageService } from 'primeng/api';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-verify',
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, CardModule, TagModule],
  templateUrl: './verify.component.html',
  styleUrl: './verify.component.css'
})
export class VerifyComponent {
  uuid = '';
  hash = '';
  result: VerificationResult | null = null;
  checking = false;

  readonly certService: CertificateService;

  constructor(
    private route: ActivatedRoute,
    certService: CertificateService,
    private messageService: MessageService
  ) {
    this.certService = certService;
    this.route.queryParamMap.subscribe((params) => {
      const u = params.get('uuid');
      if (u) {
        this.uuid = u;
        this.check();
      }
    });
  }

  reset() {
    this.uuid = '';
    this.hash = '';
    this.result = null;
  }

  openDoc(uuid: string) {
    window.open(this.certService.documentUrl(uuid), '_blank');
  }

  verify() {
    if (!this.uuid) {
      this.messageService.add({ severity: 'warn', summary: 'Datos requeridos', detail: 'Ingresa el UUID del certificado (links del QR lo cargan automáticamente)' });
      return;
    }
    this.check();
  }

  check() {
    this.checking = true;
    this.result = null;
    this.certService.verifyPublic(this.uuid.trim(), this.hash.trim() || undefined).subscribe({
      next: (res) => {
        this.checking = false;
        this.result = res;
      },
      error: (err) => {
        this.checking = false;
        this.result = null;
        const msg = err.error?.message || 'El certificado no pudo ser validado';
        this.messageService.add({ severity: 'error', summary: 'No válido', detail: msg });
      }
    });
  }

  get cert(): Certificate | null {
    return this.result?.certificate ?? null;
  }

  statusSeverity(status: string) {
    return status === 'ACTIVE' ? 'success' : 'warn';
  }
}
