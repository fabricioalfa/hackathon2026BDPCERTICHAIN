import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CertificateService, HistoryRecord } from '../../core/services/certificate.service';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AvatarModule } from 'primeng/avatar';

export interface HistoryRow extends HistoryRecord {
  secCredito: string;
}

@Component({
  selector: 'app-history',
  imports: [CommonModule, CardModule, TableModule, TagModule, InputTextModule, ButtonModule, ProgressSpinnerModule, AvatarModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css'
})
export class HistoryComponent implements OnInit {
  rows: HistoryRow[] = [];
  loading = true;
  error: string | null = null;

  readonly certService: CertificateService;

  constructor(certService: CertificateService, private messageService: MessageService) {
    this.certService = certService;
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.error = null;
    this.certService.historyPublic().subscribe({
      next: (items) => {
        this.rows = items.map((item) => ({ ...item, secCredito: this.creditFor(item.uuid) }));
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'No se pudo cargar el historial';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: this.error ?? undefined });
      }
    });
  }

  creditFor(uuid: string): string {
    let n = 0;
    for (let i = 0; i < uuid.length; i++) {
      n = (n * 31 + uuid.charCodeAt(i)) % 9000000000;
    }
    return 'CR-' + String(1000000000 + n);
  }

  initialsOf(name: string): string {
    return (name || '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }
}