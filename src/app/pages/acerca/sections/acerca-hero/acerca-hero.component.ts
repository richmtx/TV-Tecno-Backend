import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ImagenTarjetaComponent } from '../../components/imagen-tarjeta/imagen-tarjeta.component';
import type { AcercaContenido, AcercaImagen, ActualizarContenidoPayload } from '../../../../core/models/acerca.model';

const MAX = {
    eyebrow: 40,
    titulo: 80,
    subtitulo: 180,
};

/** Nombre legible de cada hueco del mosaico. */
const POSICIONES: Record<string, string> = {
    hero_casa: 'Columna izquierda',
    hero_noticiero: 'Superior derecha',
    hero_entrevistas: 'Inferior izquierda',
    hero_foro: 'Inferior derecha',
};

/**
 * Encabezado de la página "Acerca de": los tres textos de entrada
 * y el mosaico de cuatro imágenes.
 *
 * Los textos comparten el endpoint de prosa con las otras
 * secciones, así que se guardan a través del contenedor. Cada
 * imagen, en cambio, tiene su propio PUT y se guarda por separado
 * desde su tarjeta.
 */
@Component({
    selector: 'app-acerca-hero',
    standalone: true,
    imports: [ReactiveFormsModule, ImagenTarjetaComponent],
    templateUrl: './acerca-hero.component.html',
    styleUrl: './acerca-hero.component.css',
})
export class AcercaHeroComponent {
    private readonly fb = inject(FormBuilder);

    readonly contenido = input.required<AcercaContenido>();
    readonly imagenes = input.required<AcercaImagen[]>();
    readonly guardarProsa = input.required<(cambios: Partial<ActualizarContenidoPayload>) => Promise<boolean>>();

    readonly imagenGuardada = output<AcercaImagen>();

    readonly guardando = signal(false);
    readonly errorFormulario = signal<string | null>(null);

    readonly maximos = MAX;

    readonly formulario = this.fb.group({
        heroEyebrow: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.eyebrow)]),
        heroTitulo: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.titulo)]),
        heroSubtitulo: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.subtitulo)]),
    });

    private readonly cambios = toSignal(this.formulario.valueChanges, { initialValue: null });

    readonly sucio = computed(() => {
        this.cambios();
        return this.formulario.dirty;
    });

    constructor() {
        effect(() => {
            const datos = this.contenido();
            this.formulario.reset({
                heroEyebrow: datos.heroEyebrow,
                heroTitulo: datos.heroTitulo,
                heroSubtitulo: datos.heroSubtitulo,
            });
        });
    }

    /** Nombre del hueco que ocupa una imagen en el mosaico. */
    posicionDe(clave: string): string {
        return POSICIONES[clave] ?? '';
    }

    async guardar(): Promise<void> {
        if (this.formulario.invalid) {
            this.formulario.markAllAsTouched();
            this.errorFormulario.set('Revisa los campos: hay textos vacíos o demasiado largos.');
            return;
        }

        this.guardando.set(true);
        this.errorFormulario.set(null);

        const v = this.formulario.getRawValue();
        const ok = await this.guardarProsa()({
            heroEyebrow: v.heroEyebrow.trim(),
            heroTitulo: v.heroTitulo.trim(),
            heroSubtitulo: v.heroSubtitulo.trim(),
        });

        this.guardando.set(false);

        if (ok) {
            this.formulario.markAsPristine();
        } else {
            this.errorFormulario.set('No se pudieron guardar los textos. Vuelve a intentarlo.');
        }
    }

    descartar(): void {
        const datos = this.contenido();
        this.formulario.reset({
            heroEyebrow: datos.heroEyebrow,
            heroTitulo: datos.heroTitulo,
            heroSubtitulo: datos.heroSubtitulo,
        });
        this.errorFormulario.set(null);
    }
}