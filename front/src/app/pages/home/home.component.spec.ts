import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { of } from 'rxjs';
import { HomeComponent } from './home.component';
import { Auth } from '../../services/auth';
import { PokemonTeamService } from '../../services/pokemon_team.service';

const mockUser = { id: 'user-1', email: 'sacha@test.com', pseudo: 'Sacha', team_color: 'red', avatar_url: '/avatar/gobou.jpeg' };
const mockTeam = { id: 1, nom: 'Team A', user_id: 'user-1', pokemons: [1, 2, 3, 4, 5, 6] };

describe('HomeComponent', () => {
    let component: HomeComponent;
    let fixture: ComponentFixture<HomeComponent>;
    let authSpy: jasmine.SpyObj<Auth>;
    let teamSpy: jasmine.SpyObj<PokemonTeamService>;
    let router: Router;

    beforeEach(async () => {
        authSpy = jasmine.createSpyObj('Auth', ['getMe', 'logout', 'updateProfile']);
        teamSpy = jasmine.createSpyObj('PokemonTeamService', ['getPokemonTeams']);

        authSpy.getMe.and.returnValue(Promise.resolve(mockUser));
        authSpy.updateProfile.and.returnValue(Promise.resolve(mockUser));
        teamSpy.getPokemonTeams.and.returnValue(of([mockTeam]));

        await TestBed.configureTestingModule({
            imports: [HomeComponent],
            providers: [
                provideRouter([]),
                provideHttpClient(),
                { provide: Auth, useValue: authSpy },
                { provide: PokemonTeamService, useValue: teamSpy },
                { provide: PLATFORM_ID, useValue: 'browser' }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(HomeComponent);
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
        expect(component.user.team_color).toBe('red');
    });

    // Redirect si non connecté
    it('should logout and redirect to login if getMe fails', async () => {
        authSpy.getMe.and.returnValue(Promise.reject('non connecté'));
        spyOn(router, 'navigate');

        await component.chargerProfil();

        expect(authSpy.logout).toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    // Chargement des équipes
    it('should load teams after profile', async () => {
        await component.chargerProfil();
        expect(teamSpy.getPokemonTeams).toHaveBeenCalledWith('user-1');
        expect(component.mes_equipes).toEqual([mockTeam]);
    });

    // Choisir une équipe complète
    it('should select team if it has 6 pokemons', () => {
        component.choisir_equipe(mockTeam);
        expect(component.equipe_selectionnee).toEqual(mockTeam);
        expect(component.show_team_modal).toBeFalse();
    });

    // Refuser une équipe incomplète
    it('should alert if team has less than 6 pokemons', () => {
        spyOn(window, 'alert');
        component.choisir_equipe({ ...mockTeam, pokemons: [1, 2] });
        expect(window.alert).toHaveBeenCalled();
        expect(component.equipe_selectionnee).toBeNull();
    });

    // Changer de couleur d'équipe
    it('should toggle team color between red and blue', () => {
        component.user.team_color = 'red';
        component.changeColor();
        expect(component.user.team_color).toBe('blue');
        component.changeColor();
        expect(component.user.team_color).toBe('red');
    });

    // Sélection d'avatar
    it('should select avatar and close modal', () => {
        component.selectAvatar('/avatar/pika.jpeg');
        expect(component.user.avatar).toBe('/avatar/pika.jpeg');
        expect(component.isAvatarModalOpen).toBeFalse();
    });

    // Ouvrir modal avatar seulement en mode édition
    it('should open avatar modal only if editing', () => {
        component.isEditing = false;
        component.openAvatarModal();
        expect(component.isAvatarModalOpen).toBeFalse();

        component.isEditing = true;
        component.openAvatarModal();
        expect(component.isAvatarModalOpen).toBeTrue();
    });


    // Lancer partie mode hasard
    it('should navigate to duel with hasard mode', () => {
        spyOn(router, 'navigate');
        component.selected_game_mode = 'hasard';
        component.lancer_partie();
        expect(router.navigate).toHaveBeenCalledWith(['/duel'], { queryParams: { mode: 'hasard' } });
    });

    // Lancer partie mode construit sans équipe
    it('should not navigate if construit mode and no team selected', () => {
        spyOn(router, 'navigate');
        component.selected_game_mode = 'construit';
        component.equipe_selectionnee = null;
        component.lancer_partie();
        expect(router.navigate).not.toHaveBeenCalled();
    });

    // Lancer partie mode construit avec équipe
    it('should navigate to duel with team ids if construit mode', () => {
        spyOn(router, 'navigate');
        component.selected_game_mode = 'construit';
        component.equipe_selectionnee = { ...mockTeam, pokemons: [1, 2, 3, 4, 5, 6] };
        component.lancer_partie();
        expect(router.navigate).toHaveBeenCalledWith(['/duel'], {
            queryParams: { mode: 'construit', team: '1,2,3,4,5,6' }
        });
    });

    // Logout
    it('should clear token and navigate to login on logout', () => {
        spyOn(router, 'navigate');
        localStorage.setItem('token', 'fake');
        component.logout();
        expect(localStorage.getItem('token')).toBeNull();
        expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    // Navigation
    it('should navigate to given route', () => {
        spyOn(router, 'navigate');
        component.naviguer('/pokemon-teams');
        expect(router.navigate).toHaveBeenCalledWith(['/pokemon-teams']);
    });
});