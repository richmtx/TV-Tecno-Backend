import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { AcercaService } from '../../../../core/services/acerca.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import type { AcercaContenido, AcercaItem, ActualizarContenidoPayload } from '../../../../core/models/acerca.model';

/** Límites de la base de datos, replicados para avisar antes de enviar. */
const MAX = {
    eyebrow: 40,
    mvTitulo: 80,
    titulo: 120,
    texto: 600,
    valor: 60,
};

/**
 * Misión, visión y valores de la página "Acerca de".
 *
 * Los seis campos de prosa se guardan juntos contra el endpoint de
 * contenido; los tres valores son items independientes y cada uno
 * tiene su propio PUT. Por eso el botón de guardar de la sección
 * dispara ambas cosas y espera a que todas terminen.
 */
@Component({
    selector: 'app-acerca-mision-vision',
    standalone: true,
    imports: [ReactiveFormsModule],
    templateUrl: './acerca-mision-vision.component.html',
    styleUrl: './acerca-mision-vision.component.css',
})
export class AcercaMisionVisionComponent {
    private readonly service = inject(AcercaService);
    private readonly avisos = inject(NotificacionesService);
    private readonly fb = inject(FormBuilder);

    /** Copia maestra de la prosa, provista por el contenedor. */
    readonly contenido = input.required<AcercaContenido>();

    /** Los tres valores, en su orden. */
    readonly valores = input.required<AcercaItem[]>();

    /**
     * Pide al contenedor que persista los campos de prosa.
     * El contenedor los mezcla con los seis que esta sección no
     * toca antes de enviar el PUT completo.
     */
    readonly guardarProsa = input.required<(cambios: Partial<ActualizarContenidoPayload>) => Promise<boolean>>();

    /** Avisa al contenedor que los valores cambiaron. */
    readonly valoresGuardados = output<AcercaItem[]>();

    readonly guardando = signal(false);
    readonly errorFormulario = signal<string | null>(null);

    readonly maximos = MAX;

    readonly formulario = this.fb.group({
        mvEyebrow: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.eyebrow)]),
        mvTitulo: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.mvTitulo)]),
        misionTitulo: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.titulo)]),
        misionTexto: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.texto)]),
        visionTitulo: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.titulo)]),
        visionTexto: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.texto)]),
        valor1: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.valor)]),
        valor2: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.valor)]),
        valor3: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.valor)]),
    });

    /**
     * Espejo del estado del formulario.
     * Los Reactive Forms no son reactivos para los signals, así que
     * el indicador de cambios sin guardar necesita esta suscripción.
     */
    private readonly cambios = toSignal(this.formulario.valueChanges, { initialValue: null });

    /** Hay ediciones que todavía no se han enviado. */
    readonly sucio = computed(() => {
        this.cambios();
        return this.formulario.dirty;
    });

    /** Contadores de caracteres de los campos largos. */
    readonly largoMision = computed(() => {
        this.cambios();
        return this.formulario.controls.misionTexto.value.length;
    });

    readonly largoVision = computed(() => {
        this.cambios();
        return this.formulario.controls.visionTexto.value.length;
    });

    constructor() {
        // Cada vez que el contenedor entrega datos nuevos, el
        // formulario se rellena y vuelve a quedar limpio.
        effect(() => {
            const datos = this.contenido();
            const valores = this.valores();

            this.formulario.reset({
                mvEyebrow: datos.mvEyebrow,
                mvTitulo: datos.mvTitulo,
                misionTitulo: datos.misionTitulo,
                misionTexto: datos.misionTexto,
                visionTitulo: datos.visionTitulo,
                visionTexto: datos.visionTexto,
                valor1: valores[0]?.titulo ?? '',
                valor2: valores[1]?.titulo ?? '',
                valor3: valores[2]?.titulo ?? '',
            });
        });
    }

    /* ===========================================
       Guardar
       =========================================== */

    async guardar(): Promise<void> {
        if (this.formulario.invalid) {
            this.formulario.markAllAsTouched();
            this.errorFormulario.set('Revisa los campos marcados: hay textos vacíos o demasiado largos.');
            return;
        }

        this.guardando.set(true);
        this.errorFormulario.set(null);

        const v = this.formulario.getRawValue();

        // La prosa va en un solo PUT; los valores, uno por uno.
        // Se lanzan juntos porque no dependen entre sí.
        const prosa = this.guardarProsa()({
            mvEyebrow: v.mvEyebrow.trim(),
            mvTitulo: v.mvTitulo.trim(),
            misionTitulo: v.misionTitulo.trim(),
            misionTexto: v.misionTexto.trim(),
            visionTitulo: v.visionTitulo.trim(),
            visionTexto: v.visionTexto.trim(),
        });

        const nuevosValores = [v.valor1.trim(), v.valor2.trim(), v.valor3.trim()];
        const items = this.valores();

        const guardados = nuevosValores.map((titulo, i) => this.guardarValor(items[i]?.clave, titulo));

        const resultados = await Promise.all([prosa, ...guardados]);
        this.guardando.set(false);

        if (resultados.every(Boolean)) {
            this.formulario.markAsPristine();
            this.valoresGuardados.emit(
                items.map((item, i) => ({ ...item, titulo: nuevosValores[i] })),
            );
        } else {
            this.errorFormulario.set('Algunos cambios no se pudieron guardar. Vuelve a intentarlo.');
        }
    }

    /** Persiste un valor. Devuelve false si falló, sin lanzar. */
    private guardarValor(clave: string | undefined, titulo: string): Promise<boolean> {
        if (!clave) return Promise.resolve(true);

        return new Promise((resolver) => {
            this.service.actualizarItem(clave, { titulo }).subscribe({
                next: () => resolver(true),
                error: () => resolver(false),
            });
        });
    }

    /** Descarta las ediciones y recupera lo último guardado. */
    descartar(): void {
        const datos = this.contenido();
        const valores = this.valores();

        this.formulario.reset({
            mvEyebrow: datos.mvEyebrow,
            mvTitulo: datos.mvTitulo,
            misionTitulo: datos.misionTitulo,
            misionTexto: datos.misionTexto,
            visionTitulo: datos.visionTitulo,
            visionTexto: datos.visionTexto,
            valor1: valores[0]?.titulo ?? '',
            valor2: valores[1]?.titulo ?? '',
            valor3: valores[2]?.titulo ?? '',
        });
        this.errorFormulario.set(null);
    }
}