import { Component, computed, inject, input, output, signal } from '@angular/core';
import { GaleriaService } from '../../../../core/services/galeria.service';
import type { FotoGaleria } from '../../../../core/models/galeria.model';

/**
 * Cuadrícula de fotografías con selección múltiple.
 *
 * La selección es la base de las acciones en lote: asignar un año
 * a cuarenta fotos de golpe es lo único que hace viable capturar
 * ese dato en una colección grande.
 */
@Component({
    selector: 'app-fotos-cuadricula',
    standalone: true,
    imports: [],
    templateUrl: './fotos-cuadricula.component.html',
    styleUrl: './fotos-cuadricula.component.css',
})
export class FotosCuadriculaComponent {
    private readonly service = inject(GaleriaService);

    readonly fotos = input.required<FotoGaleria[]>();

    /** Identificador de la fotografía marcada como portada. */
    readonly portadaId = input<number | null>(null);

    /** Solo el administrador puede eliminar. */
    readonly puedeEliminar = input<boolean>(false);

    readonly seleccionCambiada = output<number[]>();
    readonly editar = output<FotoGaleria>();
    readonly definirPortada = output<FotoGaleria>();

    readonly seleccionadas = signal<Set<number>>(new Set());

    readonly totalSeleccionadas = computed(() => this.seleccionadas().size);

    readonly todasSeleccionadas = computed(
        () =>
            this.fotos().length > 0 &&
            this.seleccionadas().size === this.fotos().length,
    );

    /** Índice de la última foto marcada, para la selección por rango. */
    private ultimoIndice: number | null = null;

    url(foto: FotoGaleria): string | null {
        return this.service.urlAbsoluta(foto.urls.thumb);
    }

    estaSeleccionada(id: number): boolean {
        return this.seleccionadas().has(id);
    }

    /**
     * Alterna la selección de una fotografía.
     * Con la tecla Mayúsculas se selecciona el rango desde la última
     * marcada, como en un explorador de archivos.
     */
    alternar(foto: FotoGaleria, indice: number, evento: MouseEvent): void {
        const conRango = evento.shiftKey && this.ultimoIndice !== null;

        this.seleccionadas.update((actual) => {
            const nueva = new Set(actual);

            if (conRango) {
                const desde = Math.min(this.ultimoIndice!, indice);
                const hasta = Math.max(this.ultimoIndice!, indice);
                for (let i = desde; i <= hasta; i++) {
                    nueva.add(this.fotos()[i].id);
                }
            } else if (nueva.has(foto.id)) {
                nueva.delete(foto.id);
            } else {
                nueva.add(foto.id);
            }

            return nueva;
        });

        this.ultimoIndice = indice;
        this.emitirSeleccion();
    }

    alternarTodas(): void {
        this.seleccionadas.update((actual) =>
            actual.size === this.fotos().length
                ? new Set<number>()
                : new Set(this.fotos().map((f) => f.id)),
        );
        this.emitirSeleccion();
    }

    limpiarSeleccion(): void {
        this.seleccionadas.set(new Set());
        this.ultimoIndice = null;
        this.emitirSeleccion();
    }

    private emitirSeleccion(): void {
        this.seleccionCambiada.emit([...this.seleccionadas()]);
    }

    onEditar(foto: FotoGaleria, evento: Event): void {
        evento.stopPropagation();
        this.editar.emit(foto);
    }

    onPortada(foto: FotoGaleria, evento: Event): void {
        evento.stopPropagation();
        this.definirPortada.emit(foto);
    }
}