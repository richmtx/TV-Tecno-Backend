/** El carrusel público siempre muestra estos 5 registros:
 *  no se crean ni se eliminan, solo se editan y reordenan. */
export const TOTAL_DESTACADOS = 5;

export const IMAGEN_MAX_BYTES = 3 * 1024 * 1024; // 3 MB, igual que el backend
export const IMAGEN_TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

export interface ProgramaDestacado {
    id: number;
    titulo: string;
    etiqueta: string;
    dias: string;
    horaInicio: string;
    horaFin: string | null;
    imagenUrl: string | null;
    imagenAlt: string | null;
    orden: number;
    creadoEn: string;
    actualizadoEn: string;
    actualizadoPor: number | null;
}

/** `horaFin` no se expone: el backend lo rechaza por `forbidNonWhitelisted`. */
export interface ActualizarProgramaPayload {
    titulo?: string;
    etiqueta?: string;
    dias?: string;
    horaInicio?: string;
    imagenAlt?: string;
}

export interface ReordenarProgramasPayload {
    ids: number[];
}