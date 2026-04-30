import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// L'interface sert juste de "moule" pour que TypeScript connaisse la forme d'une équipe
export interface PokemonTeam {
  id: number;
  nom: string;
  user_id: string; 
  pokemons: number[];
  isEditing?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PokemonTeamService {
  
  private apiUrl = `${environment.api.pokemon_teams}/pokemonteams`;

  constructor(private http: HttpClient) {}

  getPokemonTeams(userId: string): Observable<PokemonTeam[]> {
    let url = this.apiUrl + '/user/' + userId;
        return this.http.get<PokemonTeam[]>(url);
  }

  createPokemonTeam(nom: string, userId: string): Observable<PokemonTeam> {
    let url = this.apiUrl + "?nom=" + nom + "&user_id=" + userId;
    let empty = {}; 
    return this.http.post<PokemonTeam>(url, empty);
  }

  deletePokemonTeam(id: number): Observable<any> {
    let url = this.apiUrl + '/' + id;
    return this.http.delete(url);
  }

  updatePokemonTeam(id: number, pokemons: number[]): Observable<PokemonTeam> {
    let url = this.apiUrl + '/' + id;
    let donneesAEnvoyer = { 
      pokemons: pokemons 
    };
    
    return this.http.put<PokemonTeam>(url, donneesAEnvoyer);
  }

  completeTeam(id: number): Observable<PokemonTeam> {
    let url = this.apiUrl + '/' + id + '/complete';
    let corpsVide = {};
    
    return this.http.post<PokemonTeam>(url, corpsVide);
  }
}