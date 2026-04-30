import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface Token { access_token: string; token_type: string; }
export interface UserOut {
  id: string;
  email: string;
  pseudo: string;
  team_color: string;
  avatar_url?: string;
  aura?: number;
}
interface UserUpdate { pseudo?: string; team_color?: string; avatar_url?: string; } 

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private API = environment.api.auth;
  constructor(private http: HttpClient) { }

  async register(email: string, password: string, name: string, first_name: string, pseudo: string, team_color: string): Promise<UserOut> {
    return firstValueFrom(
      this.http.post<UserOut>(`${this.API}/register`, { email, password, name, first_name, pseudo, team_color })
    );
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<Token>(`${this.API}/login`, { email, password })
    );
    localStorage.setItem('token', res.access_token);
  }

  async getMe(): Promise<UserOut> {
    return firstValueFrom(
      this.http.get<UserOut>(`${this.API}/me`, {
        headers: { Authorization: `Bearer ${this.getToken()}` }
      })
    );
  }

  async updateProfile(userData: UserUpdate): Promise<UserOut> {
    return firstValueFrom(
      this.http.patch<UserOut>(`${this.API}/update_profile`, userData, {
        headers: { Authorization: `Bearer ${this.getToken()}` }
      })
    );
  }

  async getUsers(): Promise<UserOut[]> {
    return firstValueFrom(this.http.get<UserOut[]>(`${API}/users`));
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
