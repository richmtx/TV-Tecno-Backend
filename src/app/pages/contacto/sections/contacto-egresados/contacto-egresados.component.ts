import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ContactoService } from '../../../../core/services/contacto.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import type { ContactoImagen } from '../../../../core/models/contacto.model';

const MAX_ALT = 160;

/** Slot de la imagen del bloque de seguimiento de egresados. */
const CLAVE = 'egresados';

/**
 * Imagen del bloque de seguimiento de egresados.
 *
 * Es un solo hueco de posición fija: la fotografía se reemplaza,
 * nunca se agrega ni se elimina. El enlace del formulario se edita
 * en la sección de medios de contacto, no aquí.
 */
@Component({
    selector: 'app-contacto-egresados',
    standalone: true,
    imports: [ReactiveFormsModule],
    templateUrl: './contacto-egresados.component.html',
    styleUrl: './contacto-egresados.component.css',
})
export class ContactoEgresadosComponent {
    private readonly service = inject(ContactoService);
    private readonly avisos = inject(NotificacionesService);
    private readonly fb = inject(FormBuilder);

    /** Las imágenes de la página; hoy solo hay una. */
    readonly imagenes = input.required<ContactoImagen[]>();

    readonly guardada = output<ContactoImagen>();

    readonly guardando = signal(false);
    readonly errorFormulario = signal<string | null>(null);

    /** Archivo elegido que todavía no se ha enviado. */
    readonly archivo = signal<File | null>(null);

    /** URL temporal del archivo elegido, para la vista previa. */
    readonly vistaPrevia = signal<string | null>(null);

    readonly maxAlt = MAX_ALT;

    readonly imagen = computed<ContactoImagen | undefined>(() =>
        this.imagenes().find((img) => img.clave === CLAVE),
    );

    readonly formulario = this.fb.group({
        alt: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX_ALT)]),
    });

    private readonly cambios = toSignal(this.formulario.valueChanges, { initialValue: null });

    readonly sucio = computed(() => {
        this.cambios();
        return this.formulario.dirty || this.archivo() !== null;
    });

    /** La imagen que se muestra: la elegida, o la guardada. */
    readonly urlMostrada = computed(() => {
        const previa = this.vistaPrevia();
        if (previa) return previa;
        return this.service.urlAbsoluta(this.imagen()?.urls.medium);
    });

    constructor() {
        // `untracked` evita que las lecturas de señales dentro de
        // limpiarSeleccion se registren como dependencias: sin él, elegir
        // un archivo dispararía este mismo effect y lo descartaría al
        // instante.
        effect(() => {
            const datos = this.imagen();

            untracked(() => {
                this.formulario.reset({ alt: datos?.alt ?? '' });
                this.limpiarSeleccion();
            });
        });
    }

    /* ===========================================
       Selección de archivo
       =========================================== */

    alElegirArchivo(evento: Event): void {
        const input = evento.target as HTMLInputElement;
        const elegido = input.files?.[0] ?? null;

        // El input se limpia siempre para que elegir el mismo archivo
        // dos veces seguidas vuelva a disparar el evento.
        input.value = '';

        if (!elegido) return;

        const error = this.service.validarImagen(elegido);
        if (error) {
            this.errorFormulario.set(error);
            return;
        }

        this.limpiarSeleccion();
        this.errorFormulario.set(null);
        this.archivo.set(elegido);
        this.vistaPrevia.set(URL.createObjectURL(elegido));
    }

    quitarArchivo(): void {
        this.limpiarSeleccion();
    }

    /** Libera la URL temporal para no acumular memoria. */
    private limpiarSeleccion(): void {
        const previa = this.vistaPrevia();
        if (previa) URL.revokeObjectURL(previa);
        this.vistaPrevia.set(null);
        this.archivo.set(null);
    }

    /* ===========================================
       Guardar
       =========================================== */

    guardar(): void {
        if (this.formulario.invalid) {
            this.formulario.markAllAsTouched();
            this.errorFormulario.set('El texto alternativo es obligatorio.');
            return;
        }

        const actual = this.imagen();
        if (!actual) return;

        this.guardando.set(true);
        this.errorFormulario.set(null);

        const alt = this.formulario.getRawValue().alt.trim();

        this.service.actualizarImagen(actual.clave, alt, this.archivo()).subscribe({
            next: (actualizada) => {
                this.guardando.set(false);
                this.formulario.markAsPristine();
                this.limpiarSeleccion();
                this.avisos.exito('Imagen actualizada.');
                this.guardada.emit(actualizada);
            },
            error: (e) => {
                this.guardando.set(false);
                this.errorFormulario.set(
                    this.service.mensajeDeError(e, 'No se pudo actualizar la imagen.'),
                );
            },
        });
    }

    descartar(): void {
        this.formulario.reset({ alt: this.imagen()?.alt ?? '' });
        this.limpiarSeleccion();
        this.errorFormulario.set(null);
    }
}