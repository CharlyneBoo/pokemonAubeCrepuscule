import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Auth, UserOut } from '../../services/auth';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-duel',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './duel.component.html',
  styleUrls: ['./duel.component.css']
})
export class DuelComponent implements OnInit, OnDestroy {
  readonly BOT_NAME = 'Pablob';

  //ÉTAT DU JEU 
  current_phase: 'waiting' | 'draft' | 'battle' = 'waiting';
  game_mode: string = 'hasard';
  match_id: string = '';
  is_game_over: boolean = false;
  is_waiting_for_opponent: boolean = true;
  current_turn: number = 1;
  showLeaveWarning: boolean = false;
  showForfeitConfirm: boolean = false;
  has_played: boolean = false;
  forfeits_received: string[] = [];
  user: any = null;
  team_color: string = 'red';
  opponent_pseudo: string = 'Adversaire';
  my_team_ids: number[] = [];
  my_team: any[] = [];
  opponent_team: any[] = [];

  active_red: any = null;
  active_blue: any = null;
  my_pending_switch: any = null;

  //Autres
  draft_pool: any[] = [];
  draft_turn: string = '';

  timer_left: number = 90;
  timer_interval: any;

  message_list: any[] = [];
  chat_messages: any[] = [];
  active_chat_tab: 'journal' | 'chat' = 'journal';
  chat_input: string = '';
  match_result: 'win' | 'loss' | 'draw' | null = null;
  winner_name: string = '';
  user_profiles: UserOut[] = [];
  selected_chat_profile: { pseudo: string; avatar_url?: string; aura?: number; team_color?: string } | null = null;

  socket: WebSocket | null = null;
  chat_socket: WebSocket | null = null;
  private journal_message_keys = new Set<string>();

  constructor(
    private http: HttpClient, private auth: Auth,
    private route: ActivatedRoute, @Inject(PLATFORM_ID) private platform_id: Object
  ) { }

  async ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['mode']) this.game_mode = params['mode'];
      if (params['team']) this.my_team_ids = params['team'].split(',').map(Number);
      this.match_id = 'match_' + this.game_mode;
    });

    if (isPlatformBrowser(this.platform_id)) {
      try {
        this.user = await this.auth.getMe();
        await this.load_user_profiles();
        if (this.user.team_color === 'rouge') this.team_color = 'red';
        else if (this.user.team_color === 'bleu') this.team_color = 'blue';
        else this.team_color = this.user.team_color;
      } catch (err) { console.error("Non connecté."); }
      this.connect_to_websocket();
      this.connect_to_chat_socket();
    }
  }

  async load_user_profiles() {
    try {
      this.user_profiles = await this.auth.getUsers();
    } catch (error) {
      console.error('Erreur chargement profils utilisateurs :', error);
      this.user_profiles = [];
    }
  }

  ngOnDestroy() {
    if (this.timer_interval) clearInterval(this.timer_interval);
    if (this.socket) {
      this.socket.onmessage = null;
      this.socket.close();
    }
    if (this.chat_socket) {
      this.chat_socket.onmessage = null;
      this.chat_socket.close();
    }
  }

  action_draft_pick(pokemon_id: number) {
    if (this.draft_turn !== this.team_color) return;
    this.socket?.send(JSON.stringify({
      kind: 'draft_pick', player: this.team_color, pokemon_id: pokemon_id
    }));
  }

  get_my_active_pokemon() { return this.team_color === 'red' ? this.active_red : this.active_blue; }
  get_opp_active_pokemon() { return this.team_color === 'red' ? this.active_blue : this.active_red; }

  action_stay() {
    if (this.is_game_over || this.has_played) return;
    this.send_action_to_backend('stay', null);
  }

  action_switch(pokemon: any) {
    if (this.is_game_over || pokemon.is_ko || pokemon === this.get_my_active_pokemon() || this.has_played) return;
    this.my_pending_switch = pokemon;
    this.send_action_to_backend('switch', pokemon);
  }

  action_forfeit() {
    this.showForfeitConfirm = true;
  }

  execute_forfeit() {
    this.showForfeitConfirm = false;
    this.socket?.send(JSON.stringify({
      kind: 'forfeit',
      player: this.team_color
    }));
  }

  send_action_to_backend(action_type: string, target_pokemon: any) {
    let pokemon_combattant = action_type === 'stay' ? this.get_my_active_pokemon() : target_pokemon;
    if (!pokemon_combattant) return;

    this.has_played = true;

    const payload = {
      match_id: this.match_id, turn: this.current_turn, team: this.team_color, action: action_type,
      target: target_pokemon ? target_pokemon.id : null,
      pokemon_actif: { name: pokemon_combattant.name, types: pokemon_combattant.types }
    };

    this.http.post('http://localhost:8005/battle/action', payload).subscribe();
  }

  connect_to_websocket() {
    this.socket = new WebSocket(`ws://localhost:8005/ws/battle/${this.match_id}/${this.game_mode}`);

    this.socket.onopen = () => {
      this.socket?.send(JSON.stringify({
        kind: 'hello',
        player: this.team_color,
        pseudo: this.user?.pseudo || 'Joueur'
      }));

      if (this.game_mode === 'construit' && this.my_team_ids.length > 0) {
        this.socket?.send(JSON.stringify({
          kind: 'join_construit',
          player: this.team_color,
          team_ids: this.my_team_ids
        }));
      }
    };

    this.socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.kind === 'opponent_info' && data.player !== this.team_color) {
        this.opponent_pseudo = data.pseudo;
      }

      if (data.kind === 'forfeit_notice') {

        if (this.has_played) {
          this.is_game_over = true;
          clearInterval(this.timer_interval);
          this.match_result = 'win';
          this.winner_name = this.user?.pseudo || 'Vous';
          this.update_aura('win');
          this.add_bot_message("L'adversaire n'a pas joué à temps. Victoire !");
          return;
        }

        if (!this.has_played && this.timer_left <= 2) {
          this.forfeits_received.push(data.loser);

          setTimeout(() => {
            if (this.is_game_over) return;

            this.is_game_over = true;
            clearInterval(this.timer_interval);

            if (this.forfeits_received.includes('red') && this.forfeits_received.includes('blue')) {
              this.match_result = 'draw';
              this.add_bot_message("Temps écoulé pour les deux joueurs ! Égalité parfaite.");
            }
            else {
              this.match_result = 'loss';
              this.winner_name = this.opponent_pseudo;
              this.update_aura('loss');
              this.add_bot_message("Vous n'avez pas joué à temps. Défaite.");
            }
          }, 500);
          return;
        }

        // 3. Abandon manuel au clic (quand le chrono tourne normalement)
        this.is_game_over = true;
        clearInterval(this.timer_interval);
        if (data.loser === this.team_color) {
          this.match_result = 'loss';
          this.winner_name = this.opponent_pseudo;
          this.update_aura('loss');
        } else {
          this.match_result = 'win';
          this.winner_name = this.user?.pseudo || 'Vous';
          this.update_aura('win');
        }
        return;
      }

      if (data.kind === 'draft_update') {
        this.current_phase = 'draft';
        this.is_waiting_for_opponent = false;
        this.draft_turn = data.turn;
        this.add_bot_message(data.message);
        await this.sync_draft_ui(data);
      }

      if (data.kind === 'match_start') {
        this.current_phase = 'battle';
        this.is_waiting_for_opponent = false;
        this.chat_messages = [];
        await this.build_battle_teams(data);
        this.start_timer();
        this.add_bot_message(data.message);
      }

      if (data.kind === 'turn_result') {
        this.has_played = false;

        if (this.my_pending_switch) {
          if (this.team_color === 'red') this.active_red = this.my_pending_switch;
          else this.active_blue = this.my_pending_switch;
          this.my_pending_switch.is_revealed = true;
          this.my_pending_switch = null;
        }

        let opp_color = this.team_color === 'red' ? 'blue' : 'red';
        let opp_data = data[opp_color];
        if (opp_data && opp_data.choice === 'switch' && opp_data.switch_to) {
          let opp_p = this.opponent_team.find((p: any) => p.id === opp_data.switch_to);
          if (opp_p) {
            if (opp_color === 'red') this.active_red = opp_p;
            else this.active_blue = opp_p;
            opp_p.is_revealed = true;
          }
        }

        setTimeout(() => {
          if (data.duel_result) {
            let vainqueur = data.duel_result.winner;

            if (vainqueur === 'red' && this.active_blue) { this.active_blue.is_ko = true; this.active_blue = null; }
            else if (vainqueur === 'blue' && this.active_red) { this.active_red.is_ko = true; this.active_red = null; }
            else if (vainqueur === 'both') {
              if (this.active_red) this.active_red.is_ko = true;
              if (this.active_blue) this.active_blue.is_ko = true;
              this.active_red = null; this.active_blue = null;
            }
            this.verifier_fin_de_match();
          }

          if (!this.is_game_over) {
            this.timer_left = 90;
            this.current_turn++;
          }
        }, 2000);
      }
    };
  }

  connect_to_chat_socket() {
    this.chat_socket = new WebSocket(`ws://localhost:8007/ws/chat/${this.match_id}`);

    this.chat_socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.kind === 'chat_history' && Array.isArray(data.entries)) {
        this.message_list = [];
        this.journal_message_keys.clear();
        this.chat_messages = data.entries
          .filter((entry: any) => entry.channel === 'chat')
          .map((entry: any) => ({
            user: entry.user,
            text: entry.text,
            is_self: entry.player === this.team_color,
          }));
        this.scroll_chat_panel('journal');
        this.scroll_chat_panel('chat');
        return;
      }

      if (data.kind === 'chat_cleared') {
        this.chat_messages = [];
        this.scroll_chat_panel('chat');
        return;
      }

      if (data.kind === 'journal_message' && data.entry) {
        this.add_journal_message(data.entry.user || this.BOT_NAME, data.entry.text, true);
        return;
      }

      if (data.kind === 'chat_message' && data.entry) {
        this.chat_messages.push({
          user: data.entry.user,
          text: data.entry.text,
          is_self: data.entry.player === this.team_color,
        });
        this.scroll_chat_panel('chat');
      }
    };
  }

  async sync_draft_ui(data: any) {
    this.draft_pool = []; this.my_team = []; this.opponent_team = [];
    for (let id of data.pool) {
      let p = await this.fetch_pokemon_by_id(id);
      if (p) this.draft_pool.push(p);
    }
    let my_ids = this.team_color === 'red' ? data.red_team : data.blue_team;
    let opp_ids = this.team_color === 'red' ? data.blue_team : data.red_team;

    for (let id of my_ids) {
      let p = await this.fetch_pokemon_by_id(id);
      if (p) this.my_team.push(p);
    }
    for (let id of opp_ids) {
      let p = await this.fetch_pokemon_by_id(id);
      if (p) { p.is_revealed = true; this.opponent_team.push(p); }
    }
  }

  async build_battle_teams(data: any) {
    this.my_team = [];
    this.opponent_team = [];
    let my_ids = this.team_color === 'red' ? data.red_team_ids : data.blue_team_ids;
    let opp_ids = this.team_color === 'red' ? data.blue_team_ids : data.red_team_ids;
    let my_idx = this.team_color === 'red' ? data.red_active_index : data.blue_active_index;
    let opp_idx = this.team_color === 'red' ? data.blue_active_index : data.red_active_index;

    for (let i = 0; i < my_ids.length; i++) {
      let pkmn = await this.fetch_pokemon_by_id(my_ids[i]);
      if (pkmn) {
        pkmn.is_revealed = true;
        this.my_team.push(pkmn);
      }
    }

    for (let i = 0; i < opp_ids.length; i++) {
      let pkmn = await this.fetch_pokemon_by_id(opp_ids[i]);
      if (pkmn) {
        pkmn.is_revealed = (this.game_mode !== 'hasard' || i === opp_idx);
        this.opponent_team.push(pkmn);
      }
    }

    this.active_red = this.team_color === 'red' ? this.my_team[my_idx] : this.opponent_team[opp_idx];
    this.active_blue = this.team_color === 'blue' ? this.my_team[my_idx] : this.opponent_team[opp_idx];
  }

  start_timer() {
    this.timer_left = 90;
    this.timer_interval = setInterval(() => {
      if (this.timer_left > 0 && !this.is_game_over) this.timer_left--;
      else if (this.timer_left === 0 && !this.is_game_over) this.on_time_out();
    }, 1000);
  }

  on_time_out() {
    clearInterval(this.timer_interval);

    // Si le chronomètre arrive à 0 et que je n'ai pas joué, je déclare forfait pour inactivité
    if (!this.has_played) {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({
          kind: 'forfeit',
          player: this.team_color
        }));
      }
    }
  }

  verifier_fin_de_match() {
    const my_alive = this.my_team.filter(p => !p.is_ko).length;
    const opp_alive = this.opponent_team.filter(p => !p.is_ko).length;

    if (my_alive === 0 || opp_alive === 0) {
      this.is_game_over = true;
      clearInterval(this.timer_interval);

      let final_winner = 'draw';

      if (my_alive === 0 && opp_alive === 0) {
        this.match_result = 'draw';
        final_winner = 'draw';
      }
      else if (my_alive === 0) {
        this.match_result = 'loss';
        final_winner = this.team_color === 'red' ? 'blue' : 'red';
        this.winner_name = this.opponent_pseudo || "L'adversaire";
      }
      else {
        this.match_result = 'win';
        final_winner = this.team_color;
        this.winner_name = this.user?.pseudo || 'Vous';
      }

      if (this.match_result === 'win' || (this.match_result === 'draw' && this.team_color === 'red')) {
        console.log("🔴 [DEBUG] Envoi du signal match_over au backend ! Gagnant :", final_winner);
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({
            kind: 'match_over',
            winner_color: final_winner
          }));
        } else {
          console.error("🔴 [DEBUG] Erreur : Le WebSocket est fermé !");
        }
      }

      if (this.match_result === 'loss') {
        this.update_aura('loss');
      } else if (this.match_result === 'win') {
        this.update_aura('win');
      }
    }
  }

  update_aura(result: 'win' | 'loss') {
    const url = 'http://localhost:8000/users/me/aura';
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.patch(url, { result: result }, { headers }).subscribe({
      next: (res: any) => console.log("Aura mise à jour avec succès :", res.nouvelle_aura),
      error: (err) => console.error("Erreur lors de la mise à jour de l'Aura", err)
    });
  }

  async fetch_pokemon_by_id(id: number) {
    try {
      const data: any = await firstValueFrom(this.http.get(`http://localhost:8002/dex/${id}`));
      return { id: data.id, name: data.nom, types: data.types, icon_url: data.image, sprite_url: data.image, is_ko: false, is_revealed: false };
    } catch (e) { return null; }
  }

  add_bot_message(texte: string) {
    this.add_journal_message(this.BOT_NAME, texte, true);
  }

  add_journal_message(user: string, text: string, is_bot: boolean = false) {
    const key = `${user}:${text}`;
    if (is_bot && this.journal_message_keys.has(key)) return;
    this.journal_message_keys.add(key);
    this.message_list.push({ user, text, is_bot });
    this.scroll_chat_panel('journal');
  }

  send_chat_message() {
    const message = this.chat_input.trim();
    if (!message || !this.chat_socket || this.chat_socket.readyState !== WebSocket.OPEN) return;

    this.chat_socket.send(JSON.stringify({
      kind: 'player_message',
      player: this.team_color,
      pseudo: this.user?.pseudo || 'Joueur',
      message,
    }));
    this.chat_input = '';
  }

  openChatProfile(pseudo: string) {
    if (!this.canOpenChatProfile(pseudo)) return;

    const profile = this.user_profiles.find((user) => user.pseudo === pseudo);
    const is_current_user = this.user?.pseudo === pseudo;
    this.selected_chat_profile = {
      pseudo,
      avatar_url: profile?.avatar_url || (is_current_user ? this.user?.avatar_url : undefined) || '/avatar/gobou.jpeg',
      aura: profile?.aura ?? (is_current_user ? this.user?.aura : 0) ?? 0,
      team_color: this.normalizeTeamColor(profile?.team_color || (is_current_user ? this.user?.team_color : undefined)),
    };
  }

  closeChatProfile() {
    this.selected_chat_profile = null;
  }

  canOpenChatProfile(pseudo: string): boolean {
    return !!pseudo && pseudo !== this.BOT_NAME;
  }

  getProfileBorderClass(team_color?: string): string {
    return this.normalizeTeamColor(team_color) === 'blue'
      ? 'border-[#6a4cef]'
      : this.normalizeTeamColor(team_color) === 'red'
        ? 'border-[#db5151]'
        : 'border-[#311b5e]';
  }

  getProfileAvatarBorderClass(team_color?: string): string {
    return this.normalizeTeamColor(team_color) === 'blue'
      ? 'border-blue-200'
      : this.normalizeTeamColor(team_color) === 'red'
        ? 'border-red-200'
        : 'border-pink-200';
  }

  private normalizeTeamColor(team_color?: string): string {
    if (team_color === 'bleu') return 'blue';
    if (team_color === 'rouge') return 'red';
    return team_color || '';
  }

  select_chat_tab(tab: 'journal' | 'chat') {
    this.active_chat_tab = tab;
    this.scroll_chat_panel(tab);
  }

  private scroll_chat_panel(tab: 'journal' | 'chat') {
    setTimeout(() => {
      const selector = tab === 'journal' ? '.journal-messages' : '.player-chat-messages';
      const container = document.querySelector(selector);
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 50);
  }

  getTeamTextColor(pseudo: string): string {
    const profile = this.user_profiles.find((user: any) => user.pseudo === pseudo);
    const is_current_user = this.user?.pseudo === pseudo;

    const teamColor = this.normalizeTeamColor(
      profile?.team_color || (is_current_user ? this.user?.team_color : undefined)
    );

    if (teamColor === 'blue') return 'text-blue-600';
    if (teamColor === 'red') return 'text-red-600';

    return 'text-gray-800';
  }

}
