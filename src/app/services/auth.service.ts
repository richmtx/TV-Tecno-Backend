import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UsuarioSesion {
  id: number;
  usuario: string;
  nombreCompleto: string;
  rol: 'admin' | 'editor';
}

export interface RespuestaLogin {
  access_token: string;
  usuario: UsuarioSesion;
}

const CLAVE_TOKEN = 'tvtecno_token';
const CLAVE_USUARIO = 'tvtecno_usuario';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  private readonly _usuario = signal<UsuarioSesion | null>(this.restaurarSesion());

  readonly usuario = this._usuario.asReadonly();
  readonly autenticado = computed(() => this._usuario() !== null);
  readonly esAdmin = computed(() => this._usuario()?.rol === 'admin');

  login(usuario: string, contrasena: string, recordarme: boolean): Observable<RespuestaLogin> {
    return this.http
      .post<RespuestaLogin>(`${this.baseUrl}/login`, {
        usuario,
        password: contrasena,
      })
      .pipe(
        tap((res) => {
          this.guardarSesion(res, recordarme);
          this._usuario.set(res.usuario);
        }),
      );
  }

  logout(): void {
    this.limpiarAlmacenamiento();
    this._usuario.set(null);
    this.router.navigate(['/login']);
  }

  obtenerToken(): string | null {
    return localStorage.getItem(CLAVE_TOKEN) ?? sessionStorage.getItem(CLAVE_TOKEN);
  }

  private guardarSesion(res: RespuestaLogin, recordarme: boolean): void {
    const almacen = recordarme ? localStorage : sessionStorage;
    almacen.setItem(CLAVE_TOKEN, res.access_token);
    almacen.setItem(CLAVE_USUARIO, JSON.stringify(res.usuario));
  }

  /** Restaura la sesión solo si el token sigue vigente. */
  private restaurarSesion(): UsuarioSesion | null {
    if (!this.tokenVigente(this.obtenerToken())) {
      this.limpiarAlmacenamiento();
      return null;
    }
    return this.leerUsuarioGuardado();
  }

  /** Lee la fecha de expiración del payload del JWT. */
  private tokenVigente(token: string | null): boolean {
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  private leerUsuarioGuardado(): UsuarioSesion | null {
    const crudo =
      localStorage.getItem(CLAVE_USUARIO) ?? sessionStorage.getItem(CLAVE_USUARIO);
    if (!crudo) return null;
    try {
      return JSON.parse(crudo) as UsuarioSesion;
    } catch {
      return null;
    }
  }

  private limpiarAlmacenamiento(): void {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    sessionStorage.removeItem(CLAVE_TOKEN);
    sessionStorage.removeItem(CLAVE_USUARIO);
  }
}