import { Routes } from '@angular/router';
import { DexComponent } from './pages/dex/dex.component';
import { PokemonTeamsComponent } from './pages/pokemon_team/pokemon_teams.component';
import { HomeComponent } from './pages/home/home.component';

import { Login } from './login/login';
import { Register } from './register/register';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'dex', component: DexComponent,canActivate: [authGuard]  },
  { path: 'pokemonteams', component: PokemonTeamsComponent, canActivate: [authGuard]  },
  { path: 'home', component: HomeComponent,canActivate: [authGuard]  },
  { path: '**', component: Login },
];
