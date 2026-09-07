/** Límites de subida, iguales a los del backend. */
export const IMAGEN_MAX_BYTES = 15 * 1024 * 1024;
export const IMAGEN_TIPOS = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/tiff',
];

/** Medios de contacto del canal. */
export interface ContactoDatos {
    id: number;

    correo: string;
    /** Como se muestra: (618) 000 0000 */
    telefono: string;
    /** Solo dígitos con lada, para el href="tel:". */
    telefonoEnlace: string;
    /** Completa, para la página de Contacto. */
    direccion: string;
    /** Abreviada, para el pie de página. */
    direccionCorta: string;
    horario: string;
    horarioDetalle: string;
    egresadosUrl: string;

    creadoEn: string;
    actualizadoEn: string;
    actualizadoPor: number | null;
}

/** Lo que acepta el PUT: los ocho campos, sin id ni auditoría. */
export type ActualizarContactoPayload = Omit<ContactoDatos, 'id' | 'creadoEn' | 'actualizadoEn' | 'actualizadoPor'>;

/**
 * Plataforma con ícono disponible en el frontend.
 * El catálogo no se edita desde el panel: llena el selector del
 * formulario de alta y nada más.
 */
export interface RedCatalogo {
    id: number;
    clave: string;
    nombre: string;
    /** Host esperado; sirve para avisar si la URL no coincide. */
    dominio: string;
    orden: number;
}

/** Cuenta del canal en una plataforma. */
export interface RedSocial {
    id: number;
    clave: string;
    nombre: string;
    url: string;
    etiqueta: string | null;
    orden: number;
    activo: boolean;
}

export interface CrearRedPayload {
    catalogoId: number;
    url: string;
    etiqueta?: string;
}

/** La plataforma no se cambia al editar: se elimina y se crea otra. */
export interface ActualizarRedPayload {
    url: string;
    etiqueta?: string | null;
    activo?: boolean;
}

/** Imagen de posición fija, con sus URLs resueltas. */
export interface ContactoImagen {
    clave: string;
    alt: string;
    ancho: number | null;
    alto: number | null;
    urls: {
        thumb: string;
        medium: string;
    };
}

/** Todo lo que la página de Contacto y el pie necesitan. */
export interface ContactoCompleto {
    datos: ContactoDatos;
    redes: RedSocial[];
    imagenes: ContactoImagen[];
}