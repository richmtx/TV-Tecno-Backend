import {
  Component, HostListener, OnInit, OnDestroy, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { UsuariosService } from '../../core/services/usuarios.service';
import { AuthService } from '../../core/services/auth.service';
import type {
  Usuario, EstadisticasUsuarios, Rol, CrearUsuarioPayload,
} from '../../core/models/usuario.model';

interface FilaPermiso {
  accion: string;
  admin: boolean;
  editor: boolean;
}

interface OpcionRol {
  valor: Rol | '';
  etiqueta: string;
}

type TipoNotificacion = 'exito' | 'error';

interface Notificacion {
  id: number;
  tipo: TipoNotificacion;
  texto: string;
}

const DURACION_NOTIFICACION = 4000;

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.css',
})
export class UsuariosComponent implements OnInit, OnDestroy {
  private readonly usuariosService = inject(UsuariosService);
  private readonly authService = inject(AuthService);

  /** Solo los administradores ven y gestionan la lista de cuentas. */
  readonly esAdmin = this.authService.esAdmin;

  readonly usuarios = signal<Usuario[]>([]);
  readonly estadisticas = signal<EstadisticasUsuarios | null>(null);
  readonly cargando = signal(true);

  readonly buscar = signal('');
  readonly filtroRol = signal<Rol | ''>('');

  readonly modalAbierto = signal(false);
  readonly guardando = signal(false);
  readonly errorFormulario = signal<string | null>(null);

  readonly passwordGenerada = signal<string | null>(null);
  readonly nombreDePassword = signal('');
  readonly passwordCopiada = signal(false);

  readonly confirmandoEliminacion = signal<Usuario | null>(null);
  readonly eliminando = signal(false);

  readonly notificaciones = signal<Notificacion[]>([]);

  private contadorNotificaciones = 0;
  private readonly temporizadores = new Set<ReturnType<typeof setTimeout>>();

  /** Id de la sesión actual: su fila no muestra el botón Eliminar. */
  readonly idSesion = computed(() => this.authService.usuario()?.id ?? null);

  /* --- Desplegable de roles --- */
  readonly dropdownAbierto = signal(false);

  readonly opcionesRol: OpcionRol[] = [
    { valor: '', etiqueta: 'Todos los roles' },
    { valor: 'admin', etiqueta: 'Administrador' },
    { valor: 'editor', etiqueta: 'Editor' },
  ];

  readonly etiquetaRolActual = computed(() => {
    const actual = this.filtroRol();
    return this.opcionesRol.find((o) => o.valor === actual)?.etiqueta ?? 'Todos los roles';
  });

  formulario: CrearUsuarioPayload = this.formularioVacio();

  readonly permisos: FilaPermiso[] = [
    { accion: 'Editar contenido del sitio', admin: true, editor: true },
    { accion: 'Subir videos e imágenes', admin: true, editor: true },
    { accion: 'Publicar o despublicar', admin: true, editor: true },
    { accion: 'Eliminar contenido de forma permanente', admin: true, editor: false },
    { accion: 'Crear y eliminar usuarios', admin: true, editor: false },
  ];

  readonly usuariosFiltrados = computed(() => {
    const texto = this.buscar().trim().toLowerCase();
    const rol = this.filtroRol();

    return this.usuarios().filter((u) => {
      const coincideRol = !rol || u.rol === rol;
      const coincideTexto = !texto
        || u.nombreCompleto.toLowerCase().includes(texto)
        || u.usuario.toLowerCase().includes(texto);
      return coincideRol && coincideTexto;
    });
  });

  ngOnInit(): void {
    // Un editor no tiene permiso sobre estos endpoints: ni siquiera se piden.
    if (this.esAdmin()) {
      this.cargar();
    } else {
      this.cargando.set(false);
    }
  }

  ngOnDestroy(): void {
    this.temporizadores.forEach((t) => clearTimeout(t));
    this.temporizadores.clear();
  }

  /* ===========================================
     Notificaciones
     =========================================== */
  notificar(texto: string, tipo: TipoNotificacion = 'exito'): void {
    const id = ++this.contadorNotificaciones;
    this.notificaciones.update((lista) => [...lista, { id, tipo, texto }]);

    const temporizador = setTimeout(() => {
      this.cerrarNotificacion(id);
      this.temporizadores.delete(temporizador);
    }, DURACION_NOTIFICACION);

    this.temporizadores.add(temporizador);
  }

  cerrarNotificacion(id: number): void {
    this.notificaciones.update((lista) => lista.filter((n) => n.id !== id));
  }

  /* ===========================================
     Desplegable
     =========================================== */
  @HostListener('document:click')
  cerrarDropdown(): void {
    if (this.dropdownAbierto()) this.dropdownAbierto.set(false);
  }

  @HostListener('document:keydown.escape')
  cerrarDropdownConEscape(): void {
    this.cerrarDropdown();
  }

  alternarDropdown(): void {
    this.dropdownAbierto.update((v) => !v);
  }

  seleccionarRol(valor: Rol | ''): void {
    this.filtroRol.set(valor);
    this.dropdownAbierto.set(false);
  }

  /* ===========================================
     Datos
     =========================================== */
  cargar(): void {
    this.cargando.set(true);

    this.usuariosService.listar().subscribe({
      next: (data) => {
        this.usuarios.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.notificar('No se pudieron cargar los usuarios', 'error');
      },
    });

    this.usuariosService.estadisticas().subscribe({
      next: (data) => this.estadisticas.set(data),
      error: () => { },
    });
  }

  abrirModalCrear(): void {
    this.formulario = this.formularioVacio();
    this.errorFormulario.set(null);
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
    this.errorFormulario.set(null);
  }

  guardar(): void {
    if (!this.formularioValido()) return;

    this.guardando.set(true);
    this.errorFormulario.set(null);

    const payload: CrearUsuarioPayload = {
      usuario: this.formulario.usuario.trim(),
      nombreCompleto: this.formulario.nombreCompleto.trim(),
      rol: this.formulario.rol,
    };

    if (this.formulario.password?.trim()) {
      payload.password = this.formulario.password.trim();
    }

    this.usuariosService.crear(payload).subscribe({
      next: (creado) => {
        this.guardando.set(false);
        this.cerrarModal();
        this.notificar(`Se creó la cuenta de ${creado.nombreCompleto}`);

        if (creado.passwordGenerada) {
          this.nombreDePassword.set(creado.nombreCompleto);
          this.passwordCopiada.set(false);
          this.passwordGenerada.set(creado.passwordGenerada);
        }

        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.errorFormulario.set(e?.error?.message ?? 'No se pudo crear el usuario');
      },
    });
  }

  pedirConfirmacionEliminar(usuario: Usuario): void {
    this.confirmandoEliminacion.set(usuario);
  }

  cancelarEliminacion(): void {
    this.confirmandoEliminacion.set(null);
  }

  confirmarEliminacion(): void {
    const usuario = this.confirmandoEliminacion();
    if (!usuario) return;

    this.eliminando.set(true);

    this.usuariosService.eliminar(usuario.id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.confirmandoEliminacion.set(null);
        this.notificar(`Se eliminó la cuenta de ${usuario.nombreCompleto}`);
        this.cargar();
      },
      error: (e) => {
        this.eliminando.set(false);
        this.confirmandoEliminacion.set(null);
        this.notificar(e?.error?.message ?? 'No se pudo eliminar la cuenta', 'error');
      },
    });
  }

  cerrarAvisoPassword(): void {
    this.passwordGenerada.set(null);
    this.nombreDePassword.set('');
    this.passwordCopiada.set(false);
  }

  copiarPassword(): void {
    const valor = this.passwordGenerada();
    if (!valor) return;

    const copia = navigator.clipboard?.writeText(valor);

    if (!copia) {
      this.notificar('El navegador no permite copiar automáticamente', 'error');
      return;
    }

    // El aviso permanece visible hasta que se cierra el modal.
    copia.then(() => {
      this.passwordCopiada.set(true);
    }).catch(() => {
      this.notificar('No se pudo copiar la contraseña', 'error');
    });
  }

  iniciales(nombre: string): string {
    return nombre.trim().split(/\s+/).slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase()).join('');
  }

  private formularioValido(): boolean {
    const f = this.formulario;

    if (f.usuario.trim().length < 4) {
      this.errorFormulario.set('El usuario debe tener al menos 4 caracteres');
      return false;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(f.usuario.trim())) {
      this.errorFormulario.set('El usuario solo admite letras, números, punto, guion y guion bajo');
      return false;
    }
    if (f.password?.trim() && f.password.trim().length < 8) {
      this.errorFormulario.set('La contraseña debe tener al menos 8 caracteres');
      return false;
    }
    if (f.nombreCompleto.trim().length < 3) {
      this.errorFormulario.set('Escribe el nombre completo');
      return false;
    }

    return true;
  }

  private formularioVacio(): CrearUsuarioPayload {
    return { usuario: '', nombreCompleto: '', rol: 'editor', password: '' };
  }
}