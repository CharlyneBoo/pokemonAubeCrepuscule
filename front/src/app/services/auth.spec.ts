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

  // register
  describe('register()', () => {
    it('should POST to /register and return UserOut', async () => {
      const mockUser = { id: '1', email: 'test@test.com', pseudo: 'Pika', team_color: 'red', avatar_url: '' };

      const promise = service.register('test@test.com', 'pass123', 'Ketchum', 'Sacha', 'Pika', 'red');

      const req = httpMock.expectOne(`${API}/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        email: 'test@test.com',
        password: 'pass123',
        name: 'Ketchum',
        first_name: 'Sacha',
        pseudo: 'Pika',
        team_color: 'red'
      });
      req.flush(mockUser);

      const result = await promise;
      expect(result).toEqual(mockUser);
    });

    it('should throw on register error', async () => {
      const promise = service.register('bad@test.com', 'pass', '', '', '', 'red');

      const req = httpMock.expectOne(`${API}/register`);
      req.flush({ detail: 'Email already exists' }, { status: 400, statusText: 'Bad Request' });

      await expectAsync(promise).toBeRejected();
    });
  });

  // login
  describe('login()', () => {
    it('should POST to /login and store token in localStorage', async () => {
      const mockToken = { access_token: 'fake-jwt-token', token_type: 'bearer' };

      const promise = service.login('test@test.com', 'pass123');

      const req = httpMock.expectOne(`${API}/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'test@test.com', password: 'pass123' });
      req.flush(mockToken);

      await promise;
      expect(localStorage.getItem('token')).toBe('fake-jwt-token');
    });

    it('should throw on login error', async () => {
      const promise = service.login('wrong@test.com', 'wrongpass');

      const req = httpMock.expectOne(`${API}/login`);
      req.flush({ detail: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

      await expectAsync(promise).toBeRejected();
    });
  });

  // getMe
  describe('getMe()', () => {
    it('should GET /me with Authorization header', async () => {
      localStorage.setItem('token', 'fake-jwt-token');
      const mockUser = { id: '1', email: 'test@test.com', pseudo: 'Pika', team_color: 'red', avatar_url: '' };

      const promise = service.getMe();

      const req = httpMock.expectOne(`${API}/me`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer fake-jwt-token');
      req.flush(mockUser);

      const result = await promise;
      expect(result).toEqual(mockUser);
    });

    it('should throw on unauthorized getMe', async () => {
      localStorage.setItem('token', 'expired-token');

      const promise = service.getMe();

      const req = httpMock.expectOne(`${API}/me`);
      req.flush({ detail: 'Invalid token' }, { status: 401, statusText: 'Unauthorized' });

      await expectAsync(promise).toBeRejected();
    });
  });

  // updateProfile
  describe('updateProfile()', () => {
    it('should PATCH /update_profile with Authorization header', async () => {
      localStorage.setItem('token', 'fake-jwt-token');
      const mockUser = { id: '1', email: 'test@test.com', pseudo: 'NewPseudo', team_color: 'blue', avatar_url: 'http://img.png' };

      const promise = service.updateProfile({ pseudo: 'NewPseudo', team_color: 'blue', avatar_url: 'http://img.png' });

      const req = httpMock.expectOne(`${API}/update_profile`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.headers.get('Authorization')).toBe('Bearer fake-jwt-token');
      expect(req.request.body).toEqual({ pseudo: 'NewPseudo', team_color: 'blue', avatar_url: 'http://img.png' });
      req.flush(mockUser);

      const result = await promise;
      expect(result).toEqual(mockUser);
    });

    it('should send only provided fields in updateProfile', async () => {
      localStorage.setItem('token', 'fake-jwt-token');

      const promise = service.updateProfile({ pseudo: 'OnlyPseudo' });

      const req = httpMock.expectOne(`${API}/update_profile`);
      expect(req.request.body).toEqual({ pseudo: 'OnlyPseudo' });
      req.flush({ id: '1', email: 'test@test.com', pseudo: 'OnlyPseudo', team_color: 'red', avatar_url: '' });

      await promise;
    });
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