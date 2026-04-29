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

    // getPokemonTeams
    it('should GET teams by user id', () => {
        service.getPokemonTeams('user-1').subscribe(teams => {
            expect(teams).toEqual([mockTeam]);
        });
        httpMock.expectOne(`${API}/user/user-1`).flush([mockTeam]);
    });

    // createPokemonTeam
    it('should POST to create a team', () => {
        service.createPokemonTeam('Team Test', 'user-1').subscribe(team => {
            expect(team).toEqual(mockTeam);
        });
        const req = httpMock.expectOne(`${API}?nom=Team Test&user_id=user-1`);
        expect(req.request.method).toBe('POST');
        req.flush(mockTeam);
    });

    // deletePokemonTeam
    it('should DELETE a team by id', () => {
        service.deletePokemonTeam(1).subscribe(res => expect(res).toBeTruthy());
        const req = httpMock.expectOne(`${API}/1`);
        expect(req.request.method).toBe('DELETE');
        req.flush({});
    });

    // updatePokemonTeam
    it('should PUT to update team pokemons', () => {
        service.updatePokemonTeam(1, [4, 5, 6]).subscribe(team => {
            expect(team.pokemons).toEqual([4, 5, 6]);
        });
        const req = httpMock.expectOne(`${API}/1`);
        expect(req.request.method).toBe('PUT');
        expect(req.request.body).toEqual({ pokemons: [4, 5, 6] });
        req.flush({ ...mockTeam, pokemons: [4, 5, 6] });
    });

    // completeTeam
    it('should POST to complete a team', () => {
        service.completeTeam(1).subscribe(team => expect(team).toEqual(mockTeam));
        const req = httpMock.expectOne(`${API}/1/complete`);
        expect(req.request.method).toBe('POST');
        req.flush(mockTeam);
    });
});