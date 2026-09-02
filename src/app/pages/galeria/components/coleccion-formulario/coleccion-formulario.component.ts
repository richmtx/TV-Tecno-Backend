import { Component, HostListener, computed, effect, inject, input, output, signal, } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { GaleriaService } from '../../../../core/services/galeria.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import type { CategoriaGaleria, Coleccion, SeccionGaleria, } from '../../../../core/models/galeria.model';

const ANIO_MINIMO = 1900;
const ANIO_MAXIMO = 2200;

/**
 * Modal para crear y editar colecciones.
 *
 * El formulario se adapta a la sección: los campos de año solo
 * aparecen donde la sección los usa, y lo mismo con la categoría.
 * Así el administrador nunca ve un campo que no le corresponde.
 */
@Component({
    selector: 'app-coleccion-formulario',
    standalone: true,
    imports: [ReactiveFormsModule],
    templateUrl: './coleccion-formulario.component.html',
    styleUrl: './coleccion-formulario.component.css',
})
export class ColeccionFormularioComponent {
    private readonly service = inject(GaleriaService);
    private readonly avisos = inject(NotificacionesService);
    private readonly fb = inject(FormBuilder);

    /** Sección en la que se trabaja. */
    readonly seccion = input.required<SeccionGaleria>();

    /** Colección a editar, o null para crear una nueva. */
    readonly coleccion = input<Coleccion | null>(null);

    /** Colecciones existentes de la sección, para sugerir años. */
    readonly hermanas = input<Coleccion[]>([]);

    readonly guardado = output<Coleccion>();
    readonly cerrado = output<void>();

    readonly categorias = signal<CategoriaGaleria[]>([]);
    readonly guardando = signal(false);
    readonly errorFormulario = signal<string | null>(null);

    readonly esEdicion = computed(() => this.coleccion() !== null);

    /** Espejo de los campos que el aviso necesita observar. */
    readonly esActual = signal(false);
    readonly anioInicio = signal<number | null>(null);

    readonly titulo = computed(() =>
        this.esEdicion() ? 'Editar colección' : 'Nueva colección',
    );

    readonly formulario = this.fb.group({
        titulo: this.fb.nonNullable.control('', [Validators.maxLength(120)]),
        slug: this.fb.nonNullable.control(''),
        subtitulo: this.fb.nonNullable.control('', [Validators.maxLength(120)]),
        descripcion: this.fb.nonNullable.control('', [Validators.maxLength(300)]),
        categoriaId: this.fb.nonNullable.control(0),
        anioInicio: this.fb.control<number | null>(null),
        anioFin: this.fb.control<number | null>(null),
        esActual: this.fb.nonNullable.control(false),
    });

    constructor() {
        // Al abrirse el modal se cargan las categorías y se llena el
        // formulario con los datos de la colección, si la hay.
        effect(() => {
            const seccion = this.seccion();
            if (seccion.usaCategorias) {
                this.cargarCategorias(seccion.id);
            } else {
                this.categorias.set([]);
            }
            this.prepararFormulario();
        });

        // Los signals espejo permiten que el aviso reaccione a los
        // cambios del formulario, que por sí solo no es reactivo.
        this.formulario.controls.esActual.valueChanges.subscribe((v) =>
            this.esActual.set(v),
        );
        this.formulario.controls.anioInicio.valueChanges.subscribe((v) =>
            this.anioInicio.set(v),
        );
    }

    private cargarCategorias(seccionId: number): void {
        this.service.listarCategorias(seccionId).subscribe({
            next: (categorias) => this.categorias.set(categorias),
            error: () =>
                this.errorFormulario.set('No se pudieron cargar las categorías.'),
        });
    }

    /**
 * Llena el formulario. Al crear una época, el año de inicio se
 * propone a partir de la última existente para que el
 * administrador no tenga que calcularlo.
 */
    private prepararFormulario(): void {
        const actual = this.coleccion();
        this.errorFormulario.set(null);

        if (actual) {
            this.formulario.reset({
                titulo: actual.titulo,
                slug: actual.slug,
                subtitulo: actual.subtitulo ?? '',
                descripcion: actual.descripcion ?? '',
                categoriaId: actual.categoriaId ?? 0,
                anioInicio: actual.anioInicio,
                anioFin: actual.anioFin,
                esActual: actual.esActual,
            });
            return;
        }

        this.formulario.reset({
            titulo: '',
            slug: '',
            subtitulo: '',
            descripcion: '',
            categoriaId: 0,
            anioInicio: this.anioSugerido(),
            anioFin: null,
            esActual: false,
        });
    }

    /** Año siguiente al final de la última colección de la sección. */
    private anioSugerido(): number | null {
        if (!this.seccion().usaRangoAnios) return null;

        const finales = this.hermanas()
            .map((c) => c.anioFin ?? c.anioInicio ?? 0)
            .filter((a) => a > 0);

        if (finales.length === 0) return null;
        return Math.max(...finales) + 1;
    }

    /**
     * Aviso sobre la época que se cerrará automáticamente.
     * El backend ajusta el año final de la época vigente cuando se
     * abre una nueva; conviene decirlo antes de guardar.
     */
    readonly avisoEpocaAbierta = computed<string | null>(() => {
        if (!this.seccion().usaRangoAnios) return null;
        if (!this.esActual()) return null;

        const propia = this.coleccion()?.id;
        const abierta = this.hermanas().find((c) => c.esActual && c.id !== propia);
        if (!abierta) return null;

        const inicio = this.anioInicio();
        if (!inicio) return null;

        return `Al guardar, "${abierta.titulo}" se cerrará en ${inicio - 1}.`;
    });

    /** Rellena el título con el rango de años al salir de los campos. */
    alSalirDeAnios(): void {
        if (!this.seccion().usaRangoAnios) return;

        const v = this.formulario.getRawValue();
        if (!v.anioInicio) return;

        const compuesto = this.tituloDeEpoca(
            v.anioInicio,
            v.anioFin,
            v.esActual,
        );

        // Solo se sobrescribe si el título está vacío o sigue siendo
        // un rango generado: un título escrito a mano se respeta.
        const actual = v.titulo.trim();
        const esRango = /^\d{4}( - (\d{4}|Actualidad))?$/.test(actual);

        if (!actual || esRango) {
            this.formulario.controls.titulo.setValue(compuesto);
        }
    }

    /** El título de una época se compone de sus años. */
    private tituloDeEpoca(
        inicio: number,
        fin: number | null,
        esActual: boolean,
    ): string {
        if (esActual) return `${inicio} - Actualidad`;
        if (!fin) return String(inicio);
        return `${inicio} - ${fin}`;
    }

    alCambiarActual(): void {
        if (this.formulario.controls.esActual.value) {
            this.formulario.controls.anioFin.setValue(null);
        }
        this.alSalirDeAnios();
    }

    /* ===========================================
       Guardar
       =========================================== */

    guardar(): void {
        const v = this.formulario.getRawValue();
        const seccion = this.seccion();

        const titulo = v.titulo.trim();
        if (!titulo) {
            this.errorFormulario.set('El título es obligatorio.');
            return;
        }

        // Las validaciones de año corren aquí además del servidor para
        // responder al instante en lugar de esperar el rechazo.
        if (seccion.usaRangoAnios) {
            const error = this.validarAnios(v.anioInicio, v.anioFin, v.esActual);
            if (error) {
                this.errorFormulario.set(error);
                return;
            }
        }

        this.guardando.set(true);
        this.errorFormulario.set(null);

        const actual = this.coleccion();
        const datos = {
            titulo,
            subtitulo: v.subtitulo.trim() || undefined,
            descripcion: v.descripcion.trim() || undefined,
            categoriaId: v.categoriaId || undefined,
            anioInicio: v.anioInicio ?? undefined,
            anioFin: v.esActual ? undefined : (v.anioFin ?? undefined),
            esActual: seccion.usaRangoAnios ? v.esActual : undefined,
        };

        const peticion = actual
            ? this.service.actualizarColeccion(actual.id, {
                ...datos,
                slug: v.slug.trim() || undefined,
            })
            : this.service.crearColeccion({ ...datos, seccionId: seccion.id });

        peticion.subscribe({
            next: (guardada) => {
                this.guardando.set(false);
                this.avisos.exito(
                    actual ? 'Colección actualizada.' : 'Colección creada.',
                );
                this.guardado.emit(guardada);
            },
            error: (e) => {
                this.guardando.set(false);
                this.errorFormulario.set(
                    this.service.mensajeDeError(e, 'No se pudo guardar la colección.'),
                );
            },
        });
    }

    /** Comprobaciones locales del rango de años. */
    private validarAnios(
        inicio: number | null,
        fin: number | null,
        esActual: boolean,
    ): string | null {
        if (!inicio) {
            return 'Indica el año en que inicia esta época.';
        }
        if (inicio < ANIO_MINIMO || inicio > ANIO_MAXIMO) {
            return `El año inicial debe estar entre ${ANIO_MINIMO} y ${ANIO_MAXIMO}.`;
        }
        if (esActual) return null;

        if (!fin) {
            return 'Indica el año en que termina, o marca la época como vigente.';
        }
        if (fin < inicio) {
            return 'El año final no puede ser anterior al año inicial.';
        }
        return null;
    }

    /* ===========================================
       Cerrar
       =========================================== */

    cerrar(): void {
        if (this.guardando()) return;
        this.cerrado.emit();
    }

    @HostListener('document:keydown.escape')
    cerrarConEscape(): void {
        this.cerrar();
    }
}