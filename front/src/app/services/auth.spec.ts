import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Auth } from './auth';

const API = 'http://localhost:8000';

describe('Auth', () => {
  let service: Auth;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        Auth,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(Auth);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify(); // vérifie qu'il n'y a pas de requêtes non gérées
    localStorage.clear();
  });

  // Création du service
  it('should be created', () => {
    expect(service).toBeTruthy();
  });


  // getToken
  describe('getToken()', () => {
    it('should return null if no token', () => {
      expect(service.getToken()).toBeNull();
    });

    it('should return token from localStorage', () => {
      localStorage.setItem('token', 'my-token');
      expect(service.getToken()).toBe('my-token');
    });
  });

  // isLoggedIn
  describe('isLoggedIn()', () => {
    it('should return false if no token', () => {
      expect(service.isLoggedIn()).toBeFalse();
    });

    it('should return true if token exists', () => {
      localStorage.setItem('token', 'my-token');
      expect(service.isLoggedIn()).toBeTrue();
    });
  });

  // logout
  describe('logout()', () => {
    it('should remove token from localStorage', () => {
      localStorage.setItem('token', 'my-token');
      service.logout();
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('should make isLoggedIn return false after logout', () => {
      localStorage.setItem('token', 'my-token');
      service.logout();
      expect(service.isLoggedIn()).toBeFalse();
    });
  });
});