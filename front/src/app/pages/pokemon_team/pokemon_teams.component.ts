import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PokemonTeamService, PokemonTeam } from '../../services/pokemon_team.service';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-pokemon-teams',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pokemon_teams.component.html'
})
export class PokemonTeamsComponent implements OnInit {
  user = {
    id: '',
    pseudo: 'Chargement...',
    team_color: 'bleu',
    avatar: '/avatar/gobou.jpeg'
  };
  teams: PokemonTeam[] = [];

  constructor(private teamService: PokemonTeamService,private auth: Auth,private router: Router,@Inject(PLATFORM_ID) private platformId: Object) { }

  async ngOnInit() {
    await this.chargerProfil();
  }

  async chargerProfil() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const data = await this.auth.getMe();
        this.user.id = data.id;
        this.user.pseudo = data.pseudo;
        this.user.team_color = data.team_color;
        this.user.avatar = data.avatar_url ? data.avatar_url : '/avatar/gobou.jpeg';
        this.chargerEquipes();
      } catch (err) {
        console.error("Utilisateur non connecté ou erreur auth :", err);
        this.auth.logout();
        this.router.navigate(['/login']);
      }
    }
  }

  chargerEquipes() {
    this.teamService.getPokemonTeams(this.user.id).subscribe({
      next: (data) => this.teams = data,
      error: (err) => console.error("Erreur chargement équipes :", err)
    });
  }


  creerNouvelleEquipe() {
    const nomEquipe = prompt("Nom de l'équipe :");
    if (nomEquipe?.trim() && this.user.id) {
      this.teamService.createPokemonTeam(nomEquipe, this.user.id).subscribe({
        next: () => this.chargerEquipes(),
        error: () => alert("Erreur lors de la création")
      });
    }
  }

  supprimerEquipe(teamId: number) {
    if (confirm("Supprimer cette équipe ?")) {
      this.teamService.deletePokemonTeam(teamId).subscribe(() => this.chargerEquipes());
    }
  }

  completerEquipe(teamId: number) {
    this.teamService.completeTeam(teamId).subscribe(() => this.chargerEquipes());
  }

  toggleEdit(team: PokemonTeam) {
    team.isEditing = !team.isEditing;
  }

  ajouterPokemon(team: PokemonTeam) {
    if (!team.isEditing) return;
    if (team.pokemons.length >= 6) return alert("Équipe complète (6 max)");
    const idSaisi = prompt("ID du Pokémon :");
    const pokemonId = Number(idSaisi);
    if (idSaisi && !isNaN(pokemonId)) {
      if (team.pokemons.includes(pokemonId)) return alert("Déjà présent");
      team.pokemons.push(pokemonId);
      this.sauvegarderEquipe(team);
    }
  }

  retirerPokemon(team: PokemonTeam, index: number) {
    if (!team.isEditing) return;
    team.pokemons.splice(index, 1);
    this.sauvegarderEquipe(team);
  }

  private sauvegarderEquipe(team: PokemonTeam) {
    this.teamService.updatePokemonTeam(team.id, team.pokemons).subscribe({
      error: () => alert("Erreur de sauvegarde")
    });
  }

  getImageUrl(pokemonId: number): string {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`;
  }

  naviguer(route: string) {
    this.router.navigate([route]);
  }
}