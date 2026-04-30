import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { of } from 'rxjs';
import { DuelComponent } from './duel.component';
import { Auth } from '../../services/auth';

const mockUser = { id: 'user-1', email: 'sacha@test.com', pseudo: 'Sacha', team_color: 'red', avatar_url: '' };

describe('DuelComponent', () => {
    let component: DuelComponent;
    let fixture: ComponentFixture<DuelComponent>;
    let authSpy: jasmine.SpyObj<Auth>;
    let httpMock: HttpTestingController;

    beforeEach(async () => {
        authSpy = jasmine.createSpyObj('Auth', ['getMe', 'logout']);
        authSpy.getMe.and.returnValue(Promise.resolve(mockUser));

        await TestBed.configureTestingModule({
            imports: [DuelComponent],
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: Auth, useValue: authSpy },
                { provide: PLATFORM_ID, useValue: 'server' }, // server = pas de WebSocket
                {
                    provide: ActivatedRoute,
                    useValue: { queryParams: of({ mode: 'hasard' }) }
                }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(DuelComponent);
        component = fixture.componentInstance;
        component.user = mockUser;
        component.team_color = 'red';
        fixture.detectChanges();

        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    // Création du component
    it('should create', () => {
        expect(component).toBeTruthy();
    });

    // Valeurs initiales
    it('should have default values on init', () => {
        expect(component.current_phase).toBe('waiting');
        expect(component.is_game_over).toBeFalse();
        expect(component.has_played).toBeFalse();
        expect(component.timer_left).toBe(90);
    });

    // get_my_active_pokemon — rouge
    it('should return active_red for red player', () => {
        component.team_color = 'red';
        component.active_red = { id: 1, name: 'Bulbizarre' };
        expect(component.get_my_active_pokemon()).toEqual({ id: 1, name: 'Bulbizarre' });
    });

    // get_opp_active_pokemon — rouge voit bleu
    it('should return active_blue as opponent for red player', () => {
        component.team_color = 'red';
        component.active_blue = { id: 4, name: 'Salamèche' };
        expect(component.get_opp_active_pokemon()).toEqual({ id: 4, name: 'Salamèche' });
    });

    // action_stay bloqué si has_played
    it('should not send stay action if already played', () => {
        component.has_played = true;
        spyOn(component as any, 'send_action_to_backend');
        component.action_stay();
        expect((component as any).send_action_to_backend).not.toHaveBeenCalled();
    });

    // action_switch bloqué si pokemon KO
    it('should not switch to a KO pokemon', () => {
        spyOn(component as any, 'send_action_to_backend');
        const koMon = { id: 2, name: 'Carapuce', is_ko: true };
        component.action_switch(koMon);
        expect((component as any).send_action_to_backend).not.toHaveBeenCalled();
    });

    // action_switch bloqué si déjà joué
    it('should not switch if already played', () => {
        component.has_played = true;
        spyOn(component as any, 'send_action_to_backend');
        const mon = { id: 2, name: 'Carapuce', is_ko: false };
        component.action_switch(mon);
        expect((component as any).send_action_to_backend).not.toHaveBeenCalled();
    });

    // action_forfeit ouvre la confirmation
    it('should show forfeit confirmation on action_forfeit', () => {
        component.action_forfeit();
        expect(component.showForfeitConfirm).toBeTrue();
    });

    // execute_forfeit ferme la confirmation
    it('should close forfeit confirm on execute_forfeit', () => {
        component.showForfeitConfirm = true;
        component.execute_forfeit();
        expect(component.showForfeitConfirm).toBeFalse();
    });

    // add_bot_message
    it('should add a bot message to message_list', () => {
        component.add_bot_message('Tour 1 commence !');
        expect(component.message_list.length).toBe(1);
        expect(component.message_list[0].text).toBe('Tour 1 commence !');
        expect(component.message_list[0].is_bot).toBeTrue();
    });

    // select_chat_tab
    it('should switch active chat tab', () => {
        component.select_chat_tab('chat');
        expect(component.active_chat_tab).toBe('chat');
        component.select_chat_tab('journal');
        expect(component.active_chat_tab).toBe('journal');
    });

    // verifier_fin_de_match — victoire
    it('should set match_result to win if opponent all KO', () => {
        component.my_team = [{ is_ko: false }, { is_ko: false }];
        component.opponent_team = [{ is_ko: true }, { is_ko: true }];
        component.verifier_fin_de_match();
        expect(component.match_result).toBe('win');
        expect(component.is_game_over).toBeTrue();
        httpMock.match(() => true); // absorbe les requêtes PATCH aura
    });

    // verifier_fin_de_match — défaite
    it('should set match_result to loss if my team all KO', () => {
        component.my_team = [{ is_ko: true }, { is_ko: true }];
        component.opponent_team = [{ is_ko: false }, { is_ko: false }];
        component.verifier_fin_de_match();
        expect(component.match_result).toBe('loss');
        expect(component.is_game_over).toBeTrue();
        httpMock.match(() => true);
    });

    // verifier_fin_de_match — égalité
    it('should set match_result to draw if both teams all KO', () => {
        component.my_team = [{ is_ko: true }];
        component.opponent_team = [{ is_ko: true }];
        component.verifier_fin_de_match();
        expect(component.match_result).toBe('draw');
        httpMock.match(() => true);
    });

    // start_timer démarre le chrono
    it('should start timer at 90', () => {
        component.start_timer();
        expect(component.timer_left).toBe(90);
        clearInterval(component.timer_interval);
    });

    // choisir mode draft
    it('should block draft pick if not my turn', () => {
        component.draft_turn = 'blue';
        component.team_color = 'red';
        component.socket = null;
        expect(() => component.action_draft_pick(1)).not.toThrow();
    });

});