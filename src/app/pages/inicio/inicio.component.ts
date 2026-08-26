import { Component } from '@angular/core';
import { NoticiasRapidasComponent } from './sections/noticias-rapidas/noticias-rapidas.component';
import { ProgramacionDestacadaComponent } from './sections/programacion-destacada/programacion-destacada.component';
import { NoticiasComponent } from "./sections/noticias/noticias.component";

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [NoticiasRapidasComponent, ProgramacionDestacadaComponent, NoticiasComponent],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.css',
})
export class InicioComponent { }