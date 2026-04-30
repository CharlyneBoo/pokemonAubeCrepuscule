import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PokemonTeamService, PokemonTeam } from './pokemon_team.service';

const API = 'http://localhost:8003/pokemonteams';

const mockTeam: PokemonTeam = { id: 1, nom: 'Team Test', user_id: 'user-1', pokemons: [1, 2, 3] };

describe('PokemonTeamService', () => {
    let service: PokemonTeamService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [PokemonTeamService, provideHttpClient(), provideHttpClientTesting()]
        });
        service = TestBed.inject(PokemonTeamService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    // Création du service
    it('should be created', () => {
        expect(service).toBeTruthy();
    });


});