/** Clave con la que el backend identifica cada sección. */
export type SeccionClave = 'timeline' | 'albums' | 'instalaciones' | 'estudiantes';

export type EstadoColeccion = 'borrador' | 'publicado';

/** Límites de subida, iguales a los del backend. */
export const FOTO_MAX_BYTES = 25 * 1024 * 1024;
export const FOTO_MAX_ARCHIVOS = 40;
export const FOTO_TIPOS = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/tiff',
];

/**
 * Sección de la Galería.
 * Los tres indicadores describen su comportamiento, de modo que el
 * panel arme el formulario correcto sin condicionales por nombre.
 */
export interface SeccionGaleria {
    id: number;
    clave: SeccionClave;
    slug: string;
    nombre: string;
    orden: number;
    ordenAutomatico: boolean;
    usaRangoAnios: boolean;
    usaCategorias: boolean;
}

export interface CategoriaGaleria {
    id: number;
    seccionId: number;
    slug: string;
    nombre: string;
    orden: number;
}

/** Fotografía tal como la entrega el panel. */
export interface FotoGaleria {
    id: number;
    coleccionId: number;
    pie: string | null;
    anio: number | null;
    ancho: number | null;
    alto: number | null;
    orden: number;
    urls: {
        thumb: string;
        medium: string;
        original: string;
    };
}

/** Portada tal como llega anidada en una colección. */
export interface PortadaColeccion {
    id: number;
    coleccionId: number;
    archivo: string;
}

/**
 * Época, álbum, instalación o momento estudiantil.
 * El total de fotos lo calcula el backend; nunca se captura.
 */
export interface Coleccion {
    id: number;
    seccionId: number;
    categoriaId: number | null;
    slug: string;
    titulo: string;
    subtitulo: string | null;
    descripcion: string | null;
    anioInicio: number | null;
    anioFin: number | null;
    esActual: boolean;
    orden: number | null;
    portadaFotoId: number | null;
    estado: EstadoColeccion;
    publicadoEn: string | null;
    creadoEn: string;
    actualizadoEn: string;
    creadoPor: number | null;
    actualizadoPor: number | null;
    eliminadoEn: string | null;

    totalFotos: number;
    seccion?: SeccionGaleria;
    categoria?: CategoriaGaleria | null;
    portada?: PortadaColeccion | null;
}

export interface CrearColeccionPayload {
    seccionId: number;
    titulo: string;
    categoriaId?: number;
    subtitulo?: string;
    descripcion?: string;
    anioInicio?: number;
    anioFin?: number;
    esActual?: boolean;
}

/** La sección no se puede cambiar una vez creada la colección. */
export interface ActualizarColeccionPayload {
    titulo?: string;
    slug?: string;
    categoriaId?: number;
    subtitulo?: string;
    descripcion?: string;
    anioInicio?: number;
    anioFin?: number;
    esActual?: boolean;
}

export interface ReordenarColeccionesPayload {
    seccionId: number;
    ids: number[];
}

/** Resultado de una subida múltiple. */
export interface ResultadoSubida {
    guardadas: FotoGaleria[];
    fallidos: { archivo: string; motivo: string }[];
}

export interface ActualizarFotoPayload {
    pie?: string;
    anio?: number;
}