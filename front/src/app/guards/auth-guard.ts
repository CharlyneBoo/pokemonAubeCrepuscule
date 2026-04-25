import { inject, PLATFORM_ID } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { Auth } from '../services/auth';

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  // On vérifie si on est sur le navigateur 
  if (isPlatformBrowser(platformId)) {
    
    if (auth.isLoggedIn()) {
      return true;
    } else {
      return router.parseUrl('/login');
    }
    
  }
  return true;
};