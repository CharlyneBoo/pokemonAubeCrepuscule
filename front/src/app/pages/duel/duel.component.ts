import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-duel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './duel.component.html',
  styleUrls: ['./duel.component.css']
})
export class DuelComponent implements OnInit, OnDestroy {
  myTeamColor: string = 'red'; // recup depuis auth
  timer: number = 90;
  timerInterval: any;
  messages: any[] = [];
  isGameOver: boolean = false;

  myTeam: any[] = []; // teams
  opponentTeam: any[] = []; // teams
  activeRed: any;
  activeBlue: any;

  ngOnInit() {
    this.startTimer();
    // equipes ?
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      if (this.timer > 0) this.timer--;
      else this.onTimeOut();
    }, 1000);
  }

  stay() {
    console.log("Action: STAY envoyée au Battle Engine");
    // kafka ?
  }

  switchPokemon(p: any) {
    if (p.isKO) return;
    console.log("Action: SWITCH envoyée pour", p.name);
  }

  confirmForfeit() {
    if (confirm("Abandonner la partie ? (-10 points)")) {
      console.log("FORFAIT");
    }
  }

  onTimeOut() {
    clearInterval(this.timerInterval);
    alert("Temps écoulé !");
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }
}