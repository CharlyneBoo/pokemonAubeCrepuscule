import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router'; 
import { PokemonService, PokemonInfo } from '../../services/pokemon.service';
import { PokemonTeamService, PokemonTeam } from '../../services/pokemon_team.service';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-dex',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dex.component.html'
})
export class DexComponent implements OnInit {
  user = {
    id: '',
    pseudo: 'Chargement...',
    team_color: 'bleu'
  };

  pokemons: PokemonInfo[] = [];
  
  // Filtres de recherche
  searchNom: string = '';
  searchId: string = ''; 
  searchType1: string = '';
  searchType2: string = '';

  // Pagination
  offset: number = 0;
  limit: number = 100;

  // Modale
  showAjout: boolean = false;
  teamsDisponibles: PokemonTeam[] = [];
  pokemonSelectionneId: number | null = null;

  constructor(private pokemonService: PokemonService,private teamService: PokemonTeamService,private auth: Auth,private router: Router,@Inject(PLATFORM_ID) private platformId: Object){}

  async ngOnInit() {
    await this.chargerProfil();
    this.lancerRecherche(true);
  }

  async chargerProfil() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const data = await this.auth.getMe();
        this.user.id = data.id;
        this.user.pseudo = data.pseudo;
        this.user.team_color = data.team_color;
      } catch (err) {
        console.error("Erreur profil Dex :", err);
      }
    }
  }

  lancerRecherche(reset: boolean = false) {
    if (reset) {
      this.offset = 0;
      this.pokemons = [];
    }
    this.pokemonService.searchPokemons(this.searchNom, this.searchId, this.searchType1, this.searchType2, this.offset, this.limit)
  .subscribe({
    next: (donneesRecues: PokemonInfo[]) => {
      
      let searchResult: PokemonInfo[] = [];
      for (let i = 0; i < donneesRecues.length; i++) {
        let pokemonActuel = donneesRecues[i];
        pokemonActuel.isFlipped = false; 
        searchResult.push(pokemonActuel);
      }
      for (let j = 0; j < searchResult.length; j++) {
        this.pokemons.push(searchResult[j]);
      }

      this.pokemons.sort(function(pokemon1, pokemon2) {
        if (pokemon1.id < pokemon2.id) {
          return -1;
        } else if (pokemon1.id > pokemon2.id) {
          return 1;
        } else {
          return 0; 
        }
      });

    },
    error: (erreurServeur: any) => {
      console.error("Il y a eu une erreur avec l'API Pokemon :", erreurServeur);
    }
  });
  }

  ouvrirAjout(pokemonId: number) {
    if (!this.user.id) {
      alert("Tu dois être connecté pour ajouter un Pokémon !");
      return;
    }
    this.pokemonSelectionneId = pokemonId;
    this.teamService.getPokemonTeams(this.user.id).subscribe({
      next: (teams) => {
        // On ne montre que les équipes qui ont de la place
        this.teamsDisponibles = teams.filter(t => t.pokemons.length < 6);
        this.showAjout = true; 
      },
      error: (err) => console.error("Erreur récup équipes", err)
    });
  }

  fermerModal() {
    this.showAjout = false;
    this.pokemonSelectionneId = null;
  }

  ajouterAEquipe(team: PokemonTeam) {
    if (this.pokemonSelectionneId === null) return;

    if (team.pokemons.includes(this.pokemonSelectionneId)) {
      alert(`${team.nom} possède déjà ce Pokémon !`);
      return;
    }

    team.pokemons.push(this.pokemonSelectionneId);
    this.teamService.updatePokemonTeam(team.id, team.pokemons).subscribe({
      next: () => {
        alert(`Ajouté à ${team.nom} !`);
        this.fermerModal(); 
      },
      error: (err) => alert("Erreur lors de l'ajout")
    });
  }

  chargerPlus() {
    this.offset += this.limit;
    this.lancerRecherche();
  }

  toggleFlip(pokemon: PokemonInfo) {
    pokemon.isFlipped = !pokemon.isFlipped;
  }

  naviguer(route: string) {
    this.router.navigate([route]);
  }
}