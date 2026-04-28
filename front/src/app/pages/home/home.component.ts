import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; 
import { Auth } from '../../services/auth'; 
import { PokemonTeamService } from '../../services/pokemon_team.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule], 
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  isEditing = false;

  user: any = {
    id: '', 
    pseudo: 'Chargement...',
    team_color: 'red', 
    score: 0,
    avatar: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png'
  };

  selected_game_mode: string = "hasard";
  equipe_selectionnee: any = null;
  
  show_team_modal: boolean = false;
  mes_equipes: any[] = [];

  constructor(
    private router: Router, 
    private auth: Auth,
    private teamService: PokemonTeamService, 
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.chargerProfil();
  }

  async chargerProfil() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const data = await this.auth.getMe(); 
        this.user.id = data.id; 
        this.user.pseudo = data.pseudo;
        this.user.team_color = data.team_color || 'red';
                this.charger_mes_equipes();
        
      } catch (err) {
        console.error("Erreur d'authentification ou non connecté :", err);
        this.auth.logout();
        this.router.navigate(['/login']); 
      }
    }
  }

  charger_mes_equipes() {
    if (this.user.id) {
      this.teamService.getPokemonTeams(this.user.id).subscribe({
        next: (data) => this.mes_equipes = data || [],
        error: (err) => console.error("Erreur chargement équipes :", err)
      });
    }
  }

  ouvrir_choix_equipe() {
    this.show_team_modal = true;
  }

  choisir_equipe(equipe: any) {
    if (!equipe.pokemons || equipe.pokemons.length !== 6) {
      alert("Cette équipe n'est pas complète (6 Pokémon requis) !");
      return;
    }
    this.equipe_selectionnee = equipe;
    this.show_team_modal = false;
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
    if (this.selected_game_mode === 'construit') {
      if (!this.equipe_selectionnee) return;
      
      const ids = this.equipe_selectionnee.pokemons.join(',');
      this.router.navigate(['/duel'], { queryParams: { mode: 'construit', team: ids } });
    } else {
      this.router.navigate(['/duel'], { queryParams: { mode: this.selected_game_mode } });
    }
  }

  naviguer(route: string) {
    this.router.navigate([route]);
  }
}