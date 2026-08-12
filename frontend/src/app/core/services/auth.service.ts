import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

export interface AuthResponse {
  token: string;
  username: string;
  fullName: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly token = signal<string | null>(localStorage.getItem('certichain_token'));
  private readonly username = signal<string | null>(localStorage.getItem('certichain_user'));

  constructor(private http: HttpClient, private router: Router) {}

  get tokenValue(): string | null {
    return this.token();
  }

  get isAuthenticated(): boolean {
    return !!this.token();
  }

  login(username: string, password: string) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/api/auth/login`, { username, password });
  }

  saveSession(auth: AuthResponse) {
    localStorage.setItem('certichain_token', auth.token);
    localStorage.setItem('certichain_user', auth.username);
    this.token.set(auth.token);
    this.username.set(auth.username);
  }

  logout() {
    localStorage.removeItem('certichain_token');
    localStorage.removeItem('certichain_user');
    this.token.set(null);
    this.username.set(null);
    this.router.navigate(['/login']);
  }
}
