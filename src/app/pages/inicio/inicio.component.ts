import { Component } from '@angular/core';
import { NoticiasRapidasComponent } from './sections/noticias-rapidas/noticias-rapidas.component';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [NoticiasRapidasComponent],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.css',
})
export class InicioComponent { }