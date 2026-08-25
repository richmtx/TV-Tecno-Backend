import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  NoticiaRapida, GuardarNoticiaRapidaPayload,
  ReordenarNoticiasRapidasPayload, RespuestaMensaje,
} from '../models/noticia-rapida.model';

@Injectable({ providedIn: 'root' })
export class NoticiasRapidasService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/noticias-rapidas`;

  /** Endpoint público; el backend ya lo devuelve ordenado por `orden`. */
  listar(): Observable<NoticiaRapida[]> {
    return this.http.get<NoticiaRapida[]>(this.url);
  }

  crear(payload: GuardarNoticiaRapidaPayload): Observable<NoticiaRapida> {
    return this.http.post<NoticiaRapida>(this.url, payload);
  }

  actualizar(id: number, payload: GuardarNoticiaRapidaPayload): Observable<NoticiaRapida> {
    return this.http.patch<NoticiaRapida>(`${this.url}/${id}`, payload);
  }

  eliminar(id: number): Observable<RespuestaMensaje> {
    return this.http.delete<RespuestaMensaje>(`${this.url}/${id}`);
  }

  /** Debe enviarse la lista completa de ids en su nuevo orden. */
  reordenar(payload: ReordenarNoticiasRapidasPayload): Observable<NoticiaRapida[]> {
    return this.http.patch<NoticiaRapida[]>(`${this.url}/reordenar`, payload);
  }
}