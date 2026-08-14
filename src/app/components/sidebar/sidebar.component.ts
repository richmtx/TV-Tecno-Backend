import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { AuthService } from '../../services/auth.service';

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
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {

  userMenuOpen = signal(false);

  readonly seccionesSitio: NavItem[] = [
    { label: 'Inicio', route: '/admin/inicio', icon: 'home' },
    { label: 'Programación', route: '/admin/programacion', icon: 'calendar' },
    { label: 'Videoteca', route: '/admin/videoteca', icon: 'video' },
    { label: 'Galería', route: '/admin/galeria', icon: 'image' },
    { label: 'Contacto', route: '/admin/contacto', icon: 'mail' },
    { label: 'Acerca de', route: '/admin/acerca-de', icon: 'info' },
    { label: 'En Vivo Ahora', route: '/admin/en-vivo', icon: 'live' },
  ];

  readonly configuracion: NavItem[] = [
    { label: 'Usuarios', route: '/admin/usuarios', icon: 'users' },
    { label: 'Ajustes Generales', route: '/admin/ajustes', icon: 'settings' },
    { label: 'SEO y Redes', route: '/admin/seo', icon: 'share' },
    { label: 'Menú y Navegación', route: '/admin/menu', icon: 'menu' },
  ];

  constructor(public authService: AuthService) { }

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