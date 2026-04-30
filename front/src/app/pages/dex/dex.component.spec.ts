import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { of, throwError } from 'rxjs';
import { DexComponent } from './dex.component';
import { PokemonService, PokemonInfo } from '../../services/pokemon.service';
import { PokemonTeamService, PokemonTeam } from '../../services/pokemon_team.service';
import { Auth } from '../../services/auth';

const mockUser = { id: 'user-1', email: 'sacha@test.com', pseudo: 'Sacha', team_color: 'red', avatar_url: '' };
const mockPokemon: PokemonInfo = { id: 1, nom: 'Bulbizarre', types: ['Plante'], taille: 7, poids: 69, description: '', habitat: '', image: '' };
const mockTeam: PokemonTeam = { id: 1, nom: 'Team A', user_id: 'user-1', pokemons: [1, 2] };

describe('DexComponent', () => {
    let component: DexComponent;
    let fixture: ComponentFixture<DexComponent>;
    let authSpy: jasmine.SpyObj<Auth>;
    let pokemonSpy: jasmine.SpyObj<PokemonService>;
    let teamSpy: jasmine.SpyObj<PokemonTeamService>;
    let router: Router;

    beforeEach(async () => {
        authSpy = jasmine.createSpyObj('Auth', ['getMe']);
        pokemonSpy = jasmine.createSpyObj('PokemonService', ['searchPokemons']);
        teamSpy = jasmine.createSpyObj('PokemonTeamService', ['getPokemonTeams', 'updatePokemonTeam']);

        authSpy.getMe.and.returnValue(Promise.resolve(mockUser));
        pokemonSpy.searchPokemons.and.returnValue(of([mockPokemon]));
        teamSpy.getPokemonTeams.and.returnValue(of([mockTeam]));

        await TestBed.configureTestingModule({
            imports: [DexComponent],
            providers: [
                provideRouter([]),
                provideHttpClient(),
                { provide: Auth, useValue: authSpy },
                { provide: PokemonService, useValue: pokemonSpy },
                { provide: PokemonTeamService, useValue: teamSpy },
                { provide: PLATFORM_ID, useValue: 'browser' }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(DexComponent);
        component = fixture.componentInstance;
        router = TestBed.inject(Router);
        fixture.detectChanges();
    });

    // Création du component
    it('should create', () => {
        expect(component).toBeTruthy();
    });

    // Chargement du profil
    it('should load user profile on init', async () => {
        await component.chargerProfil();
        expect(component.user.pseudo).toBe('Sacha');
        expect(component.user.id).toBe('user-1');
    });

    // Recherche de pokémons
    it('should load pokemons on lancerRecherche', () => {
        component.lancerRecherche(true);
        expect(pokemonSpy.searchPokemons).toHaveBeenCalled();
        expect(component.pokemons.length).toBeGreaterThan(0);
    });

    // Tri par ID
    it('should sort pokemons by id', () => {
        const p2: PokemonInfo = { ...mockPokemon, id: 2 };
        pokemonSpy.searchPokemons.and.returnValue(of([p2, mockPokemon]));
        component.lancerRecherche(true);
        expect(component.pokemons[0].id).toBe(1);
        expect(component.pokemons[1].id).toBe(2);
    });

    // Test du toggleFlip
    it('should toggle isFlipped on pokemon', () => {
        const p = { ...mockPokemon, isFlipped: false };
        component.toggleFlip(p);
        expect(p.isFlipped).toBeTrue();
        component.toggleFlip(p);
        expect(p.isFlipped).toBeFalse();
    });

    // ouvrirAjout — alerte si non connecté
    it('should alert if user not connected on ouvrirAjout', () => {
        spyOn(window, 'alert');
        component.user.id = '';
        component.ouvrirAjout(1);
        expect(window.alert).toHaveBeenCalled();
        expect(component.showAjout).toBeFalse();
    });

    // filtre les équipes pleines
    it('should only show teams with less than 6 pokemons', () => {
        const fullTeam: PokemonTeam = { id: 2, nom: 'Pleine', user_id: 'user-1', pokemons: [1, 2, 3, 4, 5, 6] };
        teamSpy.getPokemonTeams.and.returnValue(of([mockTeam, fullTeam]));
        component.user.id = 'user-1';
        component.ouvrirAjout(1);
        expect(component.teamsDisponibles.length).toBe(1);
        expect(component.teamsDisponibles[0].id).toBe(1);
    });

    // fermerModal
    it('should close modal and reset selection', () => {
        component.showAjout = true;
        component.pokemonSelectionneId = 1;
        component.fermerModal();
        expect(component.showAjout).toBeFalse();
        expect(component.pokemonSelectionneId).toBeNull();
    });

    // ajouterAEquipe — pokemon déjà dans l'équipe
    it('should alert if pokemon already in team', () => {
        spyOn(window, 'alert');
        component.pokemonSelectionneId = 1;
        const team = { ...mockTeam, pokemons: [1, 2] };
        component.ajouterAEquipe(team);
        expect(window.alert).toHaveBeenCalled();
        expect(teamSpy.updatePokemonTeam).not.toHaveBeenCalled();
    });

    // ajouterAEquipe — succès
    it('should update team and close modal on success', () => {
        spyOn(window, 'alert');
        teamSpy.updatePokemonTeam.and.returnValue(of({ ...mockTeam, pokemons: [2, 5] }));
        component.pokemonSelectionneId = 5;
        component.ajouterAEquipe({ ...mockTeam, pokemons: [2] });
        expect(teamSpy.updatePokemonTeam).toHaveBeenCalled();
        expect(component.showAjout).toBeFalse();
    });

    // naviguer
    it('should navigate to given route', () => {
        spyOn(router, 'navigate');
        component.naviguer('/home');
        expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });
});