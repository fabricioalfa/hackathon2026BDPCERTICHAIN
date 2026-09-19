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

const TOKEN_KEY = 'certichain_token';
const USER_KEY = 'certichain_user';
const ROLE_KEY = 'certichain_role';
const FULL_NAME_KEY = 'certichain_full_name';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly username = signal<string | null>(localStorage.getItem(USER_KEY));
  private readonly role = signal<string | null>(localStorage.getItem(ROLE_KEY));
  private readonly fullName = signal<string | null>(localStorage.getItem(FULL_NAME_KEY));

  constructor(private http: HttpClient, private router: Router) {}

  get tokenValue(): string | null {
    return this.token();
  }

  get isAuthenticated(): boolean {
    return !!this.token();
  }

  get usernameValue(): string | null {
    return this.username();
  }

  get roleValue(): string | null {
    return this.role();
  }

  get fullNameValue(): string | null {
    return this.fullName();
  }

  login(username: string, password: string) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/api/auth/login`, { username, password });
  }

  saveSession(auth: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, auth.token);
    localStorage.setItem(USER_KEY, auth.username);
    localStorage.setItem(ROLE_KEY, auth.role ?? '');
    localStorage.setItem(FULL_NAME_KEY, auth.fullName ?? '');
    this.token.set(auth.token);
    this.username.set(auth.username);
    this.role.set(auth.role ?? '');
    this.fullName.set(auth.fullName ?? '');
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(FULL_NAME_KEY);
    this.token.set(null);
    this.username.set(null);
    this.role.set(null);
    this.fullName.set(null);
    this.router.navigate(['/login']);
  }
}
