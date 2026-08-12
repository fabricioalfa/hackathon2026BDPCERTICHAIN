import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CertificateService, Certificate } from '../../core/services/certificate.service';
import { AuthService } from '../../core/services/auth.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ToolbarModule } from 'primeng/toolbar';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { CommonModule } from '@angular/common';

interface DocType {
  label: string;
  value: string;
}

@Component({
  selector: 'app-issue',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    DatePickerModule,
    ButtonModule,
    CardModule,
    ToolbarModule,
    DialogModule,
    DividerModule
  ],
  providers: [MessageService],
  templateUrl: './issue.component.html',
  styleUrl: './issue.component.css'
})
export class IssueComponent {
  docTypes: DocType[] = [
    { label: 'Garantía personal', value: 'GARANTIA_PERSONAL' },
    { label: 'Documento en custodia', value: 'CUSTODIA' },
    { label: 'Certificación institucional', value: 'INSTITUCIONAL' },
    { label: 'Constancia', value: 'CONSTANCIA' }
  ];

  private fb = inject(FormBuilder);
  private certService = inject(CertificateService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private messageService = inject(MessageService);

  form = this.fb.group({
    title: ['', Validators.required],
    docType: ['', Validators.required],
    holderDni: [''],
    holderName: [''],
    expiryDate: [null as Date | null],
    metadataJson: ['']
  });

  loading = false;
  issued: Certificate | null = null;
  showResult = false;

  submit() {
    if (this.form.invalid) {
      this.messageService.add({ severity: 'warn', summary: 'Campos requeridos', detail: 'Completa titulo y tipo de documento' });
      return;
    }
    this.loading = true;
    const v = this.form.value;
    this.certService.issue({
      title: v.title!,
      docType: v.docType!,
      holderDni: v.holderDni || undefined,
      holderName: v.holderName || undefined,
      expiryDate: v.expiryDate ? new Date(v.expiryDate).toISOString() : undefined,
      metadataJson: v.metadataJson || undefined
    }).subscribe({
      next: (cert) => {
        this.loading = false;
        this.issued = cert;
        this.showResult = true;
      },
      error: () => {
        this.loading = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo emitir el certificado' });
      }
    });
  }

  reset() {
    this.form.reset();
    this.showResult = false;
    this.issued = null;
  }

  logout() {
    this.auth.logout();
  }

  back() {
    this.router.navigate(['/dashboard']);
  }
}
