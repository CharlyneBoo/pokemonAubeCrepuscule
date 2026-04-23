import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../services/auth';

const TEAM_COLORS = [
  { value: 'red', label: 'Équipe Rouge', emoji: '🔴' },
  { value: 'blue', label: 'Équipe Bleue', emoji: '🔵' },
];

@Component({
  selector: 'app-register',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  email = '';
  password = '';
  pseudo = '';
  team_color = '';
  error = '';
  loading = false;

  readonly teams = TEAM_COLORS;

  constructor(private auth: Auth, private router: Router) { }

  async onSubmit() {
    this.error = '';
    if (!this.team_color) {
      this.error = 'Choisis une équipe !';
      return;
    }
    this.loading = true;
    try {
      await this.auth.register(this.email, this.password, this.pseudo, this.team_color);
      this.router.navigate(['/login']);
    } catch (err: any) {
      this.error = err?.error?.detail || 'Une erreur est survenue';
    } finally {
      this.loading = false;
    }
  }
}
