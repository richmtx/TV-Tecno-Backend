import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GaleriaService } from '../../../../core/services/galeria.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ColeccionTarjetaComponent } from '../coleccion-tarjeta/coleccion-tarjeta.component';
import { ColeccionFormularioComponent } from '../coleccion-formulario/coleccion-formulario.component';
import { ConfirmarBorradoComponent } from '../confirmar-borrado/confirmar-borrado.component';
import type {
    Coleccion,
    EstadoColeccion,
    SeccionGaleria,
} from '../../../../core/models/galeria.model';

/**
 * Listado de colecciones del panel, agrupadas por sección.
 *
 * Las pestañas reproducen las del sitio público para que el
 * administrador reconozca de inmediato dónde está trabajando.
 * La sección activa viaja en la URL, así que refrescar no pierde
 * el lugar.
 */
@Component({
    selector: 'app-colecciones-lista',
    standalone: true,
    imports: [
        ColeccionTarjetaComponent,
        ColeccionFormularioComponent,
        ConfirmarBorradoComponent,
    ],
    templateUrl: './colecciones-lista.component.html',
    styleUrl: './colecciones-lista.component.css',
})
export class ColeccionesListaComponent implements OnInit {
    private readonly service = inject(GaleriaService);
    private readonly avisos = inject(NotificacionesService);
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);
    private readonly ruta = inject(ActivatedRoute);

    readonly secciones = signal<SeccionGaleria[]>([]);
    readonly colecciones = signal<Coleccion[]>([]);
    readonly seccionActiva = signal<SeccionGaleria | null>(null);

    readonly cargando = signal(true);
    readonly error = signal<string | null>(null);

    readonly busqueda = signal('');
    readonly filtroEstado = signal<EstadoColeccion | 'todos'>('todos');

    /** Solo el administrador puede eliminar colecciones. */
    readonly esAdmin = this.auth.esAdmin;

    /* --- Formulario --- */
    readonly mostrarFormulario = signal(false);
    readonly coleccionEditando = signal<Coleccion | null>(null);

    /* --- Borrado --- */
    readonly coleccionBorrando = signal<Coleccion | null>(null);

    /* --- Reordenamiento --- */
    readonly indiceArrastrado = signal<number | null>(null);
    readonly puedeArrastrar = signal(false);
    readonly reordenando = signal(false);

    /** Orden previo al arrastre, para revertir si la API falla. */
    private ordenOriginal: Coleccion[] = [];

    /** Las secciones cronológicas no admiten arrastre. */
    readonly esReordenable = computed(
        () => this.seccionActiva()?.ordenAutomatico === false,
    );

    /**
     * Filtrado en cliente: cada sección trae doce colecciones como
     * mucho, así que filtrar aquí responde al instante y evita el
     * ida y vuelta con la API en cada tecla.
     */
    readonly visibles = computed<Coleccion[]>(() => {
        const termino = this.busqueda().trim().toLowerCase();
        const estado = this.filtroEstado();

        return this.colecciones().filter((c) => {
            if (estado !== 'todos' && c.estado !== estado) return false;
            if (!termino) return true;
            return (
                c.titulo.toLowerCase().includes(termino) ||
                (c.descripcion ?? '').toLowerCase().includes(termino)
            );
        });
    });

    readonly borradores = computed(
        () => this.colecciones().filter((c) => c.estado === 'borrador').length,
    );

    ngOnInit(): void {
        this.cargarSecciones();
    }

    /* ===========================================
       Carga
       =========================================== */

    private cargarSecciones(): void {
        this.cargando.set(true);
        this.error.set(null);

        this.service.listarSecciones().subscribe({
            next: (secciones) => {
                this.secciones.set(secciones);

                // La sección de la URL manda; si no viene, se abre la primera.
                const clave = this.ruta.snapshot.queryParamMap.get('seccion');
                const inicial =
                    secciones.find((s) => s.clave === clave) ?? secciones[0] ?? null;

                this.seccionActiva.set(inicial);
                if (inicial) {
                    this.cargarColecciones(inicial);
                } else {
                    this.cargando.set(false);
                }
            },
            error: () => {
                this.error.set('No se pudieron cargar las secciones de la galería.');
                this.cargando.set(false);
            },
        });
    }

    private cargarColecciones(seccion: SeccionGaleria): void {
        this.cargando.set(true);
        this.error.set(null);

        this.service.listarColecciones(seccion.id).subscribe({
            next: (colecciones) => {
                this.colecciones.set(colecciones);
                this.cargando.set(false);
            },
            error: () => {
                this.error.set('No se pudieron cargar las colecciones.');
                this.cargando.set(false);
            },
        });
    }

    recargar(): void {
        const seccion = this.seccionActiva();
        if (seccion) {
            this.cargarColecciones(seccion);
        } else {
            this.cargarSecciones();
        }
    }

    /* ===========================================
       Navegación
       =========================================== */

    cambiarSeccion(seccion: SeccionGaleria): void {
        if (seccion.id === this.seccionActiva()?.id) return;

        this.seccionActiva.set(seccion);
        this.busqueda.set('');
        this.filtroEstado.set('todos');
        this.colecciones.set([]);

        // La sección queda en la URL para sobrevivir a un refresco.
        void this.router.navigate([], {
            relativeTo: this.ruta,
            queryParams: { seccion: seccion.clave },
            replaceUrl: true,
        });

        this.cargarColecciones(seccion);
    }

    abrirColeccion(coleccion: Coleccion): void {
        void this.router.navigate(['/galeria/coleccion', coleccion.id]);
    }

    /* ===========================================
       Formulario
       =========================================== */

    editarColeccion(coleccion: Coleccion): void {
        this.coleccionEditando.set(coleccion);
        this.mostrarFormulario.set(true);
    }

    nuevaColeccion(): void {
        this.coleccionEditando.set(null);
        this.mostrarFormulario.set(true);
    }

    cerrarFormulario(): void {
        this.mostrarFormulario.set(false);
        this.coleccionEditando.set(null);
    }

    /**
     * Tras guardar se recarga la sección completa: crear o cerrar una
     * época puede modificar otras colecciones, y una recarga es más
     * fiable que intentar reconstruir el estado en el cliente.
     */
    alGuardarColeccion(): void {
        this.cerrarFormulario();
        this.recargar();
    }

    /* ===========================================
       Borrado
       =========================================== */

    confirmarBorrado(coleccion: Coleccion): void {
        this.coleccionBorrando.set(coleccion);
    }

    cerrarBorrado(): void {
        this.coleccionBorrando.set(null);
    }

    /**
     * Quita la colección de la lista sin recargar: el resto de la
     * sección no cambió, y una recarga completa se sentiría lenta.
     */
    alEliminarColeccion(eliminada: Coleccion): void {
        this.colecciones.update((lista) =>
            lista.filter((c) => c.id !== eliminada.id),
        );
        this.coleccionBorrando.set(null);
    }

    /* ===========================================
       Reordenamiento (drag & drop nativo)
       El atributo `draggable` solo se activa cuando el puntero baja
       sobre el asa, para no arrastrar desde cualquier parte.
       =========================================== */

    activarArrastre(): void {
        if (!this.reordenando() && this.esReordenable()) {
            this.puedeArrastrar.set(true);
        }
    }

    desactivarArrastre(): void {
        this.puedeArrastrar.set(false);
    }

    alIniciarArrastre(indice: number, evento: DragEvent): void {
        if (!this.puedeArrastrar()) {
            evento.preventDefault();
            return;
        }

        this.ordenOriginal = [...this.colecciones()];
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

        this.colecciones.update((lista) => {
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
        const habiaArrastre = this.indiceArrastrado() !== null;

        this.indiceArrastrado.set(null);
        this.puedeArrastrar.set(false);

        if (!habiaArrastre) return;

        const idsNuevos = this.colecciones().map((c) => c.id);
        const idsPrevios = this.ordenOriginal.map((c) => c.id);

        if (idsNuevos.join() === idsPrevios.join()) return;

        this.guardarOrden(idsNuevos);
    }

    private guardarOrden(ids: number[]): void {
        const seccion = this.seccionActiva();
        if (!seccion) return;

        this.reordenando.set(true);

        this.service
            .reordenarColecciones({ seccionId: seccion.id, ids })
            .subscribe({
                next: () => {
                    this.reordenando.set(false);
                    this.avisos.exito('Se actualizó el orden de las colecciones.');
                },
                error: (e) => {
                    this.reordenando.set(false);
                    this.colecciones.set(this.ordenOriginal);
                    this.avisos.error(
                        this.service.mensajeDeError(e, 'No se pudo guardar el orden.'),
                    );
                },
            });
    }

    /* ===========================================
       Filtros
       =========================================== */

    alBuscar(evento: Event): void {
        this.busqueda.set((evento.target as HTMLInputElement).value);
    }

    cambiarEstado(estado: EstadoColeccion | 'todos'): void {
        this.filtroEstado.set(estado);
    }
}