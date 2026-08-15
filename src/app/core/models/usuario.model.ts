export type Rol = 'admin' | 'editor';

export interface Usuario {
    id: number;
    usuario: string;
    nombreCompleto: string;
    correo: string;
    rol: Rol;
    activo: boolean;
    ultimoAcceso: string | null;
    creadoEn: string;
    actualizadoEn: string;
    creadoPorId: number | null;
}

export interface EstadisticasUsuarios {
    total: number;
    admins: number;
    editores: number;
    inactivos: number;
}

export interface CrearUsuarioPayload {
    usuario: string;
    nombreCompleto: string;
    correo: string;
    rol: Rol;
    password?: string;
}

export interface ActualizarUsuarioPayload {
    nombreCompleto?: string;
    correo?: string;
    rol?: Rol;
    activo?: boolean;
}

export interface UsuarioCreado extends Usuario {
    passwordGenerada?: string;
}

export interface RespuestaMensaje {
    mensaje: string;
    passwordGenerada?: string;
}