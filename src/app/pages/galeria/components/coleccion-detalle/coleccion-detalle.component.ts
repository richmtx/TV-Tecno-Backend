import { Component, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { GaleriaService } from '../../../../core/services/galeria.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import { AuthService } from '../../../../core/services/auth.service';
import { FotosSubidaComponent } from '../fotos-subida/fotos-subida.component';
import { FotosCuadriculaComponent } from '../fotos-cuadricula/fotos-cuadricula.component';
import { ColeccionFormularioComponent } from '../coleccion-formulario/coleccion-formulario.component';
import { ConfirmarBorradoComponent } from '../confirmar-borrado/confirmar-borrado.component';
import type { Coleccion, FotoGaleria, SeccionGaleria, } from '../../../../core/models/galeria.model';

/**
 * Detalle de una colección: sus datos, el gestor de fotografías y
 * las acciones de publicación.
 *
 * Es la pantalla donde el administrador pasa más tiempo, así que
 * todo lo frecuente —subir, seleccionar, asignar año— está a la
 * vista sin necesidad de abrir menús.
 */
@Component({
    selector: 'app-coleccion-detalle',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        FotosSubidaComponent,
        FotosCuadriculaComponent,
        ColeccionFormularioComponent,
        ConfirmarBorradoComponent,
    ],
    templateUrl: './coleccion-detalle.component.html',
    styleUrl: './coleccion-detalle.component.css',
})
export class ColeccionDetalleComponent implements OnInit {
    private readonly service = inject(GaleriaService);
    private readonly avisos = inject(NotificacionesService);
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);
    private readonly ruta = inject(ActivatedRoute);
    private readonly fb = inject(FormBuilder);

    private readonly subida = viewChild(FotosSubidaComponent);

    readonly coleccion = signal<Coleccion | null>(null);
    readonly seccion = signal<SeccionGaleria | null>(null);
    readonly hermanas = signal<Coleccion[]>([]);
    readonly fotos = signal<FotoGaleria[]>([]);
    readonly reordenandoFotos = signal(false);

    readonly cargando = signal(true);
    readonly error = signal<string | null>(null);
    readonly publicando = signal(false);

    readonly seleccionadas = signal<number[]>([]);

    /** Solo el administrador puede eliminar. */
    readonly esAdmin = this.auth.esAdmin;

    /* --- Modales --- */
    readonly mostrarFormulario = signal(false);
    readonly mostrarBorrado = signal(false);
    readonly fotoEditando = signal<FotoGaleria | null>(null);
    readonly mostrarAnioLote = signal(false);
    readonly confirmandoBorrado = signal(false);

    readonly guardandoFoto = signal(false);

    readonly formularioFoto = this.fb.group({
        pie: this.fb.nonNullable.control(''),
        anio: this.fb.control<number | null>(null),
    });

    readonly formularioLote = this.fb.group({
        anio: this.fb.control<number | null>(null),
    });

    readonly totalFotos = computed(() => this.fotos().length);
    readonly haySeleccion = computed(() => this.seleccionadas().length > 0);

    readonly puedePublicar = computed(
        () => this.totalFotos() > 0 && this.coleccion()?.estado === 'borrador',
    );

    readonly periodo = computed(() => {
        const c = this.coleccion();
        return c ? this.service.periodo(c) : null;
    });

    constructor() {
        // El componente de subida necesita el identificador de la
        // colección; se le pasa en cuanto termina de cargar.
        effect(() => {
            const componente = this.subida();
            const id = this.coleccion()?.id;
            if (componente && id) componente.coleccionId = id;
        });
    }

    ngOnInit(): void {
        const id = Number(this.ruta.snapshot.paramMap.get('id'));
        if (!id) {
            this.error.set('No se indicó qué colección abrir.');
            this.cargando.set(false);
            return;
        }
        this.cargar(id);
    }

    /* ===========================================
       Carga
       =========================================== */

    private cargar(id: number): void {
        this.cargando.set(true);
        this.error.set(null);

        this.service.obtenerColeccion(id).subscribe({
            next: (coleccion) => {
                this.coleccion.set(coleccion);
                this.cargarFotos(id);
                this.cargarContexto(coleccion);
            },
            error: () => {
                this.error.set('No se pudo cargar la colección.');
                this.cargando.set(false);
            },
        });
    }

    /** La sección y las hermanas alimentan el formulario de edición. */
    private cargarContexto(coleccion: Coleccion): void {
        this.service.listarSecciones().subscribe({
            next: (secciones) => {
                const propia = secciones.find((s) => s.id === coleccion.seccionId);
                this.seccion.set(propia ?? null);
            },
        });

        this.service.listarColecciones(coleccion.seccionId).subscribe({
            next: (lista) => this.hermanas.set(lista),
        });
    }

    private cargarFotos(coleccionId: number): void {
        this.service.listarFotos(coleccionId).subscribe({
            next: (fotos) => {
                this.fotos.set(fotos);
                this.cargando.set(false);
            },
            error: () => {
                this.error.set('No se pudieron cargar las fotografías.');
                this.cargando.set(false);
            },
        });
    }

    recargar(): void {
        const id = this.coleccion()?.id;
        if (id) this.cargar(id);
    }

    volver(): void {
        const clave = this.seccion()?.clave;
        void this.router.navigate(['/galeria'], {
            queryParams: clave ? { seccion: clave } : {},
        });
    }

    /* ===========================================
       Subida
       =========================================== */

    alSubirFotos(nuevas: FotoGaleria[]): void {
        this.fotos.update((lista) => [...lista, ...nuevas]);

        // La primera subida define la portada en el servidor: se
        // recarga la colección para reflejarla sin pedirla aparte.
        if (!this.coleccion()?.portadaFotoId) {
            this.recargarColeccion();
        }
    }

    private recargarColeccion(): void {
        const id = this.coleccion()?.id;
        if (!id) return;

        this.service.obtenerColeccion(id).subscribe({
            next: (coleccion) => this.coleccion.set(coleccion),
        });
    }

    /* ===========================================
       Publicación
       =========================================== */

    publicar(): void {
        const coleccion = this.coleccion();
        if (!coleccion) return;

        this.publicando.set(true);

        this.service.publicarColeccion(coleccion.id).subscribe({
            next: (actualizada) => {
                this.publicando.set(false);
                this.coleccion.set({ ...actualizada, totalFotos: this.totalFotos() });
                this.avisos.exito('La colección ya es visible en el sitio.');
            },
            error: (e) => {
                this.publicando.set(false);
                this.avisos.error(
                    this.service.mensajeDeError(e, 'No se pudo publicar la colección.'),
                );
            },
        });
    }

    despublicar(): void {
        const coleccion = this.coleccion();
        if (!coleccion) return;

        this.publicando.set(true);

        this.service.despublicarColeccion(coleccion.id).subscribe({
            next: (actualizada) => {
                this.publicando.set(false);
                this.coleccion.set({ ...actualizada, totalFotos: this.totalFotos() });
                this.avisos.exito('La colección dejó de mostrarse en el sitio.');
            },
            error: (e) => {
                this.publicando.set(false);
                this.avisos.error(
                    this.service.mensajeDeError(e, 'No se pudo despublicar la colección.'),
                );
            },
        });
    }

    /* ===========================================
       Datos de la colección
       =========================================== */

    editarDatos(): void {
        this.mostrarFormulario.set(true);
    }

    alGuardarDatos(actualizada: Coleccion): void {
        this.mostrarFormulario.set(false);
        this.coleccion.set({ ...actualizada, totalFotos: this.totalFotos() });
    }

    /* ===========================================
       Borrado de la colección
       =========================================== */

    confirmarBorradoColeccion(): void {
        this.mostrarBorrado.set(true);
    }

    /** Tras eliminar no queda nada que mostrar: se vuelve al listado. */
    alEliminarColeccion(): void {
        this.mostrarBorrado.set(false);
        this.volver();
    }

    /* ===========================================
       Fotografías
       =========================================== */

    alCambiarSeleccion(ids: number[]): void {
        this.seleccionadas.set(ids);
    }

    abrirEditorFoto(foto: FotoGaleria): void {
        this.formularioFoto.reset({ pie: foto.pie ?? '', anio: foto.anio });
        this.fotoEditando.set(foto);
    }

    cerrarEditorFoto(): void {
        if (this.guardandoFoto()) return;
        this.fotoEditando.set(null);
    }

    guardarFoto(): void {
        const foto = this.fotoEditando();
        const coleccion = this.coleccion();
        if (!foto || !coleccion) return;

        const v = this.formularioFoto.getRawValue();
        this.guardandoFoto.set(true);

        this.service
            .actualizarFoto(coleccion.id, foto.id, {
                pie: v.pie.trim() || undefined,
                anio: v.anio ?? undefined,
            })
            .subscribe({
                next: (actualizada) => {
                    this.guardandoFoto.set(false);
                    this.fotos.update((lista) =>
                        lista.map((f) => (f.id === actualizada.id ? actualizada : f)),
                    );
                    this.fotoEditando.set(null);
                    this.avisos.exito('Fotografía actualizada.');
                },
                error: (e) => {
                    this.guardandoFoto.set(false);
                    this.avisos.error(
                        this.service.mensajeDeError(e, 'No se pudo guardar la fotografía.'),
                    );
                },
            });
    }

    definirPortada(foto: FotoGaleria): void {
        const coleccion = this.coleccion();
        if (!coleccion) return;

        this.service.definirPortada(coleccion.id, foto.id).subscribe({
            next: (actualizada) => {
                this.coleccion.set({ ...actualizada, totalFotos: this.totalFotos() });
                this.avisos.exito('Se cambió la portada de la colección.');
            },
            error: (e) => {
                this.avisos.error(
                    this.service.mensajeDeError(e, 'No se pudo cambiar la portada.'),
                );
            },
        });
    }

    /* ===========================================
       Acciones en lote
       =========================================== */

    abrirAnioLote(): void {
        this.formularioLote.reset({ anio: null });
        this.mostrarAnioLote.set(true);
    }

    aplicarAnioLote(): void {
        const coleccion = this.coleccion();
        const ids = this.seleccionadas();
        if (!coleccion || ids.length === 0) return;

        const anio = this.formularioLote.getRawValue().anio;

        this.service.asignarAnioEnLote(coleccion.id, ids, anio ?? undefined).subscribe({
            next: () => {
                this.fotos.update((lista) =>
                    lista.map((f) => (ids.includes(f.id) ? { ...f, anio: anio } : f)),
                );
                this.mostrarAnioLote.set(false);
                this.avisos.exito(
                    anio
                        ? `Se asignó el año ${anio} a ${ids.length} fotografías.`
                        : `Se quitó el año de ${ids.length} fotografías.`,
                );
            },
            error: (e) => {
                this.avisos.error(
                    this.service.mensajeDeError(e, 'No se pudo asignar el año.'),
                );
            },
        });
    }

    confirmarBorrado(): void {
        this.confirmandoBorrado.set(true);
    }

    eliminarSeleccionadas(): void {
        const coleccion = this.coleccion();
        const ids = this.seleccionadas();
        if (!coleccion || ids.length === 0) return;

        this.service.eliminarFotosEnLote(coleccion.id, ids).subscribe({
            next: () => {
                this.fotos.update((lista) => lista.filter((f) => !ids.includes(f.id)));
                this.seleccionadas.set([]);
                this.confirmandoBorrado.set(false);
                this.avisos.exito(
                    ids.length === 1
                        ? 'Se eliminó 1 fotografía.'
                        : `Se eliminaron ${ids.length} fotografías.`,
                );

                // La portada pudo irse con el lote: el servidor asigna otra.
                this.recargarColeccion();
            },
            error: (e) => {
                this.confirmandoBorrado.set(false);
                this.avisos.error(
                    this.service.mensajeDeError(e, 'No se pudieron eliminar.'),
                );
            },
        });
    }

    /* ===========================================
   Reordenamiento de fotografías
   =========================================== */

    /**
     * Guarda el orden nuevo.
     * La cuadrícula ya muestra el resultado, así que se aplica de
     * inmediato y se revierte solo si la API falla.
     */
    alReordenarFotos(nuevas: FotoGaleria[]): void {
        const coleccion = this.coleccion();
        if (!coleccion) return;

        const previas = this.fotos();
        this.fotos.set(nuevas);
        this.reordenandoFotos.set(true);

        this.service
            .reordenarFotos(coleccion.id, nuevas.map((f) => f.id))
            .subscribe({
                next: () => {
                    this.reordenandoFotos.set(false);
                    this.avisos.exito('Se actualizó el orden de las fotografías.');
                },
                error: (e) => {
                    this.reordenandoFotos.set(false);
                    this.fotos.set(previas);
                    this.avisos.error(
                        this.service.mensajeDeError(e, 'No se pudo guardar el orden.'),
                    );
                },
            });
    }
}