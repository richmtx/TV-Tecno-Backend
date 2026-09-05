import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { AcercaService } from '../../../../core/services/acerca.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import type { AcercaImagen } from '../../../../core/models/acerca.model';

const MAX = {
    etiqueta: 40,
    alt: 160,
};

/**
 * Tarjeta de una imagen de posición fija.
 *
 * El archivo es opcional en cada guardado: si el editor solo
 * corrige la etiqueta, no hace falta volver a subir la foto. La
 * vista previa muestra el archivo elegido antes de enviarlo, para
 * que se vea qué se va a reemplazar.
 */
@Component({
    selector: 'app-imagen-tarjeta',
    standalone: true,
    imports: [ReactiveFormsModule],
    templateUrl: './imagen-tarjeta.component.html',
    styleUrl: './imagen-tarjeta.component.css',
})
export class ImagenTarjetaComponent {
    private readonly service = inject(AcercaService);
    private readonly avisos = inject(NotificacionesService);
    private readonly fb = inject(FormBuilder);

    readonly imagen = input.required<AcercaImagen>();

    /** Nombre del hueco, para orientar al editor. */
    readonly posicion = input<string>('');

    readonly guardada = output<AcercaImagen>();

    readonly guardando = signal(false);
    readonly errorTarjeta = signal<string | null>(null);

    /** Archivo elegido que todavía no se ha enviado. */
    readonly archivo = signal<File | null>(null);

    /** URL temporal del archivo elegido, para la vista previa. */
    readonly vistaPrevia = signal<string | null>(null);

    readonly maximos = MAX;

    readonly formulario = this.fb.group({
        etiqueta: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.etiqueta)]),
        alt: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.alt)]),
    });

    private readonly cambios = toSignal(this.formulario.valueChanges, { initialValue: null });

    /** Hay textos editados o un archivo nuevo pendiente de enviar. */
    readonly sucio = computed(() => {
        this.cambios();
        return this.formulario.dirty || this.archivo() !== null;
    });

    /** La imagen que se muestra: la elegida, o la guardada. */
    readonly urlMostrada = computed(() => {
        const previa = this.vistaPrevia();
        if (previa) return previa;
        return this.service.urlAbsoluta(this.imagen().urls.thumb);
    });

    /** Proporción a la que se recorta el slot, para avisar al editor. */
    readonly recorte = input<string>('');

    constructor() {
        // `untracked` evita que las lecturas de señales dentro de
        // limpiarSeleccion se registren como dependencias: sin él, elegir
        // un archivo dispararía este mismo effect y lo descartaría al
        // instante.
        effect(() => {
            const datos = this.imagen();

            untracked(() => {
                this.formulario.reset({
                    etiqueta: datos.etiqueta,
                    alt: datos.alt,
                });
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
            this.errorTarjeta.set(error);
            return;
        }

        this.limpiarSeleccion();
        this.errorTarjeta.set(null);
        this.archivo.set(elegido);
        this.vistaPrevia.set(URL.createObjectURL(elegido));
    }

    /** Descarta el archivo elegido y vuelve a la imagen guardada. */
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
            this.errorTarjeta.set('La etiqueta y el texto alternativo son obligatorios.');
            return;
        }

        this.guardando.set(true);
        this.errorTarjeta.set(null);

        const v = this.formulario.getRawValue();

        this.service
            .actualizarImagen(this.imagen().clave, v.etiqueta.trim(), v.alt.trim(), this.archivo())
            .subscribe({
                next: (actualizada) => {
                    this.guardando.set(false);
                    this.formulario.markAsPristine();
                    this.limpiarSeleccion();
                    this.avisos.exito('Imagen actualizada.');
                    this.guardada.emit(actualizada);
                },
                error: (e) => {
                    this.guardando.set(false);
                    this.errorTarjeta.set(
                        this.service.mensajeDeError(e, 'No se pudo actualizar la imagen.'),
                    );
                },
            });
    }

    descartar(): void {
        const datos = this.imagen();
        this.formulario.reset({ etiqueta: datos.etiqueta, alt: datos.alt });
        this.limpiarSeleccion();
        this.errorTarjeta.set(null);
    }
}