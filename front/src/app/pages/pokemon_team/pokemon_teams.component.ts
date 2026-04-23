import { Component, OnInit } from '@angular/core';
import { PokemonTeamService, PokemonTeam } from '../../services/pokemon_team.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pokemon-teams',
  standalone: true, 
  imports: [CommonModule, FormsModule], 
templateUrl: './pokemon_teams.component.html'})
export class PokemonTeamsComponent implements OnInit {
  teams: PokemonTeam[] = [];

  constructor(private teamService: PokemonTeamService) {}

  ngOnInit() {
    this.chargerEquipes();
  }

  chargerEquipes() {
    this.teamService.getPokemonTeams().subscribe({
      next: (data) => this.teams = data,
      error: (err) => console.error(err)
    });
  }

  getImageUrl(pokemonId: number): string {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`;
  }

  toggleEdit(team: PokemonTeam) {
    team.isEditing = !team.isEditing;
  }

  supprimerEquipe(teamId: number) {
    if(confirm("Delete team?")) {
      this.teamService.deletePokemonTeam(teamId).subscribe(() => {
        this.chargerEquipes(); // On recharge la liste après avoir supprimé
      });
    }
  }

  completerEquipe(teamId: number) {
    this.teamService.completePokemonTeam(teamId).subscribe(() => {
      this.chargerEquipes();
    });
  }

  retirerPokemon(team: PokemonTeam, indexDuPokemon: number) {
    if (!team.isEditing) return;

    // On retire le pokemon du tableau
    team.pokemons.splice(indexDuPokemon, 1);
    
    // On sauvegarde la nouvelle équipe dans le backend
    this.teamService.updatePokemonTeam(team.id, team.pokemons).subscribe();
  }
ajouterPokemon(team: PokemonTeam) {
    if (!team.isEditing) return;

    if (team.pokemons.length >= 6) {
      alert("Full team");
      return;
    }

    const idSaisi = prompt("Enter pokemon id :");

    if (idSaisi && !isNaN(Number(idSaisi))) {
      const pokemonId = Number(idSaisi);
      
      if (team.pokemons.includes(pokemonId)) {
        alert("Already in the team ");
        return; 
      }

      team.pokemons.push(pokemonId);
      
      this.teamService.updatePokemonTeam(team.id, team.pokemons).subscribe({
        error: (err) => {
          console.error(err);
          alert("Error saving");
        }
      });
    }
  }
  creerNouvelleEquipe() {
    const nomEquipe = prompt("Team name");

    if (nomEquipe && nomEquipe.trim() !== "") {
      this.teamService.createPokemonTeam(nomEquipe).subscribe({
        next: () => {
          this.chargerEquipes(); 
        },
        error: (err) => {
          console.error(err);
          alert("Error creating the team");
        }
      });
    }
  }
  
}