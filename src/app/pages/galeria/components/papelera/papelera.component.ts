import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { GaleriaService } from '../../../../core/services/galeria.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import type { Coleccion } from '../../../../core/models/galeria.model';

/** Días que el contenido permanece antes de eliminarse solo. */
const DIAS_EN_PAPELERA = 30;

/**
 * Papelera de la Galería.
 *
 * Muestra las colecciones eliminadas con los días que les quedan
 * antes de la limpieza automática. La restauración siempre es
 * completa: recuperar solo parte de una colección complicaría la
 * interfaz sin resolver el caso real, que es haberse equivocado.
 */
@Component({
    selector: 'app-papelera',
    standalone: true,
    imports: [],
    templateUrl: './papelera.component.html',
    styleUrl: './papelera.component.css',
})
export class PapeleraComponent implements OnInit {
    private readonly service = inject(GaleriaService);
    private readonly avisos = inject(NotificacionesService);

    readonly colecciones = signal<Coleccion[]>([]);
    readonly cargando = signal(true);
    readonly error = signal<string | null>(null);

    /** Identificador de la colección sobre la que se está actuando. */
    readonly ocupada = signal<number | null>(null);

    /** Colección cuya eliminación definitiva se está confirmando. */
    readonly purgando = signal<Coleccion | null>(null);

    readonly vacia = computed(() => this.colecciones().length === 0);

    readonly diasEnPapelera = DIAS_EN_PAPELERA;

    ngOnInit(): void {
        this.cargar();
    }

    cargar(): void {
        this.cargando.set(true);
        this.error.set(null);

        this.service.listarPapelera().subscribe({
            next: (colecciones) => {
                this.colecciones.set(colecciones);
                this.cargando.set(false);
            },
            error: () => {
                this.error.set('No se pudo cargar la papelera.');
                this.cargando.set(false);
            },
        });
    }

    /* ===========================================
       Presentación
       =========================================== */

    portada(coleccion: Coleccion): string | null {
        return this.service.urlPortada(coleccion);
    }

    dias(coleccion: Coleccion): number {
        return this.service.diasRestantes(coleccion.eliminadoEn, DIAS_EN_PAPELERA);
    }

    /** Menos de una semana: conviene destacar la urgencia. */
    esUrgente(coleccion: Coleccion): boolean {
        return this.dias(coleccion) <= 7;
    }

    fecha(coleccion: Coleccion): string {
        if (!coleccion.eliminadoEn) return '';
        return new Date(coleccion.eliminadoEn).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    }

    /* ===========================================
       Restaurar
       =========================================== */

    restaurar(coleccion: Coleccion): void {
        if (this.ocupada() !== null) return;

        this.ocupada.set(coleccion.id);

        this.service.restaurarColeccion(coleccion.id).subscribe({
            next: (restaurada) => {
                this.ocupada.set(null);
                this.colecciones.update((lista) =>
                    lista.filter((c) => c.id !== coleccion.id),
                );
                this.avisos.exito(
                    `"${restaurada.titulo}" volvió como borrador. Publícala cuando quieras mostrarla.`,
                );
            },
            error: (e) => {
                this.ocupada.set(null);
                this.avisos.error(
                    this.service.mensajeDeError(e, 'No se pudo restaurar la colección.'),
                );
            },
        });
    }

    /* ===========================================
       Eliminar definitivamente
       =========================================== */

    confirmarPurga(coleccion: Coleccion): void {
        this.purgando.set(coleccion);
    }

    cancelarPurga(): void {
        if (this.ocupada() !== null) return;
        this.purgando.set(null);
    }

    purgar(): void {
        const coleccion = this.purgando();
        if (!coleccion) return;

        this.ocupada.set(coleccion.id);

        this.service.purgarColeccion(coleccion.id).subscribe({
            next: () => {
                this.ocupada.set(null);
                this.purgando.set(null);
                this.colecciones.update((lista) =>
                    lista.filter((c) => c.id !== coleccion.id),
                );
                this.avisos.exito(`"${coleccion.titulo}" se eliminó definitivamente.`);
            },
            error: (e) => {
                this.ocupada.set(null);
                this.purgando.set(null);
                this.avisos.error(
                    this.service.mensajeDeError(e, 'No se pudo eliminar la colección.'),
                );
            },
        });
    }
}