import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; 
import { Auth } from '../../services/auth'; 

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule], 
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  isEditing = false;

  user = {
    pseudo: 'Chargement...',
    team_color: 'red', 
    score: 0,
    avatar: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png'
  };

  selected_game_mode: string = "hasard";

  constructor(
    private router: Router, 
    private auth: Auth,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.chargerProfil();
  }

  async chargerProfil() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const data = await this.auth.getMe(); 
        this.user.pseudo = data.pseudo;
        this.user.team_color = data.team_color || 'red';
        //if (data.score !== undefined) this.user.score = data.score;
      } catch (err) {
        console.error("Erreur d'authentification ou non connecté :", err);
        this.auth.logout();
        this.router.navigate(['/login']); 
      }
    }
  }

  async toggleEdit() {
    if (this.isEditing) {
      await this.sauvegarderProfil();
    }
    this.isEditing = !this.isEditing;
  }

  async sauvegarderProfil() {
    try {
      await this.auth.updateProfile({
        pseudo: this.user.pseudo,
        team_color: this.user.team_color
      });
      console.log("Profil mis à jour !");
    } catch (err) {
      console.error("Erreur lors de la sauvegarde :", err);
    }
  }

  changeColor() {
    this.user.team_color = this.user.team_color === 'red' ? 'blue' : 'red';
  }

  choisir_mode(mode: string) {
    this.selected_game_mode = mode;
  }

  lancer_partie() {
    this.router.navigate(['/duel'], { 
      queryParams: { mode: this.selected_game_mode } 
    });
  }

  naviguer(route: string) {
    this.router.navigate([route]);
  }
}