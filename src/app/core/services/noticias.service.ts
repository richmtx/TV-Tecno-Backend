import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
    Noticia, ActualizarNoticiaPayload, ReordenarNoticiasPayload,
} from '../models/noticias.model';

@Injectable({ providedIn: 'root' })
export class NoticiasService {
    private readonly http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/noticias`;

    listar(): Observable<Noticia[]> {
        return this.http.get<Noticia[]>(this.url);
    }

    actualizar(id: number, payload: ActualizarNoticiaPayload): Observable<Noticia> {
        return this.http.patch<Noticia>(`${this.url}/${id}`, payload);
    }

    reordenar(payload: ReordenarNoticiasPayload): Observable<Noticia[]> {
        return this.http.patch<Noticia[]>(`${this.url}/reordenar`, payload);
    }

    /**
     * El navegador arma el `Content-Type` con el boundary del multipart:
     * si lo fijamos a mano, el backend no sabe separar las partes.
     */
    subirImagen(id: number, archivo: File): Observable<Noticia> {
        const datos = new FormData();
        datos.append('imagen', archivo);
        return this.http.patch<Noticia>(`${this.url}/${id}/imagen`, datos);
    }

    /** Pide al backend un slug a partir del título, sin guardarlo. */
    sugerirSlug(id: number, titulo: string): Observable<{ slug: string }> {
        return this.http.get<{ slug: string }>(`${this.url}/${id}/sugerir-slug`, {
            params: { titulo },
        });
    }

    /** La BD guarda rutas relativas (`/uploads/...`); el `img` necesita la absoluta. */
    urlAbsoluta(ruta: string | null): string | null {
        return ruta ? `${environment.apiUrl}${ruta}` : null;
    }
}