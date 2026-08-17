import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly anio = new Date().getFullYear();

  verContrasena = false;
  cargando = false;
  errorGeneral = '';

  readonly formulario: FormGroup = this.fb.nonNullable.group({
    usuario: ['', [Validators.required, Validators.minLength(4)]],
    contrasena: ['', [Validators.required, Validators.minLength(6)]],
    recordarme: [false],
  });

  alternarContrasena(): void {
    this.verContrasena = !this.verContrasena;
  }

  esInvalido(control: string): boolean {
    const campo = this.formulario.get(control);
    return !!campo && campo.invalid && (campo.touched || campo.dirty);
  }

  mensajeError(control: string): string {
    const campo = this.formulario.get(control);
    if (!campo?.errors) return '';

    const etiqueta = control === 'usuario' ? 'usuario' : 'contraseña';

    if (campo.errors['required']) return `Escribe tu ${etiqueta}.`;
    if (campo.errors['minlength']) {
      const min = campo.errors['minlength'].requiredLength;
      return `La ${etiqueta} necesita al menos ${min} caracteres.`;
    }
    return 'Revisa este dato.';
  }

  iniciarSesion(): void {
    this.errorGeneral = '';

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.cargando = true;
    const { usuario, contrasena, recordarme } = this.formulario.getRawValue();

    this.auth.login(usuario, contrasena, recordarme).subscribe({
      next: () => {
        const destino = this.ruta.snapshot.queryParamMap.get('regresar') ?? '/dashboard';
        this.router.navigateByUrl(destino);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando = false;
        this.errorGeneral = this.traducirError(err);
        this.formulario.get('contrasena')?.reset();
      },
    });
  }

  private traducirError(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor. Verifica que la API esté corriendo.';
    }
    if (err.status === 401) {
      return 'Usuario o contraseña incorrectos.';
    }
    if (err.status === 400) {
      return 'Revisa los datos ingresados.';
    }
    return 'Ocurrió un error inesperado. Intenta de nuevo.';
  }
}