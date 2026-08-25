import { Component, inject } from '@angular/core';
import { NotificacionesService } from '../../core/services/notificaciones.service';

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [],
  templateUrl: './notificaciones.component.html',
  styleUrl: './notificaciones.component.css',
})
export class NotificacionesComponent {
  private readonly service = inject(NotificacionesService);

  readonly notificaciones = this.service.lista;

  cerrar(id: number): void {
    this.service.cerrar(id);
  }
}