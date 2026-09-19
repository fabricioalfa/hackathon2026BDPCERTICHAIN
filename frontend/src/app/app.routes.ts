import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { issueChangesGuard } from './core/guards/issue-changes.guard';
import { LayoutComponent } from './core/layout/layout.component';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: 'dashboard', canActivate: [authGuard], loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'certificates', canActivate: [authGuard], loadComponent: () => import('./features/certificates/certificates.component').then(m => m.CertificatesComponent) },
      {
        path: 'issue',
        canActivate: [authGuard],
        canDeactivate: [issueChangesGuard],
        loadComponent: () => import('./features/issue/issue.component').then(m => m.IssueComponent)
      },
      { path: 'verify', loadComponent: () => import('./features/verify/verify.component').then(m => m.VerifyComponent) }
    ]
  },
  { path: '**', redirectTo: '/dashboard' }
];
