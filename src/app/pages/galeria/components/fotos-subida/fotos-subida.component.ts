import { Component, inject, output, signal } from '@angular/core';
import { GaleriaService } from '../../../../core/services/galeria.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import {
    FOTO_MAX_ARCHIVOS,
    FOTO_MAX_BYTES,
    FOTO_TIPOS,
} from '../../../../core/models/galeria.model';
import type { FotoGaleria } from '../../../../core/models/galeria.model';

/** Archivo rechazado antes de enviarse, con su motivo. */
interface Rechazado {
    nombre: string;
    motivo: string;
}

/**
 * Zona para subir fotografías arrastrando archivos o eligiéndolos.
 *
 * Los archivos se validan aquí antes de enviarse, para no gastar
 * una subida en algo que el servidor va a rechazar de todos modos.
 * Los lotes grandes se parten en tandas: el navegador y el servidor
 * manejan mejor varias peticiones acotadas que una enorme.
 */
@Component({
    selector: 'app-fotos-subida',
    standalone: true,
    imports: [],
    templateUrl: './fotos-subida.component.html',
    styleUrl: './fotos-subida.component.css',
})
export class FotosSubidaComponent {
    private readonly service = inject(GaleriaService);
    private readonly avisos = inject(NotificacionesService);

    /** Identificador de la colección donde se suben las fotos. */
    coleccionId = 0;

    readonly subiendo = signal(false);
    readonly arrastrando = signal(false);
    readonly progreso = signal({ hechas: 0, total: 0 });
    readonly rechazados = signal<Rechazado[]>([]);

    /** Se emite con las fotografías que se guardaron. */
    readonly subidas = output<FotoGaleria[]>();

    readonly maximoMb = Math.round(FOTO_MAX_BYTES / (1024 * 1024));

    /* ===========================================
       Arrastre
       =========================================== */

    alArrastrarSobre(evento: DragEvent): void {
        evento.preventDefault();
        if (!this.subiendo()) this.arrastrando.set(true);
    }

    alSalirDelArea(evento: DragEvent): void {
        evento.preventDefault();
        this.arrastrando.set(false);
    }

    alSoltar(evento: DragEvent): void {
        evento.preventDefault();
        this.arrastrando.set(false);

        const archivos = Array.from(evento.dataTransfer?.files ?? []);
        if (archivos.length > 0) this.procesar(archivos);
    }

    alElegirArchivos(evento: Event): void {
        const input = evento.target as HTMLInputElement;
        const archivos = Array.from(input.files ?? []);
        input.value = ''; // permite volver a elegir los mismos archivos

        if (archivos.length > 0) this.procesar(archivos);
    }

    /* ===========================================
       Subida
       =========================================== */

    /** Separa los archivos válidos y sube los que pasan el filtro. */
    private procesar(archivos: File[]): void {
        if (this.subiendo()) return;

        const validos: File[] = [];
        const rechazados: Rechazado[] = [];

        for (const archivo of archivos) {
            if (!FOTO_TIPOS.includes(archivo.type)) {
                rechazados.push({ nombre: archivo.name, motivo: 'Formato no admitido' });
                continue;
            }
            if (archivo.size > FOTO_MAX_BYTES) {
                rechazados.push({
                    nombre: archivo.name,
                    motivo: `Pesa más de ${this.maximoMb} MB`,
                });
                continue;
            }
            validos.push(archivo);
        }

        this.rechazados.set(rechazados);

        if (validos.length === 0) {
            this.avisos.error('Ninguno de los archivos es una imagen válida.');
            return;
        }

        this.subir(validos);
    }

    /**
     * Sube los archivos en tandas del tamaño que acepta el servidor.
     * Las tandas van en secuencia para no saturar la conexión ni el
     * procesamiento de imágenes del servidor.
     */
    private async subir(archivos: File[]): Promise<void> {
        this.subiendo.set(true);
        this.progreso.set({ hechas: 0, total: archivos.length });

        const guardadas: FotoGaleria[] = [];
        const fallidos: { archivo: string; motivo: string }[] = [];

        for (let i = 0; i < archivos.length; i += FOTO_MAX_ARCHIVOS) {
            const tanda = archivos.slice(i, i + FOTO_MAX_ARCHIVOS);

            try {
                const resultado = await new Promise<{
                    guardadas: FotoGaleria[];
                    fallidos: { archivo: string; motivo: string }[];
                }>((resolver, rechazar) => {
                    this.service.subirFotos(this.coleccionId, tanda).subscribe({
                        next: resolver,
                        error: rechazar,
                    });
                });

                guardadas.push(...resultado.guardadas);
                fallidos.push(...resultado.fallidos);
            } catch (e) {
                // Una tanda perdida no cancela las demás: se registra y sigue.
                tanda.forEach((archivo) =>
                    fallidos.push({
                        archivo: archivo.name,
                        motivo: this.service.mensajeDeError(e, 'Falló el envío'),
                    }),
                );
            }

            this.progreso.update((p) => ({ ...p, hechas: p.hechas + tanda.length }));
        }

        this.subiendo.set(false);
        this.progreso.set({ hechas: 0, total: 0 });

        if (fallidos.length > 0) {
            this.rechazados.update((lista) => [
                ...lista,
                ...fallidos.map((f) => ({ nombre: f.archivo, motivo: f.motivo })),
            ]);
        }

        if (guardadas.length > 0) {
            this.subidas.emit(guardadas);
            this.avisos.exito(
                guardadas.length === 1
                    ? 'Se subió 1 fotografía.'
                    : `Se subieron ${guardadas.length} fotografías.`,
            );
        }

        if (fallidos.length > 0) {
            this.avisos.error(
                fallidos.length === 1
                    ? '1 archivo no se pudo subir.'
                    : `${fallidos.length} archivos no se pudieron subir.`,
            );
        }
    }

    limpiarRechazados(): void {
        this.rechazados.set([]);
    }
}