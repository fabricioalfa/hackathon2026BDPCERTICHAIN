import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    ToastModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    CardModule
  ],
  providers: [MessageService],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private messageService = inject(MessageService);

  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });
  loading = false;


  submit() {
    if (this.form.invalid) {
      this.messageService.add({ severity: 'warn', summary: 'Campos requeridos', detail: 'Ingresa usuario y contrasena' });
      return;
    }
    this.loading = true;
    this.auth.login(this.form.value.username!, this.form.value.password!).subscribe({
      next: (auth) => {
        this.auth.saveSession(auth);
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.loading = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Credenciales invalidas' });
      }
    });
  }
}
