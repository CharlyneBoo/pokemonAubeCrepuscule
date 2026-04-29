import { Component, OnDestroy, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Auth, UserOut } from '../../services/auth';
import { PokemonTeamService } from '../../services/pokemon_team.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit, OnDestroy {
  readonly HOME_CHAT_ROOM = 'home_global';
  isEditing = false;
  isAvatarModalOpen = false;

  user: any = {
    id: '',
    pseudo: 'Chargement...',
    team_color: 'red',
    score: 0,
    avatar: '/avatar/gobou.jpeg',
    is_admin: false
  };

  availableAvatars: string[] = [
    '/avatar/carapuce.jpeg',
    '/avatar/dracaufeu.jpeg',
    '/avatar/evoli.jpeg',
    '/avatar/gobou.jpeg',
    '/avatar/metamorph.jpeg',
    '/avatar/pika.jpeg',
    '/avatar/psyko.jpeg'
  ];

  selected_game_mode: string = "hasard";
  equipe_selectionnee: any = null;

  show_team_modal: boolean = false;
  mes_equipes: any[] = [];
  show_history_modal: boolean = false;
  match_history: any[] = [];
  is_loading_history: boolean = false;
  show_admin_modal: boolean = false;
  system_logs: any[] = [];
  is_loading_logs: boolean = false;
  home_chat_messages: Array<{ user: string; text: string; is_self: boolean }> = [];
  home_chat_input: string = '';
  home_chat_socket: WebSocket | null = null;
  user_profiles: UserOut[] = [];
  selected_chat_profile: { pseudo: string; avatar_url?: string; aura?: number } | null = null;

  constructor(
    private router: Router,
    private auth: Auth,
    private teamService: PokemonTeamService,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit() {
    this.chargerProfil();
  }

  ngOnDestroy() {
    this.home_chat_socket?.close();
  }

  async chargerProfil() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const data: any = await this.auth.getMe();
        
        this.user = {
          id: data.id,
          pseudo: data.pseudo,
          team_color: data.team_color || 'red',
          score: data.aura || 0,
          is_admin: data.is_admin === true, 
          avatar: data.avatar_url || '/avatar/gobou.jpeg'
        };

        this.charger_mes_equipes();
        await this.charger_user_profiles();
        this.connect_home_chat();
      } catch (err) {
        console.error("Erreur d'authentification ou non connecté :", err);
        this.auth.logout();
        this.router.navigate(['/login']);
      }
      
    }
  }

  async charger_user_profiles() {
    try {
      this.user_profiles = await this.auth.getUsers();
    } catch (error) {
      console.error("Erreur chargement profils utilisateurs :", error);
      this.user_profiles = [];
    }
  }

  charger_mes_equipes() {
    if (this.user.id) {
      this.teamService.getPokemonTeams(this.user.id).subscribe({
        next: (data) => this.mes_equipes = data || [],
        error: (err) => console.error("Erreur chargement équipes :", err)
      });
    }
  }

  ouvrir_choix_equipe() {
    this.show_team_modal = true;
  }

  choisir_equipe(equipe: any) {
    if (!equipe.pokemons || equipe.pokemons.length !== 6) {
      alert("Cette équipe n'est pas complète (6 Pokémon requis) !");
      return;
    }
    this.equipe_selectionnee = equipe;
    this.show_team_modal = false;
  }

  async toggleEdit() {
    if (this.isEditing) {
      await this.sauvegarderProfil();
    }
    this.isEditing = !this.isEditing;
  }

  async sauvegarderProfil() {
    try {
      await this.auth.updateProfile({
        pseudo: this.user.pseudo,
        team_color: this.user.team_color,
        avatar_url: this.user.avatar
      });
      console.log("Profil mis à jour !");
    } catch (err) {
      console.error("Erreur lors de la sauvegarde :", err);
    }
  }

  changeColor() {
    this.user.team_color = this.user.team_color === 'red' ? 'blue' : 'red';
  }

  openAvatarModal() {
    if (this.isEditing) {
      this.isAvatarModalOpen = true;
    }
  }

  selectAvatar(newAvatar: string) {
    this.user.avatar = newAvatar;
    this.isAvatarModalOpen = false;
  }

  choisir_mode(mode: string) {
    this.selected_game_mode = mode;
  }

  lancer_partie() {
    if (this.selected_game_mode === 'construit') {
      if (!this.equipe_selectionnee) return;

      const ids = this.equipe_selectionnee.pokemons.join(',');
      this.router.navigate(['/duel'], { queryParams: { mode: 'construit', team: ids } });
    } else {
      this.router.navigate(['/duel'], { queryParams: { mode: this.selected_game_mode } });
    }
  }

  naviguer(route: string) {
    this.router.navigate([route]);
  }

  async ouvrir_historique() {
    this.show_history_modal = true;
    this.is_loading_history = true;

    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    try {
      const url = `http://localhost:8004/history/${this.user.pseudo}`; 
      
      const response: any = await firstValueFrom(this.http.get(url));
      this.match_history = response;
    } catch (error) {
      console.error("Erreur lors de la récupération de l'historique", error);
    } finally {
      this.is_loading_history = false;
    }
  }

  a_gagne_le_match(match: any): boolean {
    return match.winner_id === this.user?.pseudo;
  }
  async ouvrir_console_admin() {
    this.show_admin_modal = true;
    this.is_loading_logs = true;

    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    try {
      const response: any = await firstValueFrom(
        this.http.get('http://localhost:8006/admin/logs', { headers })
      );
      this.system_logs = response;
    } catch (error) {
      console.error("Erreur de récupération des logs", error);
    } finally {
      this.is_loading_logs = false;
    }
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    this.user = null;
    this.router.navigate(['/login']);
  }

  connect_home_chat() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.home_chat_socket?.close();
    this.home_chat_socket = new WebSocket(`ws://localhost:8007/ws/chat/${this.HOME_CHAT_ROOM}`);

    this.home_chat_socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.kind === 'chat_history' && Array.isArray(data.entries)) {
        this.home_chat_messages = data.entries
          .filter((entry: any) => entry.channel === 'chat')
          .map((entry: any) => ({
            user: entry.user,
            text: entry.text,
            is_self: entry.user === this.user.pseudo,
          }));
        this.scroll_home_chat();
        return;
      }

      if (data.kind === 'chat_message' && data.entry) {
        this.home_chat_messages.push({
          user: data.entry.user,
          text: data.entry.text,
          is_self: data.entry.user === this.user.pseudo,
        });
        this.scroll_home_chat();
      }
    };
  }

  send_home_chat_message() {
    const message = this.home_chat_input.trim();
    if (!message || !this.home_chat_socket || this.home_chat_socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.home_chat_socket.send(JSON.stringify({
      kind: 'player_message',
      player: this.user.team_color,
      pseudo: this.user.pseudo || 'Joueur',
      message,
    }));
    this.home_chat_input = '';
  }

  openChatProfile(pseudo: string) {
    const profile = this.user_profiles.find((user) => user.pseudo === pseudo);
    this.selected_chat_profile = {
      pseudo,
      avatar_url: profile?.avatar_url || '/avatar/gobou.jpeg',
      aura: profile?.aura ?? 0,
    };
  }

  closeChatProfile() {
    this.selected_chat_profile = null;
  }

  private scroll_home_chat() {
    setTimeout(() => {
      const container = document.querySelector('.home-chat-messages');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 50);
  }
}
