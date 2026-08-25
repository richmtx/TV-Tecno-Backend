import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  ProgramaDestacado, ActualizarProgramaPayload, ReordenarProgramasPayload,
} from '../models/programacion-destacada.model';

@Injectable({ providedIn: 'root' })
export class ProgramacionDestacadaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/programacion-destacada`;

  listar(): Observable<ProgramaDestacado[]> {
    return this.http.get<ProgramaDestacado[]>(this.url);
  }

  actualizar(id: number, payload: ActualizarProgramaPayload): Observable<ProgramaDestacado> {
    return this.http.patch<ProgramaDestacado>(`${this.url}/${id}`, payload);
  }

  reordenar(payload: ReordenarProgramasPayload): Observable<ProgramaDestacado[]> {
    return this.http.patch<ProgramaDestacado[]>(`${this.url}/reordenar`, payload);
  }

  /**
   * El navegador arma el `Content-Type` con el boundary del multipart:
   * si lo fijamos a mano, el backend no sabe separar las partes.
   */
  subirImagen(id: number, archivo: File): Observable<ProgramaDestacado> {
    const datos = new FormData();
    datos.append('imagen', archivo);
    return this.http.patch<ProgramaDestacado>(`${this.url}/${id}/imagen`, datos);
  }

  /** La BD guarda rutas relativas (`/uploads/...`); el `img` necesita la absoluta. */
  urlAbsoluta(ruta: string | null): string | null {
    return ruta ? `${environment.apiUrl}${ruta}` : null;
  }
}