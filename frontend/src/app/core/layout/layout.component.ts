import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { Ripple } from 'primeng/ripple';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-layout',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ButtonModule, AvatarModule, MenuModule, Ripple],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent implements OnInit {
  sidebarCollapsed = false;
  mobileSidebar = false;

  userMenu: MenuItem[] = [];

  constructor(
    private router: Router,
    private auth: AuthService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit() {
    this.userMenu = [
      { label: this.username, icon: 'pi pi-user', disabled: true },
      { label: this.role, icon: 'pi pi-wallet', disabled: true },
      { separator: true },
      { label: 'Cerrar sesión', icon: 'pi pi-sign-out', command: () => this.confirmLogout() }
    ];
  }

  get username(): string {
    return this.auth.fullNameValue ?? this.auth.usernameValue ?? 'Usuario';
  }

  get role(): string {
    return this.auth.roleValue ?? '';
  }

  get isAuthenticated(): boolean {
    return this.auth.isAuthenticated;
  }

  get initials(): string {
    const name = this.auth.fullNameValue || this.auth.usernameValue || 'Usuario';
    const parts = name.split(' ').filter(Boolean);
    const initials = parts
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
    return initials || 'U';
  }

  toggleLayout() {
    if (window.innerWidth <= 992) {
      this.mobileSidebar = !this.mobileSidebar;
    } else {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    }
  }

  closeMobile() {
    this.mobileSidebar = false;
  }

  onNavigate() {
    if (window.innerWidth <= 992) {
      this.mobileSidebar = false;
    }
  }

  goDashboard() {
    this.router.navigate(['/dashboard']);
  }

  goHome() {
    this.router.navigate([this.isAuthenticated ? '/dashboard' : '/verify']);
  }

  goLogin() {
    this.router.navigate(['/login']);
  }

  goTo(path: string) {
    this.router.navigate([path]);
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