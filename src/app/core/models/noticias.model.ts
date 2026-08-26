/** La sección pública siempre muestra estos 5 registros:
 *  no se crean ni se eliminan, solo se editan y reordenan. */
export const TOTAL_NOTICIAS = 5;

export const IMAGEN_MAX_BYTES = 3 * 1024 * 1024; // 3 MB, igual que el backend
export const IMAGEN_TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

/** Sugerencias que se muestran bajo el campo de categoría.
 *  Es texto libre: el admin puede escribir cualquier otra. */
export const CATEGORIAS_SUGERIDAS = [
    'NOTICIAS',
    'ACADÉMICO',
    'VINCULACIÓN',
    'TECNOLOGÍA',
    'CULTURA',
    'DEPORTES',
    'EVENTOS',
    'CIENCIA',
];

export interface Noticia {
    id: number;
    slug: string;
    titulo: string;
    descripcion: string;
    contenido: string | null;
    etiqueta: string;
    fecha: string;
    imagenUrl: string | null;
    imagenAlt: string | null;
    tiempoLectura: number | null;
    orden: number;
    creadoEn: string;
    actualizadoEn: string;
    actualizadoPor: number | null;
}

/** `tiempoLectura` no se expone: lo calcula el backend desde `contenido`. */
export interface ActualizarNoticiaPayload {
    titulo?: string;
    slug?: string;
    descripcion?: string;
    contenido?: string;
    etiqueta?: string;
    fecha?: string;
    imagenAlt?: string;
}

export interface ReordenarNoticiasPayload {
    ids: number[];
}