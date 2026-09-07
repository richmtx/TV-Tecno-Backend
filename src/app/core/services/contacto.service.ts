import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
    ActualizarContactoPayload,
    ActualizarRedPayload,
    ContactoCompleto,
    ContactoDatos,
    ContactoImagen,
    CrearRedPayload,
    RedCatalogo,
    RedSocial,
} from '../models/contacto.model';

/**
 * Medios de contacto del canal.
 *
 * Los datos alimentan tanto la página de Contacto como el pie del
 * sitio público: editar aquí actualiza ambos a la vez.
 */
@Injectable({ providedIn: 'root' })
export class ContactoService {
    private readonly http = inject(HttpClient);
    private readonly url = `${environment.apiUrl}/admin/contacto`;

    /* ===========================================
       Lectura
       =========================================== */

    /** Todo armado en una sola petición. Es el endpoint público. */
    obtenerTodo(): Observable<ContactoCompleto> {
        return this.http.get<ContactoCompleto>(`${environment.apiUrl}/contacto`);
    }

    obtenerDatos(): Observable<ContactoDatos> {
        return this.http.get<ContactoDatos>(`${this.url}/datos`);
    }

    listarImagenes(): Observable<ContactoImagen[]> {
        return this.http.get<ContactoImagen[]>(`${this.url}/imagenes`);
    }

    /* ===========================================
       Redes sociales
       =========================================== */

    /** Plataformas disponibles, para el selector del formulario. */
    listarCatalogo(): Observable<RedCatalogo[]> {
        return this.http.get<RedCatalogo[]>(`${this.url}/redes/catalogo`);
    }

    /** Todas las cuentas, incluidas las ocultas. */
    listarRedes(): Observable<RedSocial[]> {
        return this.http.get<RedSocial[]>(`${this.url}/redes`);
    }

    crearRed(payload: CrearRedPayload): Observable<RedSocial> {
        return this.http.post<RedSocial>(`${this.url}/redes`, payload);
    }

    actualizarRed(id: number, payload: ActualizarRedPayload): Observable<RedSocial> {
        return this.http.put<RedSocial>(`${this.url}/redes/${id}`, payload);
    }

    reordenarRedes(ids: number[]): Observable<void> {
        return this.http.patch<void>(`${this.url}/redes/reordenar`, { ids });
    }

    eliminarRed(id: number): Observable<void> {
        return this.http.delete<void>(`${this.url}/redes/${id}`);
    }

    /* ===========================================
       Edición
       =========================================== */

    actualizarDatos(payload: ActualizarContactoPayload): Observable<ContactoDatos> {
        return this.http.put<ContactoDatos>(`${this.url}/datos`, payload);
    }

    /**
     * Actualiza una imagen y su texto alternativo.
     * El navegador arma el `Content-Type` con el boundary del
     * multipart; fijarlo a mano impide separar las partes.
     */
    actualizarImagen(clave: string, alt: string, archivo?: File | null): Observable<ContactoImagen> {
        const datos = new FormData();
        datos.append('alt', alt);
        if (archivo) {
            datos.append('archivo', archivo);
        }
        return this.http.put<ContactoImagen>(`${this.url}/imagenes/${clave}`, datos);
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
        if (!TIPOS_SET.has(archivo.type)) {
            return 'El archivo debe ser una imagen JPG, PNG, WebP, AVIF o TIFF.';
        }
        if (archivo.size > MAX_BYTES) {
            return 'La imagen no debe pesar más de 15 MB.';
        }
        return null;
    }

    /**
     * Avisa si la dirección no parece de la plataforma elegida.
     * No bloquea: hay enlaces cortos legítimos (fb.me, youtu.be).
     */
    dominioNoCoincide(url: string, dominio: string): boolean {
        const limpia = url.trim().toLowerCase();
        if (!limpia) return false;
        return !limpia.includes(dominio.toLowerCase());
    }
}

// Se resuelven una sola vez en lugar de en cada validación.
const MAX_BYTES = 15 * 1024 * 1024;
const TIPOS_SET = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/tiff',
]);