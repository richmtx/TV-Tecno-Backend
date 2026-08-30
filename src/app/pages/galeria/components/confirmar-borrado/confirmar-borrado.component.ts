import { Component, HostListener, computed, inject, input, output, signal, } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { GaleriaService } from '../../../../core/services/galeria.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import type { Coleccion } from '../../../../core/models/galeria.model';

/**
 * Confirmación de borrado de una colección.
 *
 * Cuando la colección tiene fotografías se exige escribir su
 * título: eliminar doscientas imágenes por un clic mal dado es un
 * accidente que ocurre, y la fricción aquí es deliberada.
 */
@Component({
    selector: 'app-confirmar-borrado',
    standalone: true,
    imports: [ReactiveFormsModule],
    templateUrl: './confirmar-borrado.component.html',
    styleUrl: './confirmar-borrado.component.css',
})
export class ConfirmarBorradoComponent {
    private readonly service = inject(GaleriaService);
    private readonly avisos = inject(NotificacionesService);
    private readonly fb = inject(FormBuilder);

    readonly coleccion = input.required<Coleccion>();

    readonly eliminado = output<Coleccion>();
    readonly cerrado = output<void>();

    readonly eliminando = signal(false);
    readonly error = signal<string | null>(null);

    readonly confirmacion = this.fb.nonNullable.control('');

    /** Espejo del campo, para que el botón reaccione al escribir. */
    private readonly textoEscrito = toSignal(this.confirmacion.valueChanges, {
        initialValue: '',
    });

    /** Solo las colecciones con fotos exigen escribir el título. */
    readonly exigeConfirmacion = computed(() => this.coleccion().totalFotos > 0);

    readonly puedeEliminar = computed(() => {
        if (!this.exigeConfirmacion()) return true;
        return (
            this.textoEscrito().trim().toLowerCase() ===
            this.coleccion().titulo.trim().toLowerCase()
        );
    });

    eliminar(): void {
        if (!this.puedeEliminar() || this.eliminando()) return;

        const coleccion = this.coleccion();
        this.eliminando.set(true);
        this.error.set(null);

        this.service.eliminarColeccion(coleccion.id).subscribe({
            next: () => {
                this.eliminando.set(false);
                this.avisos.exito(`"${coleccion.titulo}" se envió a la papelera.`);
                this.eliminado.emit(coleccion);
            },
            error: (e) => {
                this.eliminando.set(false);
                this.error.set(
                    this.service.mensajeDeError(e, 'No se pudo eliminar la colección.'),
                );
            },
        });
    }

    cerrar(): void {
        if (this.eliminando()) return;
        this.cerrado.emit();
    }

    @HostListener('document:keydown.escape')
    cerrarConEscape(): void {
        this.cerrar();
    }
}