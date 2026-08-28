import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Contenedor de la Galería en el panel.
 * Aporta el encabezado común; el listado y el detalle de cada
 * colección se renderizan dentro del router-outlet.
 */
@Component({
  selector: 'app-galeria',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './galeria.component.html',
  styleUrl: './galeria.component.css',
})
export class GaleriaComponent { }