import { Component, OnInit,Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Auth } from '../../services/auth'; 

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  user = {
    pseudo: 'Chargement...',
    team_color: '...',
    score: 0,
    avatar: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png'
  };

  constructor(private router: Router, private auth: Auth,@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit() {
    this.chargerProfil();
  }

  async chargerProfil() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const data = await this.auth.getMe(); 
        this.user.pseudo = data.pseudo;
        this.user.team_color = data.team_color;
      } catch (err) {
        console.error("Erreur d'authentification ou non connecté :", err);
        this.auth.logout();
        this.router.navigate(['/login']); 
      }
    }
  }

  naviguer(route: string) {
    this.router.navigate([route]);
  }
}