import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CertificateService, Certificate } from '../../core/services/certificate.service';
import { OcrService, OcrResult } from '../../core/services/ocr.service';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { AccordionModule } from 'primeng/accordion';

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
    DialogModule,
    DividerModule,
    ProgressSpinnerModule,
    TagModule,
    AccordionModule
  ],
  templateUrl: './issue.component.html',
  styleUrl: './issue.component.css'
})
export class IssueComponent implements OnInit, OnDestroy {
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
  private router = inject(Router);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  private dniSub!: { unsubscribe(): void };

  form = this.fb.group({
    title: ['', Validators.required],
    docType: ['IDENTIDAD', Validators.required],
    holderDni: [''],
    holderName: [''],
    holderDateOfBirth: [''],
    expiryDate: [null as Date | null],
    metadataJson: ['']
  });

  ngOnInit() {
    this.dniSub = this.form.controls.holderDni.valueChanges.subscribe(() => this.checkExistingByDni());
  }

  ngOnDestroy() {
    this.dniSub?.unsubscribe();
  }

  loading = false;
  issued: Certificate | null = null;
  showResult = false;

  // Prevalidación de duplicados: documentos ya emitidos para el CI detectado
  existingCerts: Certificate[] = [];
  checkingExisting = false;

  // Subida de documento + OCR
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  fileBase64: string | null = null;
  dragging = false;
  ocrLoading = false;
  ocrResult: OcrResult | null = null;
  isPdfFile = false;

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
    const isImage = file.type.startsWith('image/');
    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');
    if (!isImage && !isPdf) {
      this.messageService.add({ severity: 'warn', summary: 'Archivo no válido', detail: 'Solo se admiten imágenes (JPG, PNG, WebP, TIFF) o PDF' });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      this.messageService.add({ severity: 'warn', summary: 'Archivo demasiado grande', detail: 'El máximo permitido es 10 MB' });
      return;
    }
    this.selectedFile = file;
    this.isPdfFile = isPdf;
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }
    this.previewUrl = URL.createObjectURL(file);
    this.readAsBase64(file);
    if (isImage) {
      this.runOcr();
    } else {
      this.readPdfAndRunOcr(file);
    }
  }

  private readPdfAndRunOcr(file: File) {
    this.ocrLoading = true;
    this.ocrResult = null;
    this.ocrService.extract(file).subscribe({
      next: (res) => {
        this.ocrLoading = false;
        this.ocrResult = res;
        this.applyOcrFields(res);
      },
      error: (err) => {
        this.ocrLoading = false;
        this.ocrResult = null;
        const msg = err.error?.detail || 'No se pudo leer el documento PDF. Verifica que sean páginas escaneadas legibles.';
        this.messageService.add({ severity: 'error', summary: 'Error de OCR', detail: msg });
      }
    });
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
    this.isPdfFile = false;
    this.existingCerts = [];
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
    if (this.alreadyEmitted()) {
      this.messageService.add({ severity: 'warn', summary: 'Registro ya existente', detail: 'Esta persona ya tiene un documento emitido y respaldado. No se permite una nueva emisión.' });
      return;
    }
    const v = this.form.value;
    const titular = v.holderName || v.holderDni || 'sin titular';
    this.confirmationService.confirm({
      key: 'global',
      header: 'Emitir certificado',
      message: `Se registrará «${v.title}» a nombre de ${titular} en la cadena de bloques y el documento quedará custodiado. ¿Deseas continuar?`,
      icon: 'pi pi-shield',
      acceptLabel: 'Sí, emitir',
      rejectLabel: 'Cancelar',
      accept: () => this.emit()
    });
  }

  clearFilePrompt() {
    if (!this.previewUrl) return;
    this.confirmationService.confirm({
      key: 'global',
      header: 'Quitar documento',
      message: 'Se descartará la fotocopia cargada y los datos extraídos por el OCR. Esta acción no se puede deshacer.',
      icon: 'pi pi-times-circle',
      acceptLabel: 'Sí, quitar',
      rejectLabel: 'Cancelar',
      accept: () => this.clearFile()
    });
  }

  hasBackedDocument(cert: Certificate): boolean {
    return cert.documentAvailable;
  }

  alreadyEmitted(): boolean {
    return this.existingCerts.some(c => c.documentAvailable);
  }

  checkExistingByDni() {
    const dni = this.form.value.holderDni?.trim() ?? '';
    if (!dni) {
      this.existingCerts = [];
      this.checkingExisting = false;
      return;
    }
    this.checkingExisting = true;
    this.certService.findByDni(dni).subscribe({
      next: (certs) => {
        this.existingCerts = certs;
        this.checkingExisting = false;
      },
      error: () => {
        this.existingCerts = [];
        this.checkingExisting = false;
      }
    });
  }

  private emit() {
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
          // Un tick extra garantiza que la detección de cambios termine de
          // renderizar el QR antes de abrir el diálogo de resultado.
          setTimeout(() => {
            this.showResult = true;
          }, 0);
        },
        error: (err) => {
          this.loading = false;
          const msg = err.error?.message || 'No se pudo emitir el certificado';
          this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
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
    this.existingCerts = [];
  }

  back() {
    this.router.navigate(['/dashboard']);
  }
}
