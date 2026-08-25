import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { switchMap, of } from 'rxjs';
import { ProgramacionDestacadaService } from '../../../../core/services/programacion-destacada.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import {
  ProgramaDestacado, ActualizarProgramaPayload,
  IMAGEN_MAX_BYTES, IMAGEN_TIPOS,
} from '../../../../core/models/programacion-destacada.model';

/** Colores de la viñeta de categoría, por posición en el carrusel.
 *  La etiqueta es texto libre, así que no se puede mapear por su valor. */
const COLORES = ['#2c379d', '#b42e38', '#5c2c56', '#04513c', '#836d23'];

@Component({
  selector: 'app-programacion-destacada',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './programacion-destacada.component.html',
  styleUrl: './programacion-destacada.component.css',
})
export class ProgramacionDestacadaComponent implements OnInit {
  private readonly service = inject(ProgramacionDestacadaService);
  private readonly avisos = inject(NotificacionesService);
  private readonly fb = inject(FormBuilder);

  readonly programas = signal<ProgramaDestacado[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly sinImagen = computed(() =>
    this.programas().filter((p) => !p.imagenUrl).length,
  );

  /* --- Modal --- */
  readonly editando = signal<ProgramaDestacado | null>(null);
  readonly guardando = signal(false);
  readonly errorFormulario = signal<string | null>(null);

  /* --- Reordenamiento --- */
  readonly indiceArrastrado = signal<number | null>(null);
  readonly puedeArrastrar = signal(false);
  readonly reordenando = signal(false);

  /** Orden previo al arrastre, para poder revertir si la API falla. */
  private ordenOriginal: ProgramaDestacado[] = [];

  /** Archivo elegido y su vista previa (object URL) mientras no se guarda. */
  readonly archivo = signal<File | null>(null);
  readonly previa = signal<string | null>(null);

  readonly formulario = this.fb.nonNullable.group({
    titulo: ['', [Validators.required, Validators.maxLength(120)]],
    etiqueta: ['', [Validators.required, Validators.maxLength(40)]],
    dias: ['', [Validators.required, Validators.maxLength(60)]],
    horaInicio: ['', [Validators.required]],
    imagenAlt: ['', [Validators.maxLength(150)]],
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.service.listar().subscribe({
      next: (data) => {
        this.programas.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la programación destacada.');
        this.cargando.set(false);
      },
    });
  }

  /* ===========================================
     Presentación
     =========================================== */
  imagen(programa: ProgramaDestacado): string | null {
    return this.service.urlAbsoluta(programa.imagenUrl);
  }

  color(indice: number): string {
    return COLORES[indice % COLORES.length];
  }

  /** "Lun – Vie" + "11:00:00" → "Lun – Vie · 11:00 hrs" */
  horario(programa: ProgramaDestacado): string {
    const hora = programa.horaInicio?.slice(0, 5) ?? '';
    return `${programa.dias} · ${hora} hrs`;
  }

  /* ===========================================
     Modal
     =========================================== */
  abrirModalEditar(programa: ProgramaDestacado): void {
    this.formulario.reset({
      titulo: programa.titulo,
      etiqueta: programa.etiqueta,
      dias: programa.dias,
      // El input type="time" espera HH:mm; la BD entrega HH:mm:ss.
      horaInicio: programa.horaInicio?.slice(0, 5) ?? '',
      imagenAlt: programa.imagenAlt ?? '',
    });

    this.limpiarArchivo();
    this.errorFormulario.set(null);
    this.editando.set(programa);
  }

  cerrarModal(): void {
    if (this.guardando()) return;
    this.limpiarArchivo();
    this.editando.set(null);
    this.errorFormulario.set(null);
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void {
    if (this.editando()) this.cerrarModal();
  }

  /** La vista previa es un object URL: hay que revocarlo para no filtrar memoria. */
  private limpiarArchivo(): void {
    const previa = this.previa();
    if (previa) URL.revokeObjectURL(previa);
    this.previa.set(null);
    this.archivo.set(null);
  }

  /* ===========================================
     Selección de imagen
     =========================================== */
  alElegirArchivo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = ''; // permite volver a elegir el mismo archivo

    if (!archivo) return;

    if (!IMAGEN_TIPOS.includes(archivo.type)) {
      this.errorFormulario.set('Formato no admitido. Usa JPG, PNG o WEBP.');
      return;
    }

    if (archivo.size > IMAGEN_MAX_BYTES) {
      this.errorFormulario.set('La imagen pesa más de 3 MB.');
      return;
    }

    this.limpiarArchivo();
    this.archivo.set(archivo);
    this.previa.set(URL.createObjectURL(archivo));
    this.errorFormulario.set(null);
  }

  quitarSeleccion(): void {
    this.limpiarArchivo();
  }

  /** Vista previa nueva si la hay; si no, la imagen ya guardada. */
  imagenModal(): string | null {
    return this.previa() ?? this.imagen(this.editando()!);
  }

  /* ===========================================
     Guardar
     =========================================== */
  guardar(): void {
    const programa = this.editando();
    if (!programa) return;

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.errorFormulario.set('Revisa los campos marcados.');
      return;
    }

    const v = this.formulario.getRawValue();
    const payload: ActualizarProgramaPayload = {
      titulo: v.titulo.trim(),
      etiqueta: v.etiqueta.trim(),
      dias: v.dias.trim(),
      // El backend acepta HH:mm o HH:mm:ss.
      horaInicio: v.horaInicio,
      imagenAlt: v.imagenAlt.trim(),
    };

    const nueva = this.archivo();

    this.guardando.set(true);
    this.errorFormulario.set(null);

    this.service.actualizar(programa.id, payload).pipe(
      switchMap((guardado) =>
        nueva ? this.service.subirImagen(programa.id, nueva) : of(guardado),
      ),
    ).subscribe({
      next: (guardado) => {
        this.guardando.set(false);
        this.programas.update((lista) =>
          lista.map((p) => (p.id === guardado.id ? guardado : p)),
        );
        this.limpiarArchivo();
        this.editando.set(null);
        this.avisos.exito('Programa actualizado.');
      },
      error: (e) => {
        this.guardando.set(false);
        this.errorFormulario.set(this.mensajeDeError(e));
        // Los datos pudieron guardarse aunque la imagen fallara.
        this.cargar();
      },
    });
  }

  /** El ValidationPipe de Nest manda `message` como string o como arreglo. */
  private mensajeDeError(e: any): string {
    const mensaje = e?.error?.message;
    if (Array.isArray(mensaje)) return mensaje[0];
    if (typeof mensaje === 'string') return mensaje;
    return 'No se pudo guardar el programa.';
  }

  /* ===========================================
   Reordenamiento (drag & drop nativo)
   El atributo `draggable` solo se activa cuando
   el puntero baja sobre el asa, para que no se
   pueda arrastrar desde cualquier parte de la tarjeta.
   =========================================== */
  activarArrastre(): void {
    if (!this.reordenando()) this.puedeArrastrar.set(true);
  }

  desactivarArrastre(): void {
    this.puedeArrastrar.set(false);
  }

  alIniciarArrastre(indice: number, evento: DragEvent): void {
    if (!this.puedeArrastrar()) {
      evento.preventDefault();
      return;
    }

    this.ordenOriginal = [...this.programas()];
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

    this.programas.update((lista) => {
      const copia = [...lista];
      const [movido] = copia.splice(origen, 1);
      copia.splice(indice, 0, movido);
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

    const idsNuevos = this.programas().map((p) => p.id);
    const idsPrevios = this.ordenOriginal.map((p) => p.id);

    // Si se soltó en el mismo lugar, no hay nada que guardar.
    if (idsNuevos.join() === idsPrevios.join()) return;

    this.guardarOrden(idsNuevos);
  }

  private guardarOrden(ids: number[]): void {
    this.reordenando.set(true);

    this.service.reordenar({ ids }).subscribe({
      next: (lista) => {
        this.reordenando.set(false);
        // El backend devuelve la lista con el campo `orden` recalculado.
        this.programas.set(lista);
        this.avisos.exito('Se actualizó el orden del carrusel.');
      },
      error: (e) => {
        this.reordenando.set(false);
        this.programas.set(this.ordenOriginal);
        this.avisos.error(this.mensajeDeError(e));
      },
    });
  }
}