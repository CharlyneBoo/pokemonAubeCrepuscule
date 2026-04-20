import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PokemonService, PokemonInfo } from '../../services/pokemon.service';

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

  constructor(private pokemonService: PokemonService) { }

  /**
   * Fonction de lancement
   */
  ngOnInit() {
    this.lancerRecherche(true);
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
          // On rajoute dynamiquement la propriété isFlipped pour gérer l'animation CSS au clic
          const nouveaux = data.map((p: PokemonInfo) => ({ ...p, isFlipped: false }));
          // On fusionne les anciens résultats avec les nouveaux (utile pour le "charger plus")
          this.pokemons = [...this.pokemons, ...nouveaux];
          // On force le tri par ID au cas où les requêtes asynchrones arrivent dans le désordre
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

  /**
   * TODO
   * @param pokemon 
   * @param event 
   */
  addToTeam(pokemon: PokemonInfo, event: Event) {
    event.stopPropagation();
    console.log(`Le Pokémon ${pokemon.nom} va être ajouté à l'équipe !`);
    alert(`${pokemon.nom} sélectionné !`);
  }
}