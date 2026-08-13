import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UsuarioSesion {
  id: number;
  usuario: string;
  nombreCompleto: string;
  correo: string | null;
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
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  private readonly _usuario = signal<UsuarioSesion | null>(this.leerUsuarioGuardado());

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
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    sessionStorage.removeItem(CLAVE_TOKEN);
    sessionStorage.removeItem(CLAVE_USUARIO);
    this._usuario.set(null);
  }

  obtenerToken(): string | null {
    return localStorage.getItem(CLAVE_TOKEN) ?? sessionStorage.getItem(CLAVE_TOKEN);
  }

  private guardarSesion(res: RespuestaLogin, recordarme: boolean): void {
    const almacen = recordarme ? localStorage : sessionStorage;
    almacen.setItem(CLAVE_TOKEN, res.access_token);
    almacen.setItem(CLAVE_USUARIO, JSON.stringify(res.usuario));
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
}