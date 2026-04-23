import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PokemonService, PokemonInfo } from '../../services/pokemon.service';
import { PokemonTeamService, PokemonTeam } from '../../services/pokemon_team.service';

@Component({
  selector: 'app-dex',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dex.component.html'
})
export class DexComponent implements OnInit {
  // Stocke tous les pokémons actuellement affichés à l'écran
  pokemons: PokemonInfo[] = [];

  // Variables liées aux inputs de la barre de recherche
  searchNom: string = '';
  searchId: string = ''; 
  searchType1: string = '';
  searchType2: string = '';

  // Gestion de la pagination (on en charge 50 par 50 pour pas faire crasher le navigateur)
  offset: number = 0;
  limit: number = 100;

  showModalAjout: boolean = false;
  teamsDisponibles: PokemonTeam[] = [];
  pokemonSelectionneId: number | null = null;

  constructor(private pokemonService: PokemonService,private teamService: PokemonTeamService) { }

  /**
   * Fonction de lancement
   */
  ngOnInit() {
    this.lancerRecherche(true);
  }
  ouvrirModalAjout(pokemonId: number) {
    this.pokemonSelectionneId = pokemonId;
    
    // On demande au backend la liste fraîche des équipes
    this.teamService.getPokemonTeams().subscribe({
      next: (teams) => {
        // L'astuce pro : On filtre DIRECTEMENT pour ne garder que les équipes non pleines !
        this.teamsDisponibles = teams.filter(t => t.pokemons.length < 6);
        this.showModalAjout = true; // On affiche la popup
      }
    });
  }
  fermerModal() {
    this.showModalAjout = false;
    this.pokemonSelectionneId = null;
  }
  // Fonction principale qui appelle l'API via le service
  // Le paramètre 'reset' permet de savoir si c'est une nouvelle recherche ou juste la page suivante
  lancerRecherche(reset: boolean = false) {
    if (reset) {
      this.offset = 0;
      this.pokemons = [];// On vide tout avant de chercher
    }

    this.pokemonService.searchPokemons(this.searchNom, this.searchId, this.searchType1, this.searchType2, this.offset, this.limit)
      .subscribe({
        next: (data: PokemonInfo[]) => {
          const nouveaux = data.map((p: PokemonInfo) => ({ ...p, isFlipped: false }));
          this.pokemons = [...this.pokemons, ...nouveaux];
          this.pokemons.sort((a, b) => a.id - b.id);
        },
        error: (err: any) => console.error('Erreur', err)
      });
  }

  /**
   * Function pour charger plus
   */
  chargerPlus() {
    this.offset += this.limit;
    this.lancerRecherche();
  }

// Alterne l'affichage recto/verso de la carte sélectionnée
  toggleFlip(pokemon: PokemonInfo) {
    pokemon.isFlipped = !pokemon.isFlipped;
  }

  ajouterAEquipe(team: PokemonTeam) {
    if (this.pokemonSelectionneId === null) return;

    if (team.pokemons.includes(this.pokemonSelectionneId)) {
      alert(`${team.nom} possède déjà ce Pokémon !`);
      return;
    }

    // On ajoute le pokémon et on envoie la mise à jour au backend
    team.pokemons.push(this.pokemonSelectionneId);
    this.teamService.updatePokemonTeam(team.id, team.pokemons).subscribe({
      next: () => {
        alert(`Pokémon ajouté avec succès à ${team.nom} !`);
        this.fermerModal(); 
      },
      error: (err) => {
        console.error(err);
        alert("Erreur lors de l'ajout.");
      }
    });
  }
}