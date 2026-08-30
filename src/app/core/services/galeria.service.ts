import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
    ActualizarColeccionPayload,
    ActualizarFotoPayload,
    CategoriaGaleria,
    Coleccion,
    CrearColeccionPayload,
    EstadoColeccion,
    FotoGaleria,
    ReordenarColeccionesPayload,
    ResultadoSubida,
    SeccionGaleria,
} from '../models/galeria.model';

@Injectable({ providedIn: 'root' })
export class GaleriaService {
    private readonly http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/admin/galeria`;

    /* ===========================================
       Catálogos
       =========================================== */

    listarSecciones(): Observable<SeccionGaleria[]> {
        return this.http.get<SeccionGaleria[]>(`${this.url}/secciones`);
    }

    listarCategorias(seccionId: number): Observable<CategoriaGaleria[]> {
        return this.http.get<CategoriaGaleria[]>(
            `${this.url}/secciones/${seccionId}/categorias`,
        );
    }

    /* ===========================================
       Colecciones
       =========================================== */

    listarColecciones(seccionId?: number): Observable<Coleccion[]> {
        let params = new HttpParams();
        if (seccionId !== undefined) {
            params = params.set('seccionId', seccionId);
        }
        return this.http.get<Coleccion[]>(`${this.url}/colecciones`, { params });
    }

    obtenerColeccion(id: number): Observable<Coleccion> {
        return this.http.get<Coleccion>(`${this.url}/colecciones/${id}`);
    }

    crearColeccion(payload: CrearColeccionPayload): Observable<Coleccion> {
        return this.http.post<Coleccion>(`${this.url}/colecciones`, payload);
    }

    actualizarColeccion(
        id: number,
        payload: ActualizarColeccionPayload,
    ): Observable<Coleccion> {
        return this.http.patch<Coleccion>(`${this.url}/colecciones/${id}`, payload);
    }

    publicarColeccion(id: number): Observable<Coleccion> {
        return this.http.patch<Coleccion>(
            `${this.url}/colecciones/${id}/publicar`,
            {},
        );
    }

    despublicarColeccion(id: number): Observable<Coleccion> {
        return this.http.patch<Coleccion>(
            `${this.url}/colecciones/${id}/despublicar`,
            {},
        );
    }

    definirPortada(id: number, fotoId: number): Observable<Coleccion> {
        return this.http.patch<Coleccion>(
            `${this.url}/colecciones/${id}/portada/${fotoId}`,
            {},
        );
    }

    reordenarColecciones(
        payload: ReordenarColeccionesPayload,
    ): Observable<void> {
        return this.http.patch<void>(`${this.url}/colecciones/reordenar`, payload);
    }

    eliminarColeccion(id: number): Observable<void> {
        return this.http.delete<void>(`${this.url}/colecciones/${id}`);
    }

    /* ===========================================
   Papelera
   =========================================== */

    listarPapelera(): Observable<Coleccion[]> {
        return this.http.get<Coleccion[]>(`${this.url}/colecciones/papelera`);
    }

    restaurarColeccion(id: number): Observable<Coleccion> {
        return this.http.patch<Coleccion>(
            `${this.url}/colecciones/${id}/restaurar`,
            {},
        );
    }

    purgarColeccion(id: number): Observable<void> {
        return this.http.delete<void>(`${this.url}/colecciones/${id}/purgar`);
    }

    /* ===========================================
       Fotografías
       =========================================== */

    listarFotos(coleccionId: number): Observable<FotoGaleria[]> {
        return this.http.get<FotoGaleria[]>(
            `${this.url}/colecciones/${coleccionId}/fotos`,
        );
    }

    /**
     * Sube varias imágenes de una vez.
     * El navegador arma el `Content-Type` con el boundary del
     * multipart: fijarlo a mano impide separar las partes.
     */
    subirFotos(coleccionId: number, archivos: File[]): Observable<ResultadoSubida> {
        const datos = new FormData();
        archivos.forEach((archivo) => datos.append('archivos', archivo));
        return this.http.post<ResultadoSubida>(
            `${this.url}/colecciones/${coleccionId}/fotos`,
            datos,
        );
    }

    actualizarFoto(
        coleccionId: number,
        fotoId: number,
        payload: ActualizarFotoPayload,
    ): Observable<FotoGaleria> {
        return this.http.patch<FotoGaleria>(
            `${this.url}/colecciones/${coleccionId}/fotos/${fotoId}`,
            payload,
        );
    }

    asignarAnioEnLote(
        coleccionId: number,
        ids: number[],
        anio?: number,
    ): Observable<number> {
        return this.http.patch<number>(
            `${this.url}/colecciones/${coleccionId}/fotos/anio`,
            { ids, anio },
        );
    }

    reordenarFotos(coleccionId: number, ids: number[]): Observable<void> {
        return this.http.patch<void>(
            `${this.url}/colecciones/${coleccionId}/fotos/reordenar`,
            { ids },
        );
    }

    eliminarFoto(coleccionId: number, fotoId: number): Observable<void> {
        return this.http.delete<void>(
            `${this.url}/colecciones/${coleccionId}/fotos/${fotoId}`,
        );
    }

    eliminarFotosEnLote(coleccionId: number, ids: number[]): Observable<number> {
        return this.http.delete<number>(
            `${this.url}/colecciones/${coleccionId}/fotos/lote`,
            { body: { ids } },
        );
    }

    /* ===========================================
       Utilidades
       =========================================== */

    /** La API entrega rutas relativas; el `img` necesita la absoluta. */
    urlAbsoluta(ruta: string | null | undefined): string | null {
        return ruta ? `${environment.apiUrl}${ruta}` : null;
    }

    /**
     * Miniatura de la portada de una colección.
     * La ruta se compone del identificador de la colección y del
     * nombre del archivo, según la convención del backend.
     */
    urlPortada(coleccion: Coleccion): string | null {
        if (!coleccion.portada) return null;
        return this.urlAbsoluta(
            `/uploads/galeria/${coleccion.id}/thumb/${coleccion.portada.archivo}`,
        );
    }

    /** El ValidationPipe de Nest manda `message` como string o arreglo. */
    mensajeDeError(e: any, respaldo = 'Ocurrió un error inesperado.'): string {
        const mensaje = e?.error?.message;
        if (Array.isArray(mensaje)) return mensaje[0];
        if (typeof mensaje === 'string') return mensaje;
        return respaldo;
    }

    /** Texto del periodo de una colección con rango de años. */
    periodo(coleccion: Coleccion): string | null {
        if (coleccion.anioInicio === null) return null;
        if (coleccion.esActual) return `${coleccion.anioInicio} - Actualidad`;
        if (coleccion.anioFin === null) return String(coleccion.anioInicio);
        return `${coleccion.anioInicio} - ${coleccion.anioFin}`;
    }

    estadoLegible(estado: EstadoColeccion): string {
        return estado === 'publicado' ? 'Publicado' : 'Borrador';
    }

    /**
       * Días que le quedan a una colección antes de eliminarse sola.
        * Devuelve cero cuando ya cumplió el plazo y está a la espera de
        * la siguiente limpieza automática.
    */
    diasRestantes(eliminadoEn: string | null, plazo = 30): number {
        if (!eliminadoEn) return plazo;

        const transcurridos = Math.floor(
            (Date.now() - new Date(eliminadoEn).getTime()) / 86400000,
        );
        return Math.max(0, plazo - transcurridos);
    }
}