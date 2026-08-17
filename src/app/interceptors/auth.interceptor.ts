import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../core/services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const token = auth.obtenerToken();

    const peticion = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;

    return next(peticion).pipe(
        catchError((error: HttpErrorResponse) => {
            // 401 en cualquier ruta que no sea el propio login = token vencido o inválido
            if (error.status === 401 && !req.url.includes('/auth/login')) {
                auth.logout();
                router.navigate(['/login']);
            }
            return throwError(() => error);
        }),
    );
};