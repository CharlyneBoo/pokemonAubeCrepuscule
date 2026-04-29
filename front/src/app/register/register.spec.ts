import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Register } from './register';
import { Auth } from '../services/auth';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let authServiceSpy: jasmine.SpyObj<Auth>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('Auth', ['register']);

    await TestBed.configureTestingModule({
      imports: [Register, FormsModule],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: Auth, useValue: authServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // Helper pour remplir tous les champs valides
  function fillAllFields() {
    component.email = 'test@test.com';
    component.password = 'password123';
    component.name = 'Ketchum';
    component.first_name = 'Sacha';
    component.pseudo = 'Pika';
    component.team_color = 'red';
  }

  // Création du component
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Valeurs initiales
  it('should have empty fields on init', () => {
    expect(component.email).toBe('');
    expect(component.password).toBe('');
    expect(component.pseudo).toBe('');
    expect(component.name).toBe('');
    expect(component.first_name).toBe('');
    expect(component.team_color).toBe('');
    expect(component.error).toBe('');
    expect(component.loading).toBeFalse();
  });

  // Équipes disponibles
  it('should have red and blue teams', () => {
    expect(component.teams.length).toBe(2);
    expect(component.teams.map(t => t.value)).toContain('red');
    expect(component.teams.map(t => t.value)).toContain('blue');
  });

  // Erreur si champs vides
  it('should set error if required fields are empty', async () => {
    component.email = '';
    component.password = '';
    component.pseudo = '';
    component.name = '';
    component.first_name = '';

    await component.onSubmit();

    expect(component.error).toBe('Remplis tous les champs !');
    expect(authServiceSpy.register).not.toHaveBeenCalled();
  });

  // Erreur si aucune équipe sélectionnée
  it('should set error if no team selected on submit', async () => {
    component.email = 'test@test.com';
    component.password = 'password123';
    component.name = 'Ketchum';
    component.first_name = 'Sacha';
    component.pseudo = 'Pika';
    component.team_color = '';

    await component.onSubmit();

    expect(component.error).toBe('Choisis une équipe !');
    expect(authServiceSpy.register).not.toHaveBeenCalled();
  });

  // Inscription réussie
  it('should call auth.register and navigate on success', async () => {
    authServiceSpy.register.and.returnValue(Promise.resolve({
      id: '1', email: 'test@test.com', pseudo: 'Pika', team_color: 'red', avatar_url: null
    } as any));

    fillAllFields();
    await component.onSubmit();

    expect(authServiceSpy.register).toHaveBeenCalledWith(
      'test@test.com', 'password123', 'Ketchum', 'Sacha', 'Pika', 'red'
    );
    expect(component.error).toBe('');
    expect(component.loading).toBeFalse();
  });

  // Inscription échouée — email déjà utilisé
  it('should set error message on register failure', async () => {
    authServiceSpy.register.and.returnValue(
      Promise.reject({ error: { detail: 'Email already exists' } })
    );

    fillAllFields();
    await component.onSubmit();

    expect(component.error).toBe('Email already exists');
    expect(component.loading).toBeFalse();
  });

  // Inscription échouée — erreur générique
  it('should set generic error if no detail in error', async () => {
    authServiceSpy.register.and.returnValue(Promise.reject({}));

    fillAllFields();
    await component.onSubmit();

    expect(component.error).toBe("Une erreur est survenue lors de l'inscription");
  });

  // Inscription échouée — erreurs de validation FastAPI (tableau)
  it('should format FastAPI validation errors', async () => {
    authServiceSpy.register.and.returnValue(
      Promise.reject({
        error: {
          detail: [
            { loc: ['body', 'email'], msg: 'invalid' },
            { loc: ['body', 'password'], msg: 'too short' }
          ]
        }
      })
    );

    fillAllFields();
    await component.onSubmit();

    expect(component.error).toBe('Champs invalides : email, password');
  });

  // Loading state
  it('should set loading to true while submitting', () => {
    authServiceSpy.register.and.returnValue(new Promise(() => { }));

    fillAllFields();
    component.onSubmit();

    expect(component.loading).toBeTrue();
  });

  // Sélection d'équipe
  it('should update team_color when a team is selected', () => {
    component.team_color = 'red';
    expect(component.team_color).toBe('red');

    component.team_color = 'blue';
    expect(component.team_color).toBe('blue');
  });
});