import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
    AcercaCompleto,
    AcercaContenido,
    AcercaImagen,
    AcercaItemAdmin,
    ActualizarContenidoPayload,
    ActualizarItemPayload,
} from '../models/acerca.model';

/**
 * Contenido administrable de la página "Acerca de".
 *
 * La estructura de la página es fija: no hay métodos para crear ni
 * eliminar porque el backend no expone esas operaciones. Todo se
 * identifica por `clave`, no por id.
 */
@Injectable({ providedIn: 'root' })
export class AcercaService {
    private readonly http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/admin/acerca`;

    /* ===========================================
       Lectura
       =========================================== */

    /**
     * La página completa en una sola petición.
     * Es el endpoint público: no requiere token y entrega todo ya
     * agrupado, que es justo lo que el panel necesita al abrir.
     */
    obtenerTodo(): Observable<AcercaCompleto> {
        return this.http.get<AcercaCompleto>(`${environment.apiUrl}/acerca`);
    }

    obtenerContenido(): Observable<AcercaContenido> {
        return this.http.get<AcercaContenido>(`${this.url}/contenido`);
    }

    listarItems(): Observable<AcercaItemAdmin[]> {
        return this.http.get<AcercaItemAdmin[]>(`${this.url}/items`);
    }

    listarImagenes(): Observable<AcercaImagen[]> {
        return this.http.get<AcercaImagen[]>(`${this.url}/imagenes`);
    }

    /* ===========================================
       Edición
       =========================================== */

    /**
     * Reemplaza el bloque de prosa completo.
     * Es un PUT: hay que mandar los doce campos, aunque el
     * formulario que dispara el guardado solo edite algunos.
     */
    actualizarContenido(
        payload: ActualizarContenidoPayload,
    ): Observable<AcercaContenido> {
        return this.http.put<AcercaContenido>(`${this.url}/contenido`, payload);
    }

    actualizarItem(
        clave: string,
        payload: ActualizarItemPayload,
    ): Observable<AcercaItemAdmin> {
        return this.http.put<AcercaItemAdmin>(`${this.url}/items/${clave}`, payload);
    }

    /**
     * Actualiza una imagen y sus textos.
     *
     * El archivo es opcional: sin él solo cambian etiqueta y alt.
     * El navegador arma el `Content-Type` con el boundary del
     * multipart; fijarlo a mano impide separar las partes.
     */
    actualizarImagen(
        clave: string,
        etiqueta: string,
        alt: string,
        archivo?: File | null,
    ): Observable<AcercaImagen> {
        const datos = new FormData();
        datos.append('etiqueta', etiqueta);
        datos.append('alt', alt);
        if (archivo) {
            datos.append('archivo', archivo);
        }
        return this.http.put<AcercaImagen>(`${this.url}/imagenes/${clave}`, datos);
    }

    /* ===========================================
       Utilidades
       =========================================== */

    /** La API entrega rutas relativas; el `img` necesita la absoluta. */
    urlAbsoluta(ruta: string | null | undefined): string | null {
        return ruta ? `${environment.apiUrl}${ruta}` : null;
    }

    /** El ValidationPipe de Nest manda `message` como string o arreglo. */
    mensajeDeError(e: any, respaldo = 'Ocurrió un error inesperado.'): string {
        const mensaje = e?.error?.message;
        if (Array.isArray(mensaje)) return mensaje[0];
        if (typeof mensaje === 'string') return mensaje;
        return respaldo;
    }

    /** Rechaza archivos que no son imágenes admitidas o pesan de más. */
    validarImagen(archivo: File): string | null {
        if (!IMAGEN_TIPOS_SET.has(archivo.type)) {
            return 'El archivo debe ser una imagen JPG, PNG, WebP, AVIF o TIFF.';
        }
        if (archivo.size > IMAGEN_MAX_BYTES_LOCAL) {
            return 'La imagen no debe pesar más de 15 MB.';
        }
        return null;
    }
}

// Se resuelven una sola vez en lugar de en cada validación.
const IMAGEN_MAX_BYTES_LOCAL = 15 * 1024 * 1024;
const IMAGEN_TIPOS_SET = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/tiff',
]);