import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { MenubarModule } from 'primeng/menubar';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-layout',
  imports: [CommonModule, RouterOutlet, MenubarModule, AvatarModule, ButtonModule],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent implements OnInit {
  items: MenuItem[] = [];

  constructor(
    private router: Router,
    private auth: AuthService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit() {
    this.items = [
      { label: 'Dashboard', icon: 'pi pi-home', routerLink: ['/dashboard'] },
      { label: 'Certificados', icon: 'pi pi-file', routerLink: ['/certificates'] },
      { label: 'Emitir certificado', icon: 'pi pi-plus', routerLink: ['/issue'] }
    ];
  }

  get username(): string {
    return this.auth.usernameValue ?? 'Usuario';
  }

  get role(): string {
    return this.auth.roleValue ?? '';
  }

  goDashboard() {
    this.router.navigate(['/dashboard']);
  }

  confirmLogout() {
    this.confirmationService.confirm({
      key: 'global',
      header: 'Cerrar sesión',
      message: '¿Deseas cerrar tu sesión y volver a la pantalla de ingreso?',
      icon: 'pi pi-sign-out',
      acceptLabel: 'Sí, salir',
      rejectLabel: 'Cancelar',
      accept: () => this.auth.logout()
    });
  }
}
