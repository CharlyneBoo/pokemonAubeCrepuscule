import { Routes } from '@angular/router';
import { DexComponent } from './pages/dex/dex.component'; 
import { PokemonTeamsComponent } from './pages/pokemon_team/pokemon_teams.component';
import { Login } from './login/login';
import { Register } from './register/register';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
    { path: 'login', component: Login },
    { path: 'register', component: Register, canActivate: [authGuard] },
    { path: '**', component: Login },
    { path: 'dex', component: DexComponent },
    { path: 'pokemonteams', component: PokemonTeamsComponent },
];
