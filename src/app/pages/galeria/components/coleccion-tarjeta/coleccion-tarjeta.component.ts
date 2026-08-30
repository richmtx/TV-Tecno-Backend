import { Component, inject, input, output } from '@angular/core';
import { GaleriaService } from '../../../../core/services/galeria.service';
import type { Coleccion } from '../../../../core/models/galeria.model';

/**
 * Tarjeta de una colección en el listado del panel.
 * Muestra la portada, el conteo real de fotos y el estado de
 * publicación; el arrastre solo se habilita en las secciones de
 * orden manual, y el borrado solo para el administrador.
 */
@Component({
    selector: 'app-coleccion-tarjeta',
    standalone: true,
    imports: [],
    templateUrl: './coleccion-tarjeta.component.html',
    styleUrl: './coleccion-tarjeta.component.css',
})
export class ColeccionTarjetaComponent {
    private readonly service = inject(GaleriaService);

    readonly coleccion = input.required<Coleccion>();

    /** Falso en las secciones que se ordenan por año. */
    readonly reordenable = input<boolean>(false);

    /** Solo el administrador ve el botón de eliminar. */
    readonly puedeEliminar = input<boolean>(false);

    readonly abrir = output<Coleccion>();
    readonly editar = output<Coleccion>();
    readonly eliminar = output<Coleccion>();

    portada(): string | null {
        return this.service.urlPortada(this.coleccion());
    }

    periodo(): string | null {
        return this.service.periodo(this.coleccion());
    }

    onAbrir(): void {
        this.abrir.emit(this.coleccion());
    }

    onEditar(evento: Event): void {
        evento.stopPropagation();
        this.editar.emit(this.coleccion());
    }

    onEliminar(evento: Event): void {
        evento.stopPropagation();
        this.eliminar.emit(this.coleccion());
    }
}