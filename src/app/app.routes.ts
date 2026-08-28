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
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/layout.component').then((m) => m.LayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'inicio',
        loadComponent: () =>
          import('./pages/inicio/inicio.component').then((m) => m.InicioComponent),
      },
      {
        path: 'programacion',
        loadComponent: () =>
          import('./pages/programacion/programacion.component').then((m) => m.ProgramacionComponent),
      },
      {
        path: 'videoteca',
        loadComponent: () =>
          import('./pages/videoteca/videoteca.component').then((m) => m.VideotecaComponent),
      },
      {
        path: 'galeria',
        loadComponent: () =>
          import('./pages/galeria/galeria.component').then((m) => m.GaleriaComponent),
        children: [
          {
            path: '',
            loadComponent: () =>
              import(
                './pages/galeria/components/colecciones-lista/colecciones-lista.component'
              ).then((m) => m.ColeccionesListaComponent),
          },
          {
            path: 'coleccion/:id',
            loadComponent: () =>
              import(
                './pages/galeria/components/coleccion-detalle/coleccion-detalle.component'
              ).then((m) => m.ColeccionDetalleComponent),
          },
        ],
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./pages/usuarios/usuarios.component').then((m) => m.UsuariosComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];