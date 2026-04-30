import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  sp_atk: number;
  sp_def: number;
  speed: number;
}

export interface PokemonInfo {
  id: number;
  nom: string;
  types: string[];
  taille: number;
  poids: number;
  description: string;
  habitat: string;
  image: string;
  stats?: PokemonStats;
  isFlipped?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PokemonService {
  private apiUrl = `${environment.api.pokemon}/dex`; 

  constructor(private http: HttpClient) { }

  searchPokemons(nom?: string, pokemon_id?: string, type1?: string, type2?: string, offset: number = 0, limit: number = 50): Observable<PokemonInfo[]> {
    let params = new HttpParams()
      .set('offset', offset.toString())
      .set('limit', limit.toString());
    
    if (nom) params = params.set('nom', nom);
    if (pokemon_id) params = params.set('pokemon_id', pokemon_id); 
    if (type1) params = params.set('type1', type1);
    if (type2) params = params.set('type2', type2);

    return this.http.get<PokemonInfo[]>(`${this.apiUrl}/search`, { params });
  }
}