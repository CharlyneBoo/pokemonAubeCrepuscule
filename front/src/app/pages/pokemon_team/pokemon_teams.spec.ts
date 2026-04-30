import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { of, throwError } from 'rxjs';
import { PokemonTeamsComponent } from './pokemon_teams.component';
import { PokemonTeamService, PokemonTeam } from '../../services/pokemon_team.service';
import { Auth } from '../../services/auth';

const mockUser = { id: 'user-1', email: 'sacha@test.com', pseudo: 'Sacha', team_color: 'red', avatar_url: '/avatar/gobou.jpeg' };
const mockTeam: PokemonTeam = { id: 1, nom: 'Team A', user_id: 'user-1', pokemons: [1, 2, 3] };

describe('PokemonTeamsComponent', () => {
    let component: PokemonTeamsComponent;
    let fixture: ComponentFixture<PokemonTeamsComponent>;
    let authSpy: jasmine.SpyObj<Auth>;
    let teamSpy: jasmine.SpyObj<PokemonTeamService>;
    let router: Router;

    beforeEach(async () => {
        authSpy = jasmine.createSpyObj('Auth', ['getMe', 'logout']);
        teamSpy = jasmine.createSpyObj('PokemonTeamService', [
            'getPokemonTeams', 'createPokemonTeam', 'deletePokemonTeam',
            'updatePokemonTeam', 'completeTeam'
        ]);

        authSpy.getMe.and.returnValue(Promise.resolve(mockUser));
        teamSpy.getPokemonTeams.and.returnValue(of([mockTeam]));

        await TestBed.configureTestingModule({
            imports: [PokemonTeamsComponent],
            providers: [
                provideRouter([]),
                provideHttpClient(),
                { provide: Auth, useValue: authSpy },
                { provide: PokemonTeamService, useValue: teamSpy },
                { provide: PLATFORM_ID, useValue: 'browser' }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(PokemonTeamsComponent);
        component = fixture.componentInstance;
        router = TestBed.inject(Router);
        fixture.detectChanges();
    });

    // Création du component
    it('should create', () => {
        expect(component).toBeTruthy();
    });

    // Chargement du profil au init
    it('should load user profile on init', async () => {
        await component.ngOnInit();
        expect(authSpy.getMe).toHaveBeenCalled();
        expect(component.user.pseudo).toBe('Sacha');
        expect(component.user.id).toBe('user-1');
    });

    // Chargement des équipes après profil
    it('should load teams after profile', async () => {
        await component.chargerProfil();
        expect(teamSpy.getPokemonTeams).toHaveBeenCalledWith('user-1');
        expect(component.teams).toEqual([mockTeam]);
    });

    // Redirect si non connecté
    it('should logout and redirect to login if getMe fails', async () => {
        authSpy.getMe.and.returnValue(Promise.reject('non connecté'));
        spyOn(router, 'navigate');

        await component.chargerProfil();

        expect(authSpy.logout).toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    // Avatar par défaut si pas d'avatar
    it('should use default avatar if avatar_url is null', async () => {
        authSpy.getMe.and.returnValue(Promise.resolve({ ...mockUser, avatar_url: null as any }));
        await component.chargerProfil();
        expect(component.user.avatar).toBe('/avatar/gobou.jpeg');
    });

    // Création d'équipe
    it('should create team and reload teams', () => {
        spyOn(window, 'prompt').and.returnValue('Nouvelle équipe');
        teamSpy.createPokemonTeam.and.returnValue(of(mockTeam));
        component.user.id = 'user-1';

        component.creerNouvelleEquipe();

        expect(teamSpy.createPokemonTeam).toHaveBeenCalledWith('Nouvelle équipe', 'user-1');
    });

    // Pas de création si prompt vide
    it('should not create team if prompt is empty', () => {
        spyOn(window, 'prompt').and.returnValue('');
        component.creerNouvelleEquipe();
        expect(teamSpy.createPokemonTeam).not.toHaveBeenCalled();
    });

    // Suppression d'équipe
    it('should delete team and reload teams', () => {
        spyOn(window, 'confirm').and.returnValue(true);
        teamSpy.deletePokemonTeam.and.returnValue(of({}));

        component.supprimerEquipe(1);

        expect(teamSpy.deletePokemonTeam).toHaveBeenCalledWith(1);
    });

    // Pas de suppression si annulé
    it('should not delete team if confirm is cancelled', () => {
        spyOn(window, 'confirm').and.returnValue(false);
        component.supprimerEquipe(1);
        expect(teamSpy.deletePokemonTeam).not.toHaveBeenCalled();
    });

    // Toggle edit
    it('should toggle isEditing on team', () => {
        const team = { ...mockTeam, isEditing: false };
        component.toggleEdit(team);
        expect(team.isEditing).toBeTrue();
        component.toggleEdit(team);
        expect(team.isEditing).toBeFalse();
    });

    // Retirer un pokemon
    it('should remove pokemon from team and save', () => {
        teamSpy.updatePokemonTeam.and.returnValue(of(mockTeam));
        const team = { ...mockTeam, pokemons: [1, 2, 3], isEditing: true };

        component.retirerPokemon(team, 1);

        expect(team.pokemons).toEqual([1, 3]);
        expect(teamSpy.updatePokemonTeam).toHaveBeenCalledWith(team.id, [1, 3]);
    });

    // getImageUrl
    it('should return correct image url', () => {
        expect(component.getImageUrl(1)).toContain('/1.png');
    });

    // naviguer
    it('should navigate to given route', () => {
        spyOn(router, 'navigate');
        component.naviguer('/home');
        expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });
});