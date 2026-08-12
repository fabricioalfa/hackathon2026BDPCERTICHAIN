import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CertificateService, Certificate } from '../../core/services/certificate.service';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, CardModule, ButtonModule, ToolbarModule, TagModule, TableModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  certificates: Certificate[] = [];

  constructor(
    private auth: AuthService,
    private certService: CertificateService,
    private router: Router
  ) {}

  ngOnInit() {
    this.certService.findAll().subscribe((certs) => (this.certificates = certs));
  }

  logout() {
    this.auth.logout();
  }

  goTo(path: string) {
    this.router.navigate([path]);
  }

  statusSeverity(status: string) {
    return status === 'ACTIVE' ? 'success' : 'warn';
  }
}
