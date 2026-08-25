import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NoticiasRapidasService } from '../../../../core/services/noticias-rapidas.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  NoticiaRapida, NR_MINIMO, NR_MAXIMO, NR_MAX_CARACTERES,
} from '../../../../core/models/noticia-rapida.model';

/** `null` = creando una nueva; con noticia = editando esa. */
type ModoModal = { abierto: false } | { abierto: true; editando: NoticiaRapida | null };

@Component({
  selector: 'app-noticias-rapidas',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './noticias-rapidas.component.html',
  styleUrl: './noticias-rapidas.component.css',
})
export class NoticiasRapidasComponent implements OnInit {
  private readonly service = inject(NoticiasRapidasService);
  private readonly fb = inject(FormBuilder);
  private readonly avisos = inject(NotificacionesService);

  /** Solo el rol admin puede eliminar (DELETE está restringido en el backend). */
  readonly esAdmin = inject(AuthService).esAdmin;

  readonly minimo = NR_MINIMO;
  readonly maximo = NR_MAXIMO;
  readonly maxCaracteres = NR_MAX_CARACTERES;

  readonly noticias = signal<NoticiaRapida[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly total = computed(() => this.noticias().length);
  readonly listaLlena = computed(() => this.total() >= NR_MAXIMO);
  readonly enElMinimo = computed(() => this.total() <= NR_MINIMO);

  /* --- Modal --- */
  readonly modal = signal<ModoModal>({ abierto: false });
  readonly guardando = signal(false);
  readonly errorFormulario = signal<string | null>(null);

  /* --- Eliminación --- */
  readonly confirmandoEliminacion = signal<NoticiaRapida | null>(null);
  readonly eliminando = signal(false);

  /* --- Reordenamiento --- */
  readonly indiceArrastrado = signal<number | null>(null);
  readonly puedeArrastrar = signal(false);
  readonly reordenando = signal(false);

  /** Orden previo al arrastre, para poder revertir si la API falla. */
  private ordenOriginal: NoticiaRapida[] = [];

  readonly editando = computed(() => {
    const m = this.modal();
    return m.abierto ? m.editando : null;
  });

  readonly modalAbierto = computed(() => this.modal().abierto);

  readonly formulario = this.fb.nonNullable.group({
    texto: ['', [
      Validators.required,
      Validators.maxLength(NR_MAX_CARACTERES),
      // Evita que un texto de puros espacios pase la validación del required.
      (control: { value: string }) =>
        control.value.trim().length === 0 ? { vacio: true } : null,
    ]],
  });

  /** Conteo en vivo para el indicador de caracteres. */
  readonly caracteres = signal(0);

  constructor() {
    this.formulario.controls.texto.valueChanges.subscribe((v) => {
      this.caracteres.set(v.length);
    });
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.service.listar().subscribe({
      next: (data) => {
        this.noticias.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las noticias rápidas.');
        this.cargando.set(false);
      },
    });
  }

  /* ===========================================
     Modal
     =========================================== */

  abrirModalCrear(): void {
    if (this.listaLlena()) return;
    this.prepararModal(null, '');
  }

  abrirModalEditar(noticia: NoticiaRapida): void {
    this.prepararModal(noticia, noticia.texto);
  }

  private prepararModal(editando: NoticiaRapida | null, texto: string): void {
    this.formulario.reset({ texto });
    this.caracteres.set(texto.length);
    this.errorFormulario.set(null);
    this.modal.set({ abierto: true, editando });
  }

  cerrarModal(): void {
    if (this.guardando()) return;
    this.modal.set({ abierto: false });
    this.errorFormulario.set(null);
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void {
    if (this.modalAbierto()) this.cerrarModal();
    if (this.confirmandoEliminacion()) this.cancelarEliminacion();
  }

  /* ===========================================
     Guardar (POST / PATCH)
     =========================================== */
  guardar(): void {
    const control = this.formulario.controls.texto;

    if (this.formulario.invalid) {
      control.markAsTouched();
      this.errorFormulario.set(
        control.hasError('maxlength')
          ? `El texto no puede pasar de ${this.maxCaracteres} caracteres.`
          : 'Escribe el texto de la noticia.',
      );
      return;
    }

    const texto = control.value.trim();
    const objetivo = this.editando();

    // Sin cambios reales: no gastamos una petición.
    if (objetivo && objetivo.texto === texto) {
      this.cerrarModal();
      return;
    }

    this.guardando.set(true);
    this.errorFormulario.set(null);

    const peticion = objetivo
      ? this.service.actualizar(objetivo.id, { texto })
      : this.service.crear({ texto });

    peticion.subscribe({
      next: (guardada) => {
        this.guardando.set(false);

        this.noticias.update((lista) =>
          objetivo
            ? lista.map((n) => (n.id === guardada.id ? guardada : n))
            : [...lista, guardada],
        );

        this.avisos.exito(objetivo ? 'Noticia actualizada.' : 'Noticia agregada al carrusel.');
        this.modal.set({ abierto: false });
      },
      error: (e) => {
        this.guardando.set(false);
        this.errorFormulario.set(this.mensajeDeError(e));
      },
    });
  }

  /** El ValidationPipe de Nest manda `message` como string o como arreglo. */
  private mensajeDeError(e: any): string {
    const mensaje = e?.error?.message;
    if (Array.isArray(mensaje)) return mensaje[0];
    if (typeof mensaje === 'string') return mensaje;
    return 'No se pudo guardar la noticia.';
  }

  /* ===========================================
   Eliminar
   =========================================== */
  pedirConfirmacionEliminar(noticia: NoticiaRapida): void {
    if (this.enElMinimo()) return;
    this.confirmandoEliminacion.set(noticia);
  }

  cancelarEliminacion(): void {
    if (this.eliminando()) return;
    this.confirmandoEliminacion.set(null);
  }

  confirmarEliminacion(): void {
    const noticia = this.confirmandoEliminacion();
    if (!noticia) return;

    this.eliminando.set(true);

    this.service.eliminar(noticia.id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.confirmandoEliminacion.set(null);
        this.avisos.exito('Noticia eliminada del carrusel.');
        // El backend reindexa el campo `orden`, así que recargamos la lista.
        this.cargar();
      },
      error: (e) => {
        this.eliminando.set(false);
        this.confirmandoEliminacion.set(null);
        this.avisos.error(this.mensajeDeError(e));
      },
    });
  }

  /* ===========================================
   Reordenamiento (drag & drop nativo)
   El atributo `draggable` solo se activa cuando
   el puntero baja sobre el asa, para que no se
   pueda arrastrar desde cualquier parte de la fila.
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

    this.ordenOriginal = [...this.noticias()];
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

    this.noticias.update((lista) => {
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

    const idsNuevos = this.noticias().map((n) => n.id);
    const idsPrevios = this.ordenOriginal.map((n) => n.id);

    // Si se soltó en el mismo lugar, no hay nada que guardar.
    if (idsNuevos.join() === idsPrevios.join()) return;

    this.guardarOrden(idsNuevos);
  }

  private guardarOrden(ids: number[]): void {
    this.reordenando.set(true);

    this.service.reordenar({ ids }).subscribe({
      next: (lista) => {
        this.reordenando.set(false);
        // El backend devuelve la lista ya con el campo `orden` recalculado.
        this.noticias.set(lista);
        this.avisos.exito('Se actualizó el orden del carrusel.');
      },
      error: (e) => {
        this.reordenando.set(false);
        this.noticias.set(this.ordenOriginal);
        this.avisos.error(this.mensajeDeError(e));
      },
    });
  }
}