import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly anio = new Date().getFullYear();

  verContrasena = false;
  cargando = false;
  errorGeneral = '';

  readonly formulario: FormGroup = this.fb.nonNullable.group({
    usuario: ['', [Validators.required, Validators.minLength(4)]],
    contrasena: ['', [Validators.required, Validators.minLength(6)]],
  });

  alternarContrasena(): void {
    this.verContrasena = !this.verContrasena;
  }

  /** Un control se marca en rojo sólo cuando el usuario ya interactuó con él. */
  esInvalido(control: string): boolean {
    const campo = this.formulario.get(control);
    return !!campo && campo.invalid && (campo.touched || campo.dirty);
  }

  mensajeError(control: string): string {
    const campo = this.formulario.get(control);
    if (!campo?.errors) return '';

    const etiqueta = control === 'usuario' ? 'usuario' : 'contraseña';

    if (campo.errors['required']) {
      return `Escribe tu ${etiqueta}.`;
    }
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
    const { usuario, contrasena } = this.formulario.getRawValue();

    // TODO: reemplazar por AuthService.login(usuario, contrasena) contra la API NestJS.
    setTimeout(() => {
      this.cargando = false;

      if (usuario === 'admin' && contrasena === 'tvtecno161') {
        this.router.navigate(['/dashboard']);
        return;
      }

      this.errorGeneral = 'Usuario o contraseña incorrectos.';
      this.formulario.get('contrasena')?.reset();
    }, 900);
  }
}