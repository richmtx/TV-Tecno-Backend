import { Component, computed, inject, signal } from '@angular/core';
import { ContactoService } from '../../core/services/contacto.service';
import type { ContactoCompleto, ContactoDatos, ContactoImagen, RedSocial } from '../../core/models/contacto.model';
import { ContactoDatosComponent } from './sections/contacto-datos/contacto-datos.component';
import { ContactoRedesComponent } from './sections/contacto-redes/contacto-redes.component';
import { ContactoEgresadosComponent } from './sections/contacto-egresados/contacto-egresados.component';

/**
 * Contenedor de la página de Contacto en el panel.
 *
 * Carga todo de una sola vez y reparte los datos entre las tres
 * secciones. A diferencia de Acerca de, cada sección tiene su
 * propio endpoint, así que aquí no hace falta mezclar campos: el
 * contenedor solo mantiene la copia y la refresca cuando alguna
 * sección guarda.
 */
@Component({
    selector: 'app-contacto',
    standalone: true,
    imports: [ContactoDatosComponent, ContactoRedesComponent, ContactoEgresadosComponent],
    templateUrl: './contacto.component.html',
    styleUrl: './contacto.component.css',
})
export class ContactoComponent {
    private readonly service = inject(ContactoService);

    readonly cargando = signal(true);
    readonly errorCarga = signal<string | null>(null);

    readonly datos = signal<ContactoDatos | null>(null);
    readonly redes = signal<RedSocial[]>([]);
    readonly imagenes = signal<ContactoImagen[]>([]);

    readonly listo = computed(() => this.datos() !== null);

    constructor() {
        this.cargar();
    }

    cargar(): void {
        this.cargando.set(true);
        this.errorCarga.set(null);

        this.service.obtenerTodo().subscribe({
            next: (todo) => {
                this.repartir(todo);
                this.cargando.set(false);
            },
            error: (e) => {
                this.cargando.set(false);
                this.errorCarga.set(
                    this.service.mensajeDeError(e, 'No se pudo cargar la información de contacto.'),
                );
            },
        });
    }

    private repartir(todo: ContactoCompleto): void {
        this.datos.set(todo.datos);
        this.redes.set(todo.redes);
        this.imagenes.set(todo.imagenes);
    }

    /* ===========================================
       Refrescos desde las secciones
       =========================================== */

    actualizarDatos(datos: ContactoDatos): void {
        this.datos.set(datos);
    }

    actualizarRedes(redes: RedSocial[]): void {
        this.redes.set(redes);
    }

    actualizarImagen(imagen: ContactoImagen): void {
        this.imagenes.update((lista) =>
            lista.map((actual) => (actual.clave === imagen.clave ? imagen : actual)),
        );
    }
}