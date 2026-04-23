import { Routes } from '@angular/router';
import { DexComponent } from './pages/dex/dex.component'; 
import { PokemonTeamsComponent } from './pages/pokemon_team/pokemon_teams.component';

export const routes: Routes = [
  { path: 'dex', component: DexComponent },
  { path: 'pokemonteams', component: PokemonTeamsComponent },

];