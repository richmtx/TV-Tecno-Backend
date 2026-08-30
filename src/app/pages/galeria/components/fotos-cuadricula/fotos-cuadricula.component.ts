import { Component, computed, inject, input, output, signal } from '@angular/core';
import { GaleriaService } from '../../../../core/services/galeria.service';
import type { FotoGaleria } from '../../../../core/models/galeria.model';

/**
 * Cuadrícula de fotografías con selección múltiple y reordenamiento.
 *
 * El clic selecciona y el asa arrastra: separar los dos gestos evita
 * que un intento de seleccionar termine moviendo una foto de sitio,
 * que con cien imágenes en pantalla ocurriría a menudo.
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

    /** Mientras se guarda el nuevo orden, la cuadrícula se bloquea. */
    readonly reordenando = input<boolean>(false);

    readonly seleccionCambiada = output<number[]>();
    readonly editar = output<FotoGaleria>();
    readonly definirPortada = output<FotoGaleria>();

    /** Se emite con el orden nuevo cuando el arrastre termina. */
    readonly ordenCambiado = output<FotoGaleria[]>();

    readonly seleccionadas = signal<Set<number>>(new Set());

    readonly totalSeleccionadas = computed(() => this.seleccionadas().size);

    readonly todasSeleccionadas = computed(
        () =>
            this.fotos().length > 0 &&
            this.seleccionadas().size === this.fotos().length,
    );

    /** Índice de la última foto marcada, para la selección por rango. */
    private ultimoIndice: number | null = null;

    /* ===========================================
       Reordenamiento
       El atributo `draggable` solo se activa cuando el puntero baja
       sobre el asa, para no arrastrar desde cualquier parte.
       =========================================== */

    readonly indiceArrastrado = signal<number | null>(null);
    readonly puedeArrastrar = signal(false);

    /** Copia local que se reordena mientras dura el arrastre. */
    private readonly ordenLocal = signal<FotoGaleria[] | null>(null);

    /** Lista visible: la local durante el arrastre, la real si no. */
    readonly visibles = computed<FotoGaleria[]>(
        () => this.ordenLocal() ?? this.fotos(),
    );

    activarArrastre(): void {
        if (!this.reordenando()) this.puedeArrastrar.set(true);
    }

    desactivarArrastre(): void {
        this.puedeArrastrar.set(false);
    }

    alIniciarArrastre(indice: number, evento: DragEvent): void {
        if (!this.puedeArrastrar()) {
            evento.preventDefault();
            return;
        }

        this.ordenLocal.set([...this.fotos()]);
        this.indiceArrastrado.set(indice);

        if (evento.dataTransfer) {
            evento.dataTransfer.effectAllowed = 'move';
            // Firefox no dispara el arrastre si no se escribe algo aquí.
            evento.dataTransfer.setData('text/plain', String(indice));
        }
    }

    alPasarSobre(indice: number, evento: DragEvent): void {
        evento.preventDefault();

        const origen = this.indiceArrastrado();
        if (origen === null || origen === indice) return;

        this.ordenLocal.update((lista) => {
            if (!lista) return lista;
            const copia = [...lista];
            const [movida] = copia.splice(origen, 1);
            copia.splice(indice, 0, movida);
            return copia;
        });

        this.indiceArrastrado.set(indice);
    }

    alSoltar(evento: DragEvent): void {
        evento.preventDefault();
    }

    alTerminarArrastre(): void {
        const nuevo = this.ordenLocal();
        this.indiceArrastrado.set(null);
        this.puedeArrastrar.set(false);
        this.ordenLocal.set(null);

        if (!nuevo) return;

        const idsNuevos = nuevo.map((f) => f.id);
        const idsPrevios = this.fotos().map((f) => f.id);

        // Si se soltó en el mismo lugar, no hay nada que guardar.
        if (idsNuevos.join() === idsPrevios.join()) return;

        this.ordenCambiado.emit(nuevo);
    }

    /* ===========================================
       Presentación
       =========================================== */

    url(foto: FotoGaleria): string | null {
        return this.service.urlAbsoluta(foto.urls.thumb);
    }

    estaSeleccionada(id: number): boolean {
        return this.seleccionadas().has(id);
    }

    /* ===========================================
       Selección
       =========================================== */

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
                    nueva.add(this.visibles()[i].id);
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

    /* ===========================================
       Acciones por fotografía
       =========================================== */

    onEditar(foto: FotoGaleria, evento: Event): void {
        evento.stopPropagation();
        this.editar.emit(foto);
    }

    onPortada(foto: FotoGaleria, evento: Event): void {
        evento.stopPropagation();
        this.definirPortada.emit(foto);
    }
}