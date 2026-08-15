import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'inicio',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/inicio/inicio.component').then((m) => m.InicioComponent),
  },
  {
    path: 'programacion',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/programacion/programacion.component').then((m) => m.ProgramacionComponent),
  },
  {
    path: 'videoteca',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/videoteca/videoteca.component').then((m) => m.VideotecaComponent),
  },
  {
    path: 'galeria',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/galeria/galeria.component').then((m) => m.GaleriaComponent),
  },
  {
    path: 'usuarios',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/usuarios/usuarios.component').then((m) => m.UsuariosComponent),
  },
  { path: '**', redirectTo: 'login' },
];