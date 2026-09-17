import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CertificateService, Certificate } from '../../core/services/certificate.service';
import { OcrService, OcrResult } from '../../core/services/ocr.service';
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
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { AccordionModule } from 'primeng/accordion';
import { CommonModule } from '@angular/common';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const toTitleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

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
    DividerModule,
    ProgressSpinnerModule,
    TagModule,
    AccordionModule
  ],
  providers: [MessageService],
  templateUrl: './issue.component.html',
  styleUrl: './issue.component.css'
})
export class IssueComponent {
  docTypes: DocType[] = [
    { label: 'Carnet de identidad', value: 'IDENTIDAD' },
    { label: 'Garantía personal', value: 'GARANTIA_PERSONAL' },
    { label: 'Documento en custodia', value: 'CUSTODIA' },
    { label: 'Certificación institucional', value: 'INSTITUCIONAL' },
    { label: 'Constancia', value: 'CONSTANCIA' }
  ];

  private fb = inject(FormBuilder);
  private certService = inject(CertificateService);
  private ocrService = inject(OcrService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private messageService = inject(MessageService);

  form = this.fb.group({
    title: ['', Validators.required],
    docType: ['IDENTIDAD', Validators.required],
    holderDni: [''],
    holderName: [''],
    holderDateOfBirth: [''],
    expiryDate: [null as Date | null],
    metadataJson: ['']
  });

  loading = false;
  issued: Certificate | null = null;
  showResult = false;

  // Subida de documento + OCR
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  fileBase64: string | null = null;
  dragging = false;
  ocrLoading = false;
  ocrResult: OcrResult | null = null;

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragging = true;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.handleFile(file);
    }
  }

  onFilePicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.handleFile(file);
    }
    input.value = '';
  }

  handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      this.messageService.add({ severity: 'warn', summary: 'Archivo no válido', detail: 'Solo se admiten imágenes (JPG, PNG, WebP, TIFF)' });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      this.messageService.add({ severity: 'warn', summary: 'Archivo demasiado grande', detail: 'El máximo permitido es 10 MB' });
      return;
    }
    this.selectedFile = file;
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }
    this.previewUrl = URL.createObjectURL(file);
    this.readAsBase64(file);
    this.runOcr();
  }

  private readAsBase64(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.fileBase64 = dataUrl.split(',')[1] ?? null;
    };
    reader.onerror = () => {
      this.fileBase64 = null;
    };
    reader.readAsDataURL(file);
  }

  runOcr() {
    if (!this.selectedFile) return;
    this.ocrLoading = true;
    this.ocrResult = null;
    this.ocrService.extract(this.selectedFile).subscribe({
      next: (res) => {
        this.ocrLoading = false;
        this.ocrResult = res;
        this.applyOcrFields(res);
      },
      error: (err) => {
        this.ocrLoading = false;
        this.ocrResult = null;
        const msg = err.error?.detail || 'No se pudo leer el documento. Revisa que la fotocopia sea nítida.';
        this.messageService.add({ severity: 'error', summary: 'Error de OCR', detail: msg });
      }
    });
  }

  private applyOcrFields(res: OcrResult) {
    const patch: { holderDni?: string; holderName?: string; holderDateOfBirth?: string } = {};
    if (res.detectedDni) patch.holderDni = res.detectedDni;
    if (res.detectedName) patch.holderName = toTitleCase(res.detectedName);
    if (res.detectedDateOfBirth) patch.holderDateOfBirth = res.detectedDateOfBirth;
    if (Object.keys(patch).length) this.form.patchValue(patch);
    if (!this.form.value.title && res.detectedDni) {
      this.form.patchValue({ title: `Carnet de identidad Nº ${res.detectedDni}` });
    }
    const detected = res.fieldsDetected;
    this.messageService.add({
      severity: detected >= 2 ? 'success' : 'warn',
      summary: `OCR: ${detected}/3 campos detectados`,
      detail: detected >= 2 ? 'Revisa los datos y emite el certificado.' : 'Algunos campos no fueron legibles, completa los que falten.'
    });
  }

  clearFile() {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }
    this.selectedFile = null;
    this.previewUrl = null;
    this.fileBase64 = null;
    this.ocrResult = null;
    this.ocrLoading = false;
    this.form.patchValue({ holderDni: '', holderName: '', holderDateOfBirth: '' });
    if (this.form.value.title?.startsWith('Carnet de identidad')) {
      this.form.patchValue({ title: '' });
    }
  }

  fieldSource(field: 'dni' | 'name' | 'dob'): 'ocr' | 'manual' {
    if (!this.ocrResult) return 'manual';
    const detected =
      field === 'dni'
        ? this.ocrResult.detectedDni
        : field === 'name'
          ? this.ocrResult.detectedName
          : this.ocrResult.detectedDateOfBirth;
    return detected ? 'ocr' : 'manual';
  }

  sourceSeverity(source: 'ocr' | 'manual') {
    return source === 'ocr' ? 'success' : 'info';
  }

  submit() {
    if (this.form.invalid) {
      this.messageService.add({ severity: 'warn', summary: 'Campos requeridos', detail: 'Completa título y tipo de documento' });
      return;
    }
    this.loading = true;
    const v = this.form.value;
    this.certService
      .issue({
        title: v.title!,
        docType: v.docType!,
        holderDni: v.holderDni || undefined,
        holderName: v.holderName || undefined,
        holderDateOfBirth: v.holderDateOfBirth || undefined,
        expiryDate: v.expiryDate ? new Date(v.expiryDate).toISOString() : undefined,
        metadataJson: v.metadataJson || undefined,
        base64Content: this.fileBase64 || undefined
      })
      .subscribe({
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

  documentUrl(uuid: string) {
    return this.certService.documentUrl(uuid);
  }

  openDoc(uuid: string) {
    window.open(this.documentUrl(uuid), '_blank');
  }

  reset() {
    this.form.reset({ docType: 'IDENTIDAD' });
    this.clearFile();
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