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
    });

    // searchPokemons avec les paramètres par défault
    it('should GET /search with default params', () => {
        service.searchPokemons().subscribe(pokemons => {
            expect(pokemons).toEqual([mockPokemon]);
        });
        const req = httpMock.expectOne(r => r.url === `${API}/search`);
        expect(req.request.params.get('offset')).toBe('0');
        expect(req.request.params.get('limit')).toBe('50');
        req.flush([mockPokemon]);
    });

    // searchPokemons avec le nom
    it('should GET /search with nom filter', () => {
        service.searchPokemons('Bulbizarre').subscribe();
        const req = httpMock.expectOne(r => r.url === `${API}/search`);
        expect(req.request.params.get('nom')).toBe('Bulbizarre');
        req.flush([mockPokemon]);
    });

    // searchPokemons avec le type
    it('should GET /search with type filters', () => {
        service.searchPokemons(undefined, undefined, 'Plante', 'Poison').subscribe();
        const req = httpMock.expectOne(r => r.url === `${API}/search`);
        expect(req.request.params.get('type1')).toBe('Plante');
        expect(req.request.params.get('type2')).toBe('Poison');
        req.flush([mockPokemon]);
    });
});