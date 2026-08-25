import { Injectable, signal } from '@angular/core';

export type TipoNotificacion = 'exito' | 'error';

export interface Notificacion {
  id: number;
  tipo: TipoNotificacion;
  texto: string;
}

const DURACION = 4000;

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly _lista = signal<Notificacion[]>([]);
  readonly lista = this._lista.asReadonly();

  private contador = 0;

  exito(texto: string): void {
    this.mostrar(texto, 'exito');
  }

  error(texto: string): void {
    this.mostrar(texto, 'error');
  }

  mostrar(texto: string, tipo: TipoNotificacion = 'exito'): void {
    const id = ++this.contador;
    this._lista.update((lista) => [...lista, { id, tipo, texto }]);
    setTimeout(() => this.cerrar(id), DURACION);
  }

  cerrar(id: number): void {
    this._lista.update((lista) => lista.filter((n) => n.id !== id));
  }
}