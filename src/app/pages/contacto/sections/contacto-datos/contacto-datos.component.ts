import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ContactoService } from '../../../../core/services/contacto.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import type { ContactoDatos } from '../../../../core/models/contacto.model';

/** Límites de la base de datos, replicados para avisar antes de enviar. */
const MAX = {
    correo: 120,
    telefono: 40,
    telefonoEnlace: 20,
    direccion: 200,
    direccionCorta: 120,
    horario: 120,
    url: 255,
};

/** Mismo patrón que usa el backend, para avisar sin esperar el rechazo. */
const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Medios de contacto del canal.
 *
 * Estos ocho campos alimentan la página de Contacto y el pie del
 * sitio: un error aquí no se ve roto en la página, simplemente
 * deja al canal incomunicado. Por eso la validación es más
 * estricta que en el resto del panel.
 */
@Component({
    selector: 'app-contacto-datos',
    standalone: true,
    imports: [ReactiveFormsModule],
    templateUrl: './contacto-datos.component.html',
    styleUrl: './contacto-datos.component.css',
})
export class ContactoDatosComponent {
    private readonly service = inject(ContactoService);
    private readonly avisos = inject(NotificacionesService);
    private readonly fb = inject(FormBuilder);

    readonly datos = input.required<ContactoDatos>();

    readonly guardados = output<ContactoDatos>();

    readonly guardando = signal(false);
    readonly errorFormulario = signal<string | null>(null);

    readonly maximos = MAX;

    readonly formulario = this.fb.group({
        correo: this.fb.nonNullable.control('', [Validators.required, Validators.email, Validators.maxLength(MAX.correo)]),
        telefono: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.telefono)]),
        telefonoEnlace: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^\d{10,20}$/)]),
        direccion: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.direccion)]),
        direccionCorta: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.direccionCorta)]),
        horario: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.horario)]),
        horarioDetalle: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(MAX.horario)]),
        egresadosUrl: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^https?:\/\/.+/), Validators.maxLength(MAX.url)]),
    });

    private readonly cambios = toSignal(this.formulario.valueChanges, { initialValue: null });

    readonly sucio = computed(() => {
        this.cambios();
        return this.formulario.dirty;
    });

    /* ===========================================
       Vistas previas
       Muestran cómo quedará el dato en el sitio, para
       que el editor vea el resultado antes de guardar.
       =========================================== */

    readonly correoValido = computed(() => {
        this.cambios();
        const correo = this.formulario.controls.correo.value.trim();
        return correo.length === 0 || PATRON_CORREO.test(correo);
    });

    readonly enlaceTelefono = computed(() => {
        this.cambios();
        const digitos = this.formulario.controls.telefonoEnlace.value.trim();
        return digitos ? `tel:+${digitos}` : '';
    });

    readonly enlaceCorreo = computed(() => {
        this.cambios();
        const correo = this.formulario.controls.correo.value.trim();
        return correo ? `mailto:${correo}` : '';
    });

    constructor() {
        effect(() => {
            const actuales = this.datos();
            this.formulario.reset({
                correo: actuales.correo,
                telefono: actuales.telefono,
                telefonoEnlace: actuales.telefonoEnlace,
                direccion: actuales.direccion,
                direccionCorta: actuales.direccionCorta,
                horario: actuales.horario,
                horarioDetalle: actuales.horarioDetalle,
                egresadosUrl: actuales.egresadosUrl,
            });
        });
    }

    /**
     * Propone el enlace telefónico a partir del número visible.
     * Quita paréntesis, espacios y guiones, y antepone la lada de
     * México si el editor solo escribió los diez dígitos.
     */
    sugerirEnlace(): void {
        const control = this.formulario.controls.telefonoEnlace;
        if (control.value.trim()) return;

        const digitos = this.formulario.controls.telefono.value.replace(/\D/g, '');
        if (digitos.length !== 10) return;

        control.setValue(`52${digitos}`);
        control.markAsDirty();
    }

    /* ===========================================
       Guardar
       =========================================== */

    guardar(): void {
        if (this.formulario.invalid) {
            this.formulario.markAllAsTouched();
            this.errorFormulario.set('Revisa los campos marcados: hay datos vacíos o con formato incorrecto.');
            return;
        }

        this.guardando.set(true);
        this.errorFormulario.set(null);

        const v = this.formulario.getRawValue();

        this.service
            .actualizarDatos({
                correo: v.correo.trim(),
                telefono: v.telefono.trim(),
                telefonoEnlace: v.telefonoEnlace.trim(),
                direccion: v.direccion.trim(),
                direccionCorta: v.direccionCorta.trim(),
                horario: v.horario.trim(),
                horarioDetalle: v.horarioDetalle.trim(),
                egresadosUrl: v.egresadosUrl.trim(),
            })
            .subscribe({
                next: (guardados) => {
                    this.guardando.set(false);
                    this.formulario.markAsPristine();
                    this.avisos.exito('Datos de contacto actualizados.');
                    this.guardados.emit(guardados);
                },
                error: (e) => {
                    this.guardando.set(false);
                    this.errorFormulario.set(
                        this.service.mensajeDeError(e, 'No se pudieron guardar los datos.'),
                    );
                },
            });
    }

    descartar(): void {
        const actuales = this.datos();
        this.formulario.reset({
            correo: actuales.correo,
            telefono: actuales.telefono,
            telefonoEnlace: actuales.telefonoEnlace,
            direccion: actuales.direccion,
            direccionCorta: actuales.direccionCorta,
            horario: actuales.horario,
            horarioDetalle: actuales.horarioDetalle,
            egresadosUrl: actuales.egresadosUrl,
        });
        this.errorFormulario.set(null);
    }
}