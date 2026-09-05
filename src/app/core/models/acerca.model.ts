/** Grupos de los elementos de lista. */
export type GrupoItem = 'valor' | 'cobertura' | 'stat';

/** Bloques de la página que contienen imágenes. */
export type GrupoImagen = 'hero' | 'cobertura';

/** Límites de subida, iguales a los del backend. */
export const IMAGEN_MAX_BYTES = 15 * 1024 * 1024;
export const IMAGEN_TIPOS = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/tiff',
];

/**
 * Bloques de prosa de la página.
 *
 * Los doce campos viven en un solo registro y se guardan juntos,
 * aunque el panel los reparta entre tres secciones distintas.
 */
export interface AcercaContenido {
    id: number;

    heroEyebrow: string;
    heroTitulo: string;
    heroSubtitulo: string;

    mvEyebrow: string;
    mvTitulo: string;
    misionTitulo: string;
    misionTexto: string;
    visionTitulo: string;
    visionTexto: string;

    coberturaEyebrow: string;
    coberturaTitulo: string;
    coberturaTexto: string;

    creadoEn: string;
    actualizadoEn: string;
    actualizadoPor: number | null;
}

/**
 * Lo que acepta el PUT de contenido: los doce campos, sin id ni
 * auditoría. El backend rechaza cualquier campo de más.
 */
export type ActualizarContenidoPayload = Omit<AcercaContenido, 'id' | 'creadoEn' | 'actualizadoEn' | 'actualizadoPor'>;

/** Un valor, un renglón de cobertura o un indicador. */
export interface AcercaItem {
    clave: string;
    titulo: string;
    subtitulo: string | null;
    icono: string | null;
}

/** El item completo tal como lo entrega el endpoint de admin. */
export interface AcercaItemAdmin extends AcercaItem {
    id: number;
    grupo: GrupoItem;
    orden: number;
    creadoEn: string;
    actualizadoEn: string;
    actualizadoPor: number | null;
}

export interface ActualizarItemPayload {
    titulo: string;
    subtitulo?: string | null;
    icono?: string | null;
}

/** Imagen de posición fija, con sus URLs resueltas. */
export interface AcercaImagen {
    clave: string;
    etiqueta: string;
    alt: string;
    ancho: number | null;
    alto: number | null;
    urls: {
        thumb: string;
        medium: string;
    };
}

/** La página completa, tal como llega del endpoint público. */
export interface AcercaCompleto {
    contenido: AcercaContenido;
    valores: AcercaItem[];
    cobertura: AcercaItem[];
    stats: AcercaItem[];
    imagenes: Record<GrupoImagen, AcercaImagen[]>;
}