/** Reglas de negocio que impone el backend. Se replican aquí solo para
 *  deshabilitar botones antes de que el servidor conteste con un 400. */
export const NR_MINIMO = 3;
export const NR_MAXIMO = 8;
export const NR_MAX_CARACTERES = 120;

export interface NoticiaRapida {
    id: number;
    texto: string;
    orden: number;
    creadoEn: string;
    actualizadoEn: string;
    actualizadoPor: number | null;
}

/** El backend usa `forbidNonWhitelisted`, así que el body va con `texto` y nada más. */
export interface GuardarNoticiaRapidaPayload {
    texto: string;
}

export interface ReordenarNoticiasRapidasPayload {
    ids: number[];
}

export interface RespuestaMensaje {
    mensaje: string;
}