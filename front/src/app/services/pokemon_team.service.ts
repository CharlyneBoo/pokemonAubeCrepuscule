import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PokemonTeam {
  id: number;
  nom: string;
  pokemons: number[]; // On ne stocke que les numéros !
  isEditing?: boolean; // Variable invisible pour gérer ton effet visuel de la "PokemonTeam 2"
}

@Injectable({
  providedIn: 'root'
})
export class PokemonTeamService {
  private apiUrl = 'http://localhost:8003/pokemonteams';

  constructor(private http: HttpClient) { }

  getPokemonTeams(): Observable<PokemonTeam[]> {
    return this.http.get<PokemonTeam[]>(this.apiUrl);
  }

  createPokemonTeam(nom: string): Observable<PokemonTeam> {
    return this.http.post<PokemonTeam>(`${this.apiUrl}?nom=${nom}`, {});
  }

  deletePokemonTeam(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  updatePokemonTeam(id: number, pokemons: number[]): Observable<PokemonTeam> {
    return this.http.put<PokemonTeam>(`${this.apiUrl}/${id}`, { pokemons });
  }

  completePokemonTeam(id: number): Observable<PokemonTeam> {
    return this.http.post<PokemonTeam>(`${this.apiUrl}/${id}/complete`, {});
  }
}