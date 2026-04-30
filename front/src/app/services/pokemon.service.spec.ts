import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PokemonService, PokemonInfo } from './pokemon.service';

const API = 'http://localhost:8002/dex';

const mockPokemon: PokemonInfo = {
    id: 1, nom: 'Bulbizarre', types: ['Plante'], taille: 7,
    poids: 69, description: 'Un pokemon', habitat: 'forêt', image: 'bulb.png'
};

describe('PokemonService', () => {
    let service: PokemonService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [PokemonService, provideHttpClient(), provideHttpClientTesting()]
        });
        service = TestBed.inject(PokemonService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    // Création du service
    it('should be created', () => {
        expect(service).toBeTruthy();
    })
});