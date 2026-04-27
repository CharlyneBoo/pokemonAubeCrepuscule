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
  standalone: true, 
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  email = '';
  password = '';
  pseudo = '';
  name = '';         
  first_name = '';   
  team_color = '';
  error = '';
  loading = false;

  readonly teams = TEAM_COLORS;

  constructor(private auth: Auth, private router: Router) { }

  async onSubmit() {
    this.error = '';
    
    if (!this.first_name || !this.name || !this.pseudo || !this.email || !this.password) {
      this.error = 'Remplis tous les champs !';
      return;
    }
    
    if (!this.team_color) {
      this.error = 'Choisis une équipe !';
      return;
    }
    
    this.loading = true;
    try {
      await this.auth.register(this.email, this.password, this.name, this.first_name, this.pseudo, this.team_color);
      this.router.navigate(['/login']);
    } catch (err: any) {
      // GESTION DU [object Object] DE FASTAPI
      if (err?.error?.detail && Array.isArray(err.error.detail)) {
        // Formate les erreurs de validation de FastAPI
        this.error = "Champs invalides : " + err.error.detail.map((e: any) => e.loc[e.loc.length - 1]).join(', ');
      } else {
        this.error = err?.error?.detail || 'Une erreur est survenue lors de l\'inscription';
      }
    } finally {
      this.loading = false;
    }
  }
}