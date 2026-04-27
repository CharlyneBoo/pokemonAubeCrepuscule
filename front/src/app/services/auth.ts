import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

const API = 'http://localhost:8000';

interface Token { access_token: string; token_type: string; }
interface UserOut { id: string; email: string; pseudo: string; team_color: string; }
interface UserUpdate { pseudo?: string; team_color?: string; avatar_url?: string; } // Interface ajoutée pour le typage

@Injectable({
  providedIn: 'root',
})
export class Auth {
  constructor(private http: HttpClient) { }

  async register(email: string, password: string, name: string, first_name: string, pseudo: string, team_color: string): Promise<UserOut> {
    return firstValueFrom(
      this.http.post<UserOut>(`${API}/register`, { email, password, name, first_name, pseudo, team_color })
    );
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<Token>(`${API}/login`, { email, password })
    );
    localStorage.setItem('token', res.access_token);
  }

  async getMe(): Promise<UserOut> {
    return firstValueFrom(
      this.http.get<UserOut>(`${API}/me`, {
        headers: { Authorization: `Bearer ${this.getToken()}` }
      })
    );
  }

  // Ajout de la méthode updateProfile en utilisant HttpClient
  async updateProfile(userData: UserUpdate): Promise<UserOut> {
    return firstValueFrom(
      this.http.patch<UserOut>(`${API}/update_profile`, userData, {
        headers: { Authorization: `Bearer ${this.getToken()}` }
      })
    );
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.removeItem('token');
  }
}
