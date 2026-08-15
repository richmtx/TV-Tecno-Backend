import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { UsuariosService } from '../../core/services/usuarios.service';
import type {
  Usuario, EstadisticasUsuarios, Rol, CrearUsuarioPayload,
} from '../../core/models/usuario.model';

interface FilaPermiso {
  accion: string;
  admin: boolean;
  editor: boolean;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.css',
})
export class UsuariosComponent implements OnInit {
  private readonly usuariosService = inject(UsuariosService);

  readonly usuarios = signal<Usuario[]>([]);
  readonly estadisticas = signal<EstadisticasUsuarios | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly buscar = signal('');
  readonly filtroRol = signal<Rol | ''>('');

  readonly modalAbierto = signal(false);
  readonly guardando = signal(false);
  readonly errorFormulario = signal<string | null>(null);
  readonly usuarioEditando = signal<Usuario | null>(null);

  readonly passwordGenerada = signal<string | null>(null);
  readonly nombreDePassword = signal('');

  readonly confirmandoBaja = signal<Usuario | null>(null);

  formulario: CrearUsuarioPayload = this.formularioVacio();

  readonly permisos: FilaPermiso[] = [
    { accion: 'Editar contenido del sitio', admin: true, editor: true },
    { accion: 'Subir videos e imágenes', admin: true, editor: true },
    { accion: 'Publicar o despublicar', admin: true, editor: true },
    { accion: 'Eliminar contenido de forma permanente', admin: true, editor: false },
    { accion: 'Crear y eliminar usuarios', admin: true, editor: false },
    { accion: 'Restablecer contraseñas de otros', admin: true, editor: false },
  ];

  readonly usuariosFiltrados = computed(() => {
    const texto = this.buscar().trim().toLowerCase();
    const rol = this.filtroRol();

    return this.usuarios().filter((u) => {
      const coincideRol = !rol || u.rol === rol;
      const coincideTexto = !texto
        || u.nombreCompleto.toLowerCase().includes(texto)
        || u.correo.toLowerCase().includes(texto)
        || u.usuario.toLowerCase().includes(texto);
      return coincideRol && coincideTexto;
    });
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.usuariosService.listar().subscribe({
      next: (data) => {
        this.usuarios.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los usuarios');
        this.cargando.set(false);
      },
    });

    this.usuariosService.estadisticas().subscribe({
      next: (data) => this.estadisticas.set(data),
      error: () => { },
    });
  }

  abrirModalCrear(): void {
    this.usuarioEditando.set(null);
    this.formulario = this.formularioVacio();
    this.errorFormulario.set(null);
    this.modalAbierto.set(true);
  }

  abrirModalEditar(usuario: Usuario): void {
    this.usuarioEditando.set(usuario);
    this.formulario = {
      usuario: usuario.usuario,
      nombreCompleto: usuario.nombreCompleto,
      correo: usuario.correo,
      rol: usuario.rol,
    };
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

    const editando = this.usuarioEditando();

    if (editando) {
      this.usuariosService.actualizar(editando.id, {
        nombreCompleto: this.formulario.nombreCompleto.trim(),
        correo: this.formulario.correo.trim(),
        rol: this.formulario.rol,
      }).subscribe({
        next: () => {
          this.guardando.set(false);
          this.cerrarModal();
          this.cargar();
        },
        error: (e) => {
          this.guardando.set(false);
          this.errorFormulario.set(e?.error?.message ?? 'No se pudo actualizar el usuario');
        },
      });
      return;
    }

    const payload: CrearUsuarioPayload = {
      usuario: this.formulario.usuario.trim(),
      nombreCompleto: this.formulario.nombreCompleto.trim(),
      correo: this.formulario.correo.trim(),
      rol: this.formulario.rol,
    };

    if (this.formulario.password?.trim()) {
      payload.password = this.formulario.password.trim();
    }

    this.usuariosService.crear(payload).subscribe({
      next: (creado) => {
        this.guardando.set(false);
        this.cerrarModal();
        if (creado.passwordGenerada) {
          this.nombreDePassword.set(creado.nombreCompleto);
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

  pedirConfirmacionBaja(usuario: Usuario): void {
    this.confirmandoBaja.set(usuario);
  }

  cancelarBaja(): void {
    this.confirmandoBaja.set(null);
  }

  confirmarBaja(): void {
    const usuario = this.confirmandoBaja();
    if (!usuario) return;

    this.usuariosService.eliminar(usuario.id).subscribe({
      next: () => {
        this.confirmandoBaja.set(null);
        this.cargar();
      },
      error: (e) => {
        this.confirmandoBaja.set(null);
        this.error.set(e?.error?.message ?? 'No se pudo desactivar la cuenta');
      },
    });
  }

  reactivar(usuario: Usuario): void {
    this.usuariosService.reactivar(usuario.id).subscribe({
      next: () => this.cargar(),
      error: (e) => this.error.set(e?.error?.message ?? 'No se pudo reactivar la cuenta'),
    });
  }

  resetearPassword(usuario: Usuario): void {
    this.usuariosService.resetearPassword(usuario.id).subscribe({
      next: (r) => {
        if (r.passwordGenerada) {
          this.nombreDePassword.set(usuario.nombreCompleto);
          this.passwordGenerada.set(r.passwordGenerada);
        }
      },
      error: (e) => this.error.set(e?.error?.message ?? 'No se pudo restablecer la contraseña'),
    });
  }

  cerrarAvisoPassword(): void {
    this.passwordGenerada.set(null);
    this.nombreDePassword.set('');
  }

  copiarPassword(): void {
    const valor = this.passwordGenerada();
    if (valor) navigator.clipboard?.writeText(valor);
  }

  iniciales(nombre: string): string {
    return nombre.trim().split(/\s+/).slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase()).join('');
  }

  private formularioValido(): boolean {
    const f = this.formulario;

    if (!this.usuarioEditando()) {
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
    }

    if (f.nombreCompleto.trim().length < 3) {
      this.errorFormulario.set('Escribe el nombre completo');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo.trim())) {
      this.errorFormulario.set('El correo no tiene un formato válido');
      return false;
    }

    return true;
  }

  private formularioVacio(): CrearUsuarioPayload {
    return { usuario: '', nombreCompleto: '', correo: '', rol: 'editor', password: '' };
  }
}