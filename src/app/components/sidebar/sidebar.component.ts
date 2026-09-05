import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgOptimizedImage],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  host: {
    '[class.sidebar-host--colapsado]': 'colapsado()',
  },
})
export class SidebarComponent {

  userMenuOpen = signal(false);
  colapsado = signal(false);

  readonly seccionesSitio: NavItem[] = [
    { label: 'Inicio', route: '/inicio', icon: 'home' },
    { label: 'Programación', route: '/programacion', icon: 'calendar' },
    { label: 'Videoteca', route: '/videoteca', icon: 'video' },
    { label: 'Galería', route: '/galeria', icon: 'image' },
    { label: 'Acerca de', route: '/acerca', icon: 'info' },
    
    // Descomenta cada uno cuando crees su página y su ruta:
    // { label: 'Contacto', route: '/contacto', icon: 'mail' },
    // { label: 'En Vivo Ahora', route: '/en-vivo', icon: 'live' },
  ];

  readonly configuracion: NavItem[] = [
    { label: 'Usuarios', route: '/usuarios', icon: 'users' },
  ];

  constructor(public authService: AuthService) { }

  toggleSidebar(): void {
    this.colapsado.update(v => !v);
  }

  get userName(): string {
    return this.authService.usuario()?.nombreCompleto ?? 'TV Tecno Admin';
  }

  get userRole(): string {
    const rol = this.authService.usuario()?.rol;
    if (rol === 'admin') return 'Administrador';
    if (rol === 'editor') return 'Editor';
    return 'Administrador';
  }

  get userInitials(): string {
    const nombre = this.userName.trim();
    const partes = nombre.split(' ');
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return nombre.substring(0, 2).toUpperCase();
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update(v => !v);
  }

  logout(): void {
    this.authService.logout();
  }
}