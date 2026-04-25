import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../services/auth';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  email = '';
  password = '';
  error = '';
  loading = false;

  constructor(private auth: Auth, private router: Router) { }

  async onSubmit() {
    this.error = '';
    this.loading = true;
    try {
      await this.auth.login(this.email, this.password);
      this.router.navigate(['/home']);
    } catch (err: any) {
      this.error = err?.error?.detail || 'Identifiants invalides';
    } finally {
      this.loading = false;
    }
  }
}
