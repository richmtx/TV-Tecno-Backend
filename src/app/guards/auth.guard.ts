import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.autenticado()) return true;

    return router.createUrlTree(['/login'], {
        queryParams: { regresar: state.url },
    });
};

export const guestGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    return auth.autenticado() ? router.createUrlTree(['/dashboard']) : true;
};