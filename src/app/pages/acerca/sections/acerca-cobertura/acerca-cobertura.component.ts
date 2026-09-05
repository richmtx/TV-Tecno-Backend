import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { AcercaService } from '../../../../core/services/acerca.service';
import { ImagenTarjetaComponent } from '../../components/imagen-tarjeta/imagen-tarjeta.component';
import type { AcercaContenido, AcercaImagen, AcercaItem, ActualizarContenidoPayload } from '../../../../core/models/acerca.model';

const MAX = {
    eyebrow: 40,
    titulo: 120,
    texto: 400,
    item: 60,
    subtitulo: 40,
};

/** Nombre legible de cada hueco de imagen. */
const POSICIONES: Record<string, string> = {
    cobertura_torre: 'Imagen izquierda',
    cobertura_cabina: 'Imagen derecha',
};

/** Cómo se recorta cada hueco en el sitio público. */
const RECORTES: Record<string, string> = {
    cobertura_torre: 'Se recorta en formato vertical (3:4). Deja lo importante al centro.',
    cobertura_cabina: 'Se recorta casi cuadrado (4:3). Deja lo importante al centro.',
};

/**
 * Bloque de cobertura de la página "Acerca de".
 *
 * Reúne tres cosas que se guardan por vías distintas: los textos
 * de prosa van al endpoint de contenido a través del contenedor,
 * los renglones e indicadores son items con su propio PUT, y cada
 * imagen se guarda desde su tarjeta.
 */
@Component({
    selector: 'app-acerca-cobertura',
    standalone: true,
    imports: [ReactiveFormsModule, ImagenTarjetaComponent],
    templateUrl: './acerca-cobertura.component.html',
    styleUrl: './acerca-cobertura.component.css',
})
export class AcercaCoberturaComponent {
    private readonly service = inject(AcercaService);
    private readonly fb = inject(FormBuilder);

    readonly contenido = input.required<AcercaContenido>();

    /** Los tres renglones de la lista. */
    readonly renglones = input.required<AcercaItem[]>();

    /** Los tres indicadores: 16.1, 24/7, HD. */
    readonly stats = input.required<AcercaItem[]>();

    readonly imagenes = input.required<AcercaImagen[]>();

    readonly guardarProsa = input.required<(cambios: Partial<ActualizarContenidoPayload>) => Promise<boolean>>();

    readonly renglonesGuardados = output<AcercaItem[]>();
    readonly statsGuardados = output<AcercaItem[]>();
    readonly imagenGuardada = output<AcercaImagen>();

    readonly guardando = signal(false);
    readonly errorFormulario = signal<string | null>(null);

    readonly maximos = MAX;

    readonly formulario = this.fb.group({
        coberturaEyebrow: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.eyebrow)]),
        coberturaTitulo: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.titulo)]),
        coberturaTexto: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.texto)]),

        renglon1: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.item)]),
        renglon2: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.item)]),
        renglon3: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.item)]),

        stat1: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.item)]),
        stat1Sub: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.subtitulo)]),
        stat2: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.item)]),
        stat2Sub: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.subtitulo)]),
        stat3: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.item)]),
        stat3Sub: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.subtitulo)]),
    });

    private readonly cambios = toSignal(this.formulario.valueChanges, { initialValue: null });

    readonly sucio = computed(() => {
        this.cambios();
        return this.formulario.dirty;
    });

    readonly largoTexto = computed(() => {
        this.cambios();
        return this.formulario.controls.coberturaTexto.value.length;
    });

    constructor() {
        effect(() => {
            this.formulario.reset(this.valoresIniciales());
        });
    }

    /** Los valores tal como están guardados, para llenar y descartar. */
    private valoresIniciales() {
        const datos = this.contenido();
        const lista = this.renglones();
        const indicadores = this.stats();

        return {
            coberturaEyebrow: datos.coberturaEyebrow,
            coberturaTitulo: datos.coberturaTitulo,
            coberturaTexto: datos.coberturaTexto,

            renglon1: lista[0]?.titulo ?? '',
            renglon2: lista[1]?.titulo ?? '',
            renglon3: lista[2]?.titulo ?? '',

            stat1: indicadores[0]?.titulo ?? '',
            stat1Sub: indicadores[0]?.subtitulo ?? '',
            stat2: indicadores[1]?.titulo ?? '',
            stat2Sub: indicadores[1]?.subtitulo ?? '',
            stat3: indicadores[2]?.titulo ?? '',
            stat3Sub: indicadores[2]?.subtitulo ?? '',
        };
    }

    posicionDe(clave: string): string {
        return POSICIONES[clave] ?? '';
    }

    recorteDe(clave: string): string {
        return RECORTES[clave] ?? '';
    }

    /* ===========================================
       Guardar
       =========================================== */

    async guardar(): Promise<void> {
        if (this.formulario.invalid) {
            this.formulario.markAllAsTouched();
            this.errorFormulario.set('Revisa los campos: hay textos vacíos o demasiado largos.');
            return;
        }

        this.guardando.set(true);
        this.errorFormulario.set(null);

        const v = this.formulario.getRawValue();

        const prosa = this.guardarProsa()({
            coberturaEyebrow: v.coberturaEyebrow.trim(),
            coberturaTitulo: v.coberturaTitulo.trim(),
            coberturaTexto: v.coberturaTexto.trim(),
        });

        const lista = this.renglones();
        const indicadores = this.stats();

        const textosRenglones = [v.renglon1.trim(), v.renglon2.trim(), v.renglon3.trim()];
        const textosStats = [
            { titulo: v.stat1.trim(), subtitulo: v.stat1Sub.trim() },
            { titulo: v.stat2.trim(), subtitulo: v.stat2Sub.trim() },
            { titulo: v.stat3.trim(), subtitulo: v.stat3Sub.trim() },
        ];

        // Los renglones conservan su icono: el editor cambia el texto,
        // no el símbolo que lo acompaña.
        const guardadosRenglones = textosRenglones.map((titulo, i) =>
            this.guardarItem(lista[i]?.clave, { titulo, icono: lista[i]?.icono ?? null }),
        );

        const guardadosStats = textosStats.map((datos, i) =>
            this.guardarItem(indicadores[i]?.clave, datos),
        );

        const resultados = await Promise.all([prosa, ...guardadosRenglones, ...guardadosStats]);
        this.guardando.set(false);

        if (resultados.every(Boolean)) {
            this.formulario.markAsPristine();

            this.renglonesGuardados.emit(
                lista.map((item, i) => ({ ...item, titulo: textosRenglones[i] })),
            );
            this.statsGuardados.emit(
                indicadores.map((item, i) => ({
                    ...item,
                    titulo: textosStats[i].titulo,
                    subtitulo: textosStats[i].subtitulo,
                })),
            );
        } else {
            this.errorFormulario.set('Algunos cambios no se pudieron guardar. Vuelve a intentarlo.');
        }
    }

    /** Persiste un item. Devuelve false si falló, sin lanzar. */
    private guardarItem(
        clave: string | undefined,
        datos: { titulo: string; subtitulo?: string | null; icono?: string | null },
    ): Promise<boolean> {
        if (!clave) return Promise.resolve(true);

        return new Promise((resolver) => {
            this.service.actualizarItem(clave, datos).subscribe({
                next: () => resolver(true),
                error: () => resolver(false),
            });
        });
    }

    descartar(): void {
        this.formulario.reset(this.valoresIniciales());
        this.errorFormulario.set(null);
    }
}