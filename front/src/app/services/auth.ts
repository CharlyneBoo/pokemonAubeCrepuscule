import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

const API = 'http://localhost:8000';

interface Token { access_token: string; token_type: string; }
interface UserOut { id: string; email: string; pseudo: string; team_color: string; }

@Injectable({
  providedIn: 'root',
})
export class Auth {
  constructor(private http: HttpClient) { }

  async register(email: string, password: string, pseudo: string, team_color: string): Promise<UserOut> {
    return firstValueFrom(
      this.http.post<UserOut>(`${API}/register`, { email, password, pseudo, team_color })
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
