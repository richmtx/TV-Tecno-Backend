import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ContactoService } from '../../../../core/services/contacto.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import { AuthService } from '../../../../core/services/auth.service';
import type { RedCatalogo, RedSocial } from '../../../../core/models/contacto.model';

const MAX = {
    url: 255,
    etiqueta: 60,
};

/**
 * Cuentas del canal en redes sociales.
 *
 * A diferencia del resto del contenido institucional, esta lista sí
 * crece y se encoge: las plataformas cambian con los años. Lo que
 * no cambia desde aquí es el catálogo de íconos disponibles, porque
 * cada uno requiere dibujar su SVG en los dos sitios.
 */
@Component({
    selector: 'app-contacto-redes',
    standalone: true,
    imports: [ReactiveFormsModule],
    templateUrl: './contacto-redes.component.html',
    styleUrl: './contacto-redes.component.css',
})
export class ContactoRedesComponent {
    private readonly service = inject(ContactoService);
    private readonly avisos = inject(NotificacionesService);
    private readonly auth = inject(AuthService);
    private readonly fb = inject(FormBuilder);

    readonly maximos = MAX;

    readonly redes = signal<RedSocial[]>([]);
    readonly catalogo = signal<RedCatalogo[]>([]);

    readonly cargando = signal(true);
    readonly error = signal<string | null>(null);

    readonly modalAbierto = signal(false);
    readonly editando = signal<RedSocial | null>(null);
    readonly guardando = signal(false);
    readonly errorFormulario = signal<string | null>(null);

    readonly confirmandoEliminacion = signal<RedSocial | null>(null);
    readonly eliminando = signal(false);

    readonly reordenando = signal(false);
    readonly indiceArrastrado = signal<number | null>(null);
    private readonly arrastreActivo = signal(false);

    readonly total = computed(() => this.redes().length);
    readonly esAdmin = computed(() => this.auth.usuario()?.rol === 'admin');

    /**
     * Plataformas que aún no tienen cuenta.
     * El backend rechaza duplicados, así que conviene no ofrecer
     * las que ya están registradas.
     */
    readonly disponibles = computed(() => {
        const usadas = new Set(this.redes().map((red) => red.clave));
        return this.catalogo().filter((plataforma) => !usadas.has(plataforma.clave));
    });

    readonly sinDisponibles = computed(() => this.disponibles().length === 0);

    readonly formulario = this.fb.group({
        catalogoId: this.fb.nonNullable.control(0, [Validators.required, Validators.min(1)]),
        url: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^https:\/\/.+/), Validators.maxLength(MAX.url)]),
        etiqueta: this.fb.nonNullable.control('', [Validators.maxLength(MAX.etiqueta)]),
        activo: this.fb.nonNullable.control(true),
    });

    private readonly cambios = toSignal(this.formulario.valueChanges, { initialValue: null });

    /**
     * Aviso cuando la dirección no parece de la plataforma elegida.
     * No bloquea el guardado: hay enlaces cortos legítimos como
     * fb.me o youtu.be.
     */
    readonly avisoDominio = computed<string | null>(() => {
        this.cambios();

        const url = this.formulario.controls.url.value.trim();
        if (!url) return null;

        const id = Number(this.formulario.controls.catalogoId.value);
        const plataforma = this.catalogo().find((p) => p.id === id);
        if (!plataforma) return null;

        if (!this.service.dominioNoCoincide(url, plataforma.dominio)) return null;

        return `La dirección no contiene "${plataforma.dominio}". Verifica que sea la cuenta correcta.`;
    });

    constructor() {
        this.cargar();
    }

    /* ===========================================
       Carga
       =========================================== */

    cargar(): void {
        this.cargando.set(true);
        this.error.set(null);

        this.service.listarRedes().subscribe({
            next: (redes) => {
                this.redes.set(redes);
                this.cargando.set(false);
            },
            error: (e) => {
                this.cargando.set(false);
                this.error.set(
                    this.service.mensajeDeError(e, 'No se pudieron cargar las redes sociales.'),
                );
            },
        });

        this.service.listarCatalogo().subscribe({
            next: (catalogo) => this.catalogo.set(catalogo),
            error: () => this.catalogo.set([]),
        });
    }

    /* ===========================================
       Modal de creación y edición
       =========================================== */

    abrirModalCrear(): void {
        this.editando.set(null);
        this.errorFormulario.set(null);

        // Se propone la primera plataforma libre para que el
        // formulario nunca abra con el selector en blanco.
        const primera = this.disponibles()[0];

        this.formulario.reset({
            catalogoId: primera?.id ?? 0,
            url: '',
            etiqueta: '',
            activo: true,
        });

        this.modalAbierto.set(true);
    }

    abrirModalEditar(red: RedSocial): void {
        this.editando.set(red);
        this.errorFormulario.set(null);

        const plataforma = this.catalogo().find((p) => p.clave === red.clave);

        this.formulario.reset({
            catalogoId: plataforma?.id ?? 0,
            url: red.url,
            etiqueta: red.etiqueta ?? '',
            activo: red.activo,
        });

        this.modalAbierto.set(true);
    }

    cerrarModal(): void {
        if (this.guardando()) return;
        this.modalAbierto.set(false);
        this.editando.set(null);
    }

    guardar(): void {
        if (this.formulario.invalid) {
            this.formulario.markAllAsTouched();
            this.errorFormulario.set('Elige una plataforma y escribe una dirección que empiece con https://');
            return;
        }

        this.guardando.set(true);
        this.errorFormulario.set(null);

        const v = this.formulario.getRawValue();
        const actual = this.editando();

        const peticion = actual
            ? this.service.actualizarRed(actual.id, {
                url: v.url.trim(),
                etiqueta: v.etiqueta.trim() || null,
                activo: v.activo,
            })
            : this.service.crearRed({
                catalogoId: Number(v.catalogoId),
                url: v.url.trim(),
                etiqueta: v.etiqueta.trim() || undefined,
            });

        peticion.subscribe({
            next: (guardada) => {
                this.guardando.set(false);
                this.modalAbierto.set(false);

                if (actual) {
                    this.redes.update((lista) =>
                        lista.map((red) => (red.id === guardada.id ? guardada : red)),
                    );
                    this.avisos.exito('Red social actualizada.');
                } else {
                    this.redes.update((lista) => [...lista, guardada]);
                    this.avisos.exito('Red social agregada.');
                }

                this.editando.set(null);
            },
            error: (e) => {
                this.guardando.set(false);
                this.errorFormulario.set(
                    this.service.mensajeDeError(e, 'No se pudo guardar la red social.'),
                );
            },
        });
    }

    /* ===========================================
       Visibilidad
       =========================================== */

    /**
     * Muestra u oculta una cuenta sin perder su dirección.
     * Sirve cuando una cuenta está en construcción o pausada.
     */
    alternarVisibilidad(red: RedSocial): void {
        this.service.actualizarRed(red.id, { url: red.url, activo: !red.activo }).subscribe({
            next: (actualizada) => {
                this.redes.update((lista) =>
                    lista.map((actual) => (actual.id === actualizada.id ? actualizada : actual)),
                );
                this.avisos.exito(
                    actualizada.activo ? 'Ahora se muestra en el sitio.' : 'Se ocultó del sitio.',
                );
            },
            error: (e) => {
                this.avisos.error(
                    this.service.mensajeDeError(e, 'No se pudo cambiar la visibilidad.'),
                );
            },
        });
    }

    /* ===========================================
       Eliminación
       =========================================== */

    pedirConfirmacionEliminar(red: RedSocial): void {
        this.confirmandoEliminacion.set(red);
    }

    cancelarEliminacion(): void {
        if (this.eliminando()) return;
        this.confirmandoEliminacion.set(null);
    }

    confirmarEliminacion(): void {
        const objetivo = this.confirmandoEliminacion();
        if (!objetivo) return;

        this.eliminando.set(true);

        this.service.eliminarRed(objetivo.id).subscribe({
            next: () => {
                this.eliminando.set(false);
                this.confirmandoEliminacion.set(null);
                this.redes.update((lista) => lista.filter((red) => red.id !== objetivo.id));
                this.avisos.exito('Red social eliminada.');
            },
            error: (e) => {
                this.eliminando.set(false);
                this.confirmandoEliminacion.set(null);
                this.avisos.error(
                    this.service.mensajeDeError(e, 'No se pudo eliminar la red social.'),
                );
            },
        });
    }

    /* ===========================================
       Reordenamiento
       =========================================== */

    puedeArrastrar(): boolean {
        return this.arrastreActivo();
    }

    activarArrastre(): void {
        this.arrastreActivo.set(true);
    }

    desactivarArrastre(): void {
        this.arrastreActivo.set(false);
    }

    alIniciarArrastre(indice: number, evento: DragEvent): void {
        this.indiceArrastrado.set(indice);
        evento.dataTransfer?.setData('text/plain', String(indice));
    }

    alPasarSobre(indice: number, evento: DragEvent): void {
        evento.preventDefault();

        const origen = this.indiceArrastrado();
        if (origen === null || origen === indice) return;

        this.redes.update((lista) => {
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

    /** Al soltar se persiste el orden completo. */
    alTerminarArrastre(): void {
        this.indiceArrastrado.set(null);
        this.desactivarArrastre();

        const ids = this.redes().map((red) => red.id);
        if (ids.length < 2) return;

        this.reordenando.set(true);

        this.service.reordenarRedes(ids).subscribe({
            next: () => this.reordenando.set(false),
            error: (e) => {
                this.reordenando.set(false);
                this.avisos.error(
                    this.service.mensajeDeError(e, 'No se pudo guardar el nuevo orden.'),
                );
                // El orden en pantalla ya no coincide con la base:
                // se recarga para no dejar al editor con una lista falsa.
                this.cargar();
            },
        });
    }
}