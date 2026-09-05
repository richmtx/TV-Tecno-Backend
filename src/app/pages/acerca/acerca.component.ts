import { Component, computed, inject, signal } from '@angular/core';
import { AcercaService } from '../../core/services/acerca.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { AcercaMisionVisionComponent } from './sections/acerca-mision-vision/acerca-mision-vision.component';
import { AcercaHeroComponent } from './sections/acerca-hero/acerca-hero.component';
import { AcercaCoberturaComponent } from './sections/acerca-cobertura/acerca-cobertura.component';
import type {
    AcercaCompleto,
    AcercaContenido,
    AcercaImagen,
    AcercaItem,
    ActualizarContenidoPayload,
} from '../../core/models/acerca.model';

/**
 * Contenedor de la página "Acerca de" en el panel.
 *
 * Carga la página completa de una sola vez y reparte los datos
 * entre las tres secciones. Mantiene la copia maestra del bloque
 * de prosa porque los doce campos comparten un único endpoint:
 * cuando una sección guarda sus campos, aquí se mezclan con el
 * resto antes de enviarlos.
 */
@Component({
    selector: 'app-acerca',
    standalone: true,
    imports: [AcercaHeroComponent, AcercaMisionVisionComponent, AcercaCoberturaComponent],
    templateUrl: './acerca.component.html',
    styleUrl: './acerca.component.css',
})
export class AcercaComponent {
    private readonly service = inject(AcercaService);
    private readonly avisos = inject(NotificacionesService);

    readonly cargando = signal(true);
    readonly errorCarga = signal<string | null>(null);

    /** Copia maestra del bloque de prosa. */
    readonly contenido = signal<AcercaContenido | null>(null);

    readonly valores = signal<AcercaItem[]>([]);
    readonly cobertura = signal<AcercaItem[]>([]);
    readonly stats = signal<AcercaItem[]>([]);
    readonly imagenesHero = signal<AcercaImagen[]>([]);
    readonly imagenesCobertura = signal<AcercaImagen[]>([]);

    /** Las secciones solo se dibujan cuando ya hay datos. */
    readonly listo = computed(() => this.contenido() !== null);

    /**
     * Se pasa como input a las secciones. La forma de flecha
     * conserva el `this` sin necesidad de bind en la plantilla.
     */
    readonly guardarProsaFn = (cambios: Partial<ActualizarContenidoPayload>) =>
        this.guardarContenido(cambios);

    constructor() {
        this.cargar();
    }

    cargar(): void {
        this.cargando.set(true);
        this.errorCarga.set(null);

        this.service.obtenerTodo().subscribe({
            next: (datos) => {
                this.repartir(datos);
                this.cargando.set(false);
            },
            error: (e) => {
                this.cargando.set(false);
                this.errorCarga.set(
                    this.service.mensajeDeError(
                        e,
                        'No se pudo cargar el contenido de Acerca de.',
                    ),
                );
            },
        });
    }

    private repartir(datos: AcercaCompleto): void {
        this.contenido.set(datos.contenido);
        this.valores.set(datos.valores);
        this.cobertura.set(datos.cobertura);
        this.stats.set(datos.stats);
        this.imagenesHero.set(datos.imagenes.hero);
        this.imagenesCobertura.set(datos.imagenes.cobertura);
    }

    /**
     * Guarda los campos de prosa que envía una sección.
     *
     * El endpoint es un PUT sobre el registro completo, así que los
     * campos recibidos se mezclan con la copia maestra. Devuelve una
     * promesa para que la sección sepa cuándo terminó y pueda
     * apagar su indicador de guardado.
     */
    guardarContenido(cambios: Partial<ActualizarContenidoPayload>): Promise<boolean> {
        const actual = this.contenido();
        if (!actual) return Promise.resolve(false);

        const payload: ActualizarContenidoPayload = {
            heroEyebrow: actual.heroEyebrow,
            heroTitulo: actual.heroTitulo,
            heroSubtitulo: actual.heroSubtitulo,
            mvEyebrow: actual.mvEyebrow,
            mvTitulo: actual.mvTitulo,
            misionTitulo: actual.misionTitulo,
            misionTexto: actual.misionTexto,
            visionTitulo: actual.visionTitulo,
            visionTexto: actual.visionTexto,
            coberturaEyebrow: actual.coberturaEyebrow,
            coberturaTitulo: actual.coberturaTitulo,
            coberturaTexto: actual.coberturaTexto,
            ...cambios,
        };

        return new Promise((resolver) => {
            this.service.actualizarContenido(payload).subscribe({
                next: (guardado) => {
                    this.contenido.set(guardado);
                    this.avisos.exito('Cambios guardados.');
                    resolver(true);
                },
                error: (e) => {
                    this.avisos.error(
                        this.service.mensajeDeError(e, 'No se pudieron guardar los cambios.'),
                    );
                    resolver(false);
                },
            });
        });
    }

    /** Refresca los valores después de que la sección los guardó. */
    actualizarValores(valores: AcercaItem[]): void {
        this.valores.set(valores);
    }

    /** Refresca una imagen del mosaico después de guardarla. */
    actualizarImagenHero(imagen: AcercaImagen): void {
        this.imagenesHero.update((lista) =>
            lista.map((actual) => (actual.clave === imagen.clave ? imagen : actual)),
        );
    }

    /** Refresca los renglones de cobertura después de guardarlos. */
    actualizarCobertura(items: AcercaItem[]): void {
        this.cobertura.set(items);
    }

    /** Refresca los indicadores después de guardarlos. */
    actualizarStats(items: AcercaItem[]): void {
        this.stats.set(items);
    }

    /** Refresca una imagen del bloque de cobertura. */
    actualizarImagenCobertura(imagen: AcercaImagen): void {
        this.imagenesCobertura.update((lista) =>
            lista.map((actual) => (actual.clave === imagen.clave ? imagen : actual)),
        );
    }
}