import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth'; 
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-duel',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './duel.component.html',
  styleUrls: ['./duel.component.css']
})
export class DuelComponent implements OnInit, OnDestroy {
  my_team_color: string = 'red'; 
  match_id: string = 'match_123'; 
  game_mode: string = 'hasard'; 
  
  timer_left: number = 90;
  timer_interval: any;
  is_game_over: boolean = false;
  current_turn: number = 1;
  is_waiting_for_opponent: boolean = true;
  
  message_list: any[] = [];
  
  my_team: any[] = []; 
  opponent_team: any[] = []; 
  active_red: any = null;
  active_blue: any = null;

  my_pending_switch: any = null; 
  socket: WebSocket | null = null;

  constructor(
    private http: HttpClient,
    private auth: Auth,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platform_id: Object
  ) {}

  async ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['mode']) this.game_mode = params['mode'];
    });

    if (isPlatformBrowser(this.platform_id)) {
      try {
        const user = await this.auth.getMe();
        if (user.team_color === 'rouge') this.my_team_color = 'red';
        else if (user.team_color === 'bleu') this.my_team_color = 'blue';
        else this.my_team_color = user.team_color;
      } catch (err) {
        console.error("Non connecté.");
      }
      this.connect_to_websocket();
    }
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
    this.is_game_over = true;
    this.add_bot_message("Temps écoulé ! Le joueur inactif perd la partie.");
  }

  get_my_active_pokemon() {
    return this.my_team_color === 'red' ? this.active_red : this.active_blue;
  }

  get_opp_active_pokemon() {
    return this.my_team_color === 'red' ? this.active_blue : this.active_red;
  }

  action_stay() {
    if (this.is_game_over) return;
    this.send_action_to_backend('stay', null);
  }

  action_switch(pokemon: any) {
    if (this.is_game_over) return;
    if (pokemon.is_ko) return;
    if (pokemon === this.get_my_active_pokemon()) return; 
    
    this.my_pending_switch = pokemon; 
    this.send_action_to_backend('switch', pokemon);
  }

  action_forfeit() {
    if (confirm("Abandonner la partie ? (-10 points)")) {
      this.is_game_over = true;
      this.add_bot_message("Un joueur a déclaré forfait. Fin du match !");
      clearInterval(this.timer_interval);
    }
  }

  send_action_to_backend(action_type: string, target_pokemon: any) {
    let pokemon_combattant = action_type === 'stay' ? this.get_my_active_pokemon() : target_pokemon;

    if (!pokemon_combattant) {
      this.add_bot_message("Vous devez choisir un Pokémon remplaçant sur votre banc !");
      return;
    }

    const payload = {
      match_id: this.match_id,
      turn: this.current_turn,
      team: this.my_team_color,
      action: action_type,
      target: target_pokemon ? target_pokemon.id : null, 
      pokemon_actif: {
        name: pokemon_combattant.name,
        types: pokemon_combattant.types
      }
    };
    
    this.http.post('http://localhost:8005/battle/action', payload).subscribe({
      next: () => this.add_bot_message("Action envoyée. En attente de l'adversaire..."),
      error: (erreur) => console.error("Erreur d'envoi :", erreur)
    });
  }

  connect_to_websocket() {
    const ws_url = `ws://localhost:8005/ws/battle/${this.match_id}/${this.game_mode}`;
    this.socket = new WebSocket(ws_url);

    this.socket.onmessage = async (event) => {
      const data_recue = JSON.parse(event.data);
      
      if (data_recue.kind === 'match_start') {
        if (data_recue.mode === 'hasard') await this.build_hasard_teams(data_recue);
        this.is_waiting_for_opponent = false;
        this.start_timer();
        this.add_bot_message(data_recue.message);
      }

      if (data_recue.kind === 'turn_result') {
        
        console.log(" RESULTAT DU TOUR :", data_recue);

        if (this.my_pending_switch) {
          if (this.my_team_color === 'red') this.active_red = this.my_pending_switch;
          else this.active_blue = this.my_pending_switch;
          
          this.my_pending_switch.is_revealed = true;
          this.my_pending_switch = null;
        }

        let opp_color = this.my_team_color === 'red' ? 'blue' : 'red';
        let opp_data = data_recue[opp_color];
        
        if (opp_data && opp_data.choice === 'switch' && opp_data.switch_to) {
            // On cherche l'ID exact dans l'équipe adverse
            let opp_p = this.opponent_team.find(p => p.id === opp_data.switch_to);
            if (opp_p) {
               if (opp_color === 'red') this.active_red = opp_p;
               else this.active_blue = opp_p;
               opp_p.is_revealed = true; 
            }
        }

        this.add_bot_message(`Tour ${this.current_turn} : Analyse de l'arbitre...`);

        setTimeout(() => {
          
          if (data_recue.duel_result) {
            let vainqueur = data_recue.duel_result.winner;
            if (data_recue.message) this.add_bot_message(data_recue.message);

            if (vainqueur === 'red' && this.active_blue) {
              this.active_blue.is_ko = true;
              this.active_blue = null;
            } 
            else if (vainqueur === 'blue' && this.active_red) {
              this.active_red.is_ko = true;
              this.active_red = null;
            }
            else if (vainqueur === 'both') {
              if (this.active_red) this.active_red.is_ko = true;
              if (this.active_blue) this.active_blue.is_ko = true;
              this.active_red = null;
              this.active_blue = null;
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

  verifier_fin_de_match() {
    const my_team_alive = this.my_team.filter(p => !p.is_ko).length;
    const opp_team_alive = this.opponent_team.filter(p => !p.is_ko).length;

    if (my_team_alive === 0 || opp_team_alive === 0) {
      this.is_game_over = true;
      clearInterval(this.timer_interval);
      
      if (my_team_alive === 0 && opp_team_alive === 0) {
        this.add_bot_message("🏆 MATCH TERMINÉ : Égalité parfaite, plus aucun Pokémon debout !");
      } else if (my_team_alive === 0) {
        this.add_bot_message("❌ MATCH TERMINÉ : Vous avez perdu...");
      } else {
        this.add_bot_message("🎉 MATCH TERMINÉ : FÉLICITATIONS, VOUS AVEZ GAGNÉ !");
      }
    }
  }

  async build_hasard_teams(data_recue: any) {
    this.my_team = [];
    this.opponent_team = [];

    let my_ids = this.my_team_color === 'red' ? data_recue.red_team_ids : data_recue.blue_team_ids;
    let opp_ids = this.my_team_color === 'red' ? data_recue.blue_team_ids : data_recue.red_team_ids;
    let my_active_idx = this.my_team_color === 'red' ? data_recue.red_active_index : data_recue.blue_active_index;
    let opp_active_idx = this.my_team_color === 'red' ? data_recue.blue_active_index : data_recue.red_active_index;

    for (let i = 0; i < my_ids.length; i++) {
      let pkmn = await this.fetch_pokemon_by_id(my_ids[i]);
      if (pkmn) {
        pkmn.is_revealed = (i === my_active_idx); 
        this.my_team.push(pkmn);
      }
    }

    for (let i = 0; i < opp_ids.length; i++) {
      let pkmn = await this.fetch_pokemon_by_id(opp_ids[i]);
      if (pkmn) {
        pkmn.is_revealed = (i === opp_active_idx); 
        this.opponent_team.push(pkmn);
      }
    }

    this.active_red = this.my_team_color === 'red' ? this.my_team[my_active_idx] : this.opponent_team[opp_active_idx];
    this.active_blue = this.my_team_color === 'blue' ? this.my_team[my_active_idx] : this.opponent_team[opp_active_idx];
  }

  async fetch_pokemon_by_id(id: number) {
    const url = `http://localhost:8002/dex/${id}`;
    try {
      const data: any = await firstValueFrom(this.http.get(url));
      return {
        id: data.id,
        name: data.nom, 
        types: data.types, 
        icon_url: data.image, 
        sprite_url: data.image,
        is_ko: false,       
        is_revealed: false  
      };
    } catch (erreur) {
      console.error(`Erreur API Pokémon pour l'ID ${id}`, erreur);
      return null;
    }
  }

  add_bot_message(texte: string) {
    this.message_list.push({ user: 'Pablob (Arbitre)', text: texte, is_bot: true });
    setTimeout(() => {
      const chatElement = document.querySelector('.chat-area');
      if (chatElement) chatElement.scrollTop = chatElement.scrollHeight;
    }, 50);
  }

  ngOnDestroy() {
    if (this.timer_interval) clearInterval(this.timer_interval);
    if (this.socket) this.socket.close();
  }
  retournerMenu() {
  window.location.href = '/home';
}
}