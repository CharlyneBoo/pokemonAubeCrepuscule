import { Routes } from '@angular/router';
import { DexComponent } from './pages/dex/dex.component'; // Importe ton composant

export const routes: Routes = [
  { path: 'dex', component: DexComponent },
  // Tu pourras ajouter tes autres pages ici plus tard (accueil, équipe, etc.)
];