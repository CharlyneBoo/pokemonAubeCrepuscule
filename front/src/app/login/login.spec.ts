import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Login } from './login';
import { Auth } from '../services/auth';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let authServiceSpy: jasmine.SpyObj<Auth>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['login']);

    await TestBed.configureTestingModule({
      imports: [Login, FormsModule],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: Auth, useValue: authServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // Création du component
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Valeurs initiales
  it('should have empty fields on init', () => {
    expect(component.email).toBe('');
    expect(component.password).toBe('');
    expect(component.error).toBe('');
    expect(component.loading).toBeFalse();
  });

  // Login réussi
  it('should call auth.login and navigate on success', async () => {
    authServiceSpy.login.and.returnValue(Promise.resolve());
    component.email = 'test@test.com';
    component.password = 'password123';

    await component.onSubmit();

    expect(authServiceSpy.login).toHaveBeenCalledWith('test@test.com', 'password123');
    expect(component.error).toBe('');
    expect(component.loading).toBeFalse();
  });

  // Login échoué — mauvais identifiants
  it('should set error message on login failure', async () => {
    authServiceSpy.login.and.returnValue(
      Promise.reject({ error: { detail: 'Identifiants invalides' } })
    );
    component.email = 'test@test.com';
    component.password = 'wrongpassword';

    await component.onSubmit();

    expect(component.error).toBe('Identifiants invalides');
    expect(component.loading).toBeFalse();
  });

  // Login échoué — erreur générique
  it('should set generic error message if no detail in error', async () => {
    authServiceSpy.login.and.returnValue(Promise.reject({}));
    component.email = 'test@test.com';
    component.password = 'wrongpassword';

    await component.onSubmit();

    expect(component.error).toBe('Identifiants invalides');
  });
});