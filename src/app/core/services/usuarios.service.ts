import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
    Usuario, EstadisticasUsuarios, CrearUsuarioPayload,
    ActualizarUsuarioPayload, UsuarioCreado, RespuestaMensaje, Rol,
} from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
    private readonly http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/usuarios`;

    listar(filtros: { buscar?: string; rol?: Rol } = {}): Observable<Usuario[]> {
        let params = new HttpParams();
        if (filtros.buscar) params = params.set('buscar', filtros.buscar);
        if (filtros.rol) params = params.set('rol', filtros.rol);
        return this.http.get<Usuario[]>(this.url, { params });
    }

    estadisticas(): Observable<EstadisticasUsuarios> {
        return this.http.get<EstadisticasUsuarios>(`${this.url}/estadisticas`);
    }

    crear(payload: CrearUsuarioPayload): Observable<UsuarioCreado> {
        return this.http.post<UsuarioCreado>(this.url, payload);
    }

    actualizar(id: number, payload: ActualizarUsuarioPayload): Observable<Usuario> {
        return this.http.patch<Usuario>(`${this.url}/${id}`, payload);
    }

    eliminar(id: number): Observable<RespuestaMensaje> {
        return this.http.delete<RespuestaMensaje>(`${this.url}/${id}`);
    }

    reactivar(id: number): Observable<RespuestaMensaje> {
        return this.http.patch<RespuestaMensaje>(`${this.url}/${id}/reactivar`, {});
    }

    resetearPassword(id: number, passwordNueva?: string): Observable<RespuestaMensaje> {
        return this.http.patch<RespuestaMensaje>(
            `${this.url}/${id}/resetear-password`,
            passwordNueva ? { passwordNueva } : {},
        );
    }

    cambiarMiPassword(passwordActual: string, passwordNueva: string): Observable<RespuestaMensaje> {
        return this.http.patch<RespuestaMensaje>(
            `${this.url}/mi-password`,
            { passwordActual, passwordNueva },
        );
    }
}