import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import { switchMap, of } from 'rxjs';
import { NoticiasService } from '../../../../core/services/noticias.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import {
    Noticia, ActualizarNoticiaPayload, TOTAL_NOTICIAS,
    IMAGEN_MAX_BYTES, IMAGEN_TIPOS, CATEGORIAS_SUGERIDAS,
} from '../../../../core/models/noticias.model';

@Component({
    selector: 'app-noticias',
    standalone: true,
    imports: [ReactiveFormsModule, QuillModule],
    templateUrl: './noticias.component.html',
    styleUrl: './noticias.component.css',
})
export class NoticiasComponent implements OnInit {
    private readonly service = inject(NoticiasService);
    private readonly avisos = inject(NotificacionesService);
    private readonly fb = inject(FormBuilder);

    readonly categoriasSugeridas = CATEGORIAS_SUGERIDAS;

    readonly noticias = signal<Noticia[]>([]);
    readonly cargando = signal(true);
    readonly error = signal<string | null>(null);

    readonly sinImagen = computed(() =>
        this.noticias().filter((n) => !n.imagenUrl).length,
    );

    readonly sinContenido = computed(() =>
        this.noticias().filter((n) => !n.contenido).length,
    );

    /* --- Modal --- */
    readonly editando = signal<Noticia | null>(null);
    readonly guardando = signal(false);
    readonly errorFormulario = signal<string | null>(null);
    readonly sugiriendoSlug = signal(false);

    /* --- Reordenamiento --- */
    readonly indiceArrastrado = signal<number | null>(null);
    readonly puedeArrastrar = signal(false);
    readonly reordenando = signal(false);

    /** Orden previo al arrastre, para poder revertir si la API falla. */
    private ordenOriginal: Noticia[] = [];

    /** Archivo elegido y su vista previa (object URL) mientras no se guarda. */
    readonly archivo = signal<File | null>(null);
    readonly previa = signal<string | null>(null);

    /** Barra del editor: solo lo que el sitio público sabe estilizar. */
    readonly quillModules = {
        toolbar: [
            ['bold', 'italic', 'underline'],
            [{ header: 2 }, { header: 3 }],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['blockquote', 'link'],
            ['clean'],
        ],
    };

    readonly formulario = this.fb.nonNullable.group({
        titulo: ['', [Validators.required, Validators.maxLength(160)]],
        slug: ['', [
            Validators.required,
            Validators.maxLength(180),
            Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        ]],
        descripcion: ['', [Validators.required, Validators.maxLength(255)]],
        contenido: [''],
        etiqueta: ['', [Validators.required, Validators.maxLength(40)]],
        fecha: ['', [Validators.required]],
        imagenAlt: ['', [Validators.maxLength(150)]],
    });

    ngOnInit(): void {
        this.cargar();
    }

    cargar(): void {
        this.cargando.set(true);
        this.error.set(null);

        this.service.listar().subscribe({
            next: (data) => {
                this.noticias.set(data);
                this.cargando.set(false);
            },
            error: () => {
                this.error.set('No se pudieron cargar las noticias.');
                this.cargando.set(false);
            },
        });
    }

    /* ===========================================
       Presentación
       =========================================== */
    imagen(noticia: Noticia): string | null {
        return this.service.urlAbsoluta(noticia.imagenUrl);
    }

    /** '2026-06-02' → '2 junio 2026' */
    fecha(noticia: Noticia): string {
        const meses = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
        ];
        const [anio, mes, dia] = noticia.fecha.slice(0, 10).split('-').map(Number);
        return `${dia} ${meses[mes - 1]} ${anio}`;
    }

    lectura(noticia: Noticia): string {
        return noticia.tiempoLectura ? `${noticia.tiempoLectura} min` : 'Sin contenido';
    }

    /* ===========================================
       Modal
       =========================================== */
    abrirModalEditar(noticia: Noticia): void {
        this.formulario.reset({
            titulo: noticia.titulo,
            slug: noticia.slug,
            descripcion: noticia.descripcion,
            contenido: noticia.contenido ?? '',
            etiqueta: noticia.etiqueta,
            // El input type="date" espera yyyy-MM-dd; la BD puede mandar ISO completo.
            fecha: noticia.fecha.slice(0, 10),
            imagenAlt: noticia.imagenAlt ?? '',
        });

        this.limpiarArchivo();
        this.errorFormulario.set(null);
        this.editando.set(noticia);
    }

    cerrarModal(): void {
        if (this.guardando()) return;
        this.limpiarArchivo();
        this.editando.set(null);
        this.errorFormulario.set(null);
    }

    @HostListener('document:keydown.escape')
    cerrarConEscape(): void {
        if (this.editando()) this.cerrarModal();
    }

    /** La vista previa es un object URL: hay que revocarlo para no filtrar memoria. */
    private limpiarArchivo(): void {
        const previa = this.previa();
        if (previa) URL.revokeObjectURL(previa);
        this.previa.set(null);
        this.archivo.set(null);
    }

    /* ===========================================
       Slug
       =========================================== */
    /** Pide al backend un slug a partir del título capturado. */
    generarSlug(): void {
        const noticia = this.editando();
        const titulo = this.formulario.controls.titulo.value.trim();

        if (!noticia || !titulo) {
            this.errorFormulario.set('Escribe primero el título.');
            return;
        }

        this.sugiriendoSlug.set(true);

        this.service.sugerirSlug(noticia.id, titulo).subscribe({
            next: ({ slug }) => {
                this.formulario.controls.slug.setValue(slug);
                this.sugiriendoSlug.set(false);
            },
            error: (e) => {
                this.sugiriendoSlug.set(false);
                this.errorFormulario.set(this.mensajeDeError(e));
            },
        });
    }

    /** Se muestra bajo el campo para que el admin vea la URL final. */
    urlPreview(): string {
        return `/noticias/${this.formulario.controls.slug.value || '…'}`;
    }

    /** True cuando el slug cambió respecto al guardado: se avisa del riesgo. */
    slugModificado(): boolean {
        const noticia = this.editando();
        return !!noticia && this.formulario.controls.slug.value !== noticia.slug;
    }

    usarCategoria(categoria: string): void {
        this.formulario.controls.etiqueta.setValue(categoria);
    }

    /* ===========================================
       Selección de imagen
       =========================================== */
    alElegirArchivo(evento: Event): void {
        const input = evento.target as HTMLInputElement;
        const archivo = input.files?.[0];
        input.value = ''; // permite volver a elegir el mismo archivo

        if (!archivo) return;

        if (!IMAGEN_TIPOS.includes(archivo.type)) {
            this.errorFormulario.set('Formato no admitido. Usa JPG, PNG o WEBP.');
            return;
        }

        if (archivo.size > IMAGEN_MAX_BYTES) {
            this.errorFormulario.set('La imagen pesa más de 3 MB.');
            return;
        }

        this.limpiarArchivo();
        this.archivo.set(archivo);
        this.previa.set(URL.createObjectURL(archivo));
        this.errorFormulario.set(null);
    }

    quitarSeleccion(): void {
        this.limpiarArchivo();
    }

    /** Vista previa nueva si la hay; si no, la imagen ya guardada. */
    imagenModal(): string | null {
        return this.previa() ?? this.imagen(this.editando()!);
    }

    /* ===========================================
       Guardar
       =========================================== */
    guardar(): void {
        const noticia = this.editando();
        if (!noticia) return;

        if (this.formulario.invalid) {
            this.formulario.markAllAsTouched();
            this.errorFormulario.set('Revisa los campos marcados.');
            return;
        }

        const v = this.formulario.getRawValue();

        // Quill deja '<p><br></p>' cuando el editor queda vacío.
        const contenido = this.estaVacio(v.contenido) ? '' : v.contenido;

        const payload: ActualizarNoticiaPayload = {
            titulo: v.titulo.trim(),
            slug: v.slug.trim(),
            descripcion: v.descripcion.trim(),
            contenido,
            etiqueta: v.etiqueta.trim(),
            fecha: v.fecha,
            imagenAlt: v.imagenAlt.trim(),
        };

        const nueva = this.archivo();

        this.guardando.set(true);
        this.errorFormulario.set(null);

        this.service.actualizar(noticia.id, payload).pipe(
            switchMap((guardada) =>
                nueva ? this.service.subirImagen(noticia.id, nueva) : of(guardada),
            ),
        ).subscribe({
            next: (guardada) => {
                this.guardando.set(false);
                this.noticias.update((lista) =>
                    lista.map((n) => (n.id === guardada.id ? guardada : n)),
                );
                this.limpiarArchivo();
                this.editando.set(null);
                this.avisos.exito('Noticia actualizada.');
            },
            error: (e) => {
                this.guardando.set(false);
                this.errorFormulario.set(this.mensajeDeError(e));
                // Los datos pudieron guardarse aunque la imagen fallara.
                this.cargar();
            },
        });
    }

    /** Quill nunca devuelve cadena vacía: marca el editor vacío con etiquetas. */
    private estaVacio(html: string): boolean {
        return !html || html.replace(/<[^>]*>/g, '').trim() === '';
    }

    /** El ValidationPipe de Nest manda `message` como string o como arreglo. */
    private mensajeDeError(e: any): string {
        const mensaje = e?.error?.message;
        if (Array.isArray(mensaje)) return mensaje[0];
        if (typeof mensaje === 'string') return mensaje;
        return 'No se pudo guardar la noticia.';
    }

    /* ===========================================
       Reordenamiento (drag & drop nativo)
       =========================================== */
    activarArrastre(): void {
        if (!this.reordenando()) this.puedeArrastrar.set(true);
    }

    desactivarArrastre(): void {
        this.puedeArrastrar.set(false);
    }

    alIniciarArrastre(indice: number, evento: DragEvent): void {
        if (!this.puedeArrastrar()) {
            evento.preventDefault();
            return;
        }

        this.ordenOriginal = [...this.noticias()];
        this.indiceArrastrado.set(indice);

        if (evento.dataTransfer) {
            evento.dataTransfer.effectAllowed = 'move';
            // Firefox no dispara el arrastre si no se escribe algo aquí.
            evento.dataTransfer.setData('text/plain', String(indice));
        }
    }

    alPasarSobre(indice: number, evento: DragEvent): void {
        evento.preventDefault();

        const origen = this.indiceArrastrado();
        if (origen === null || origen === indice) return;

        this.noticias.update((lista) => {
            const copia = [...lista];
            const [movida] = copia.splice(origen, 1);
            copia.splice(indice, 0, movida);
            return copia;
        });

        this.indiceArrastrado.set(indice);
    }

    alSoltar(evento: DragEvent): void {
        evento.preventDefault();
    }

    alTerminarArrastre(): void {
        const habiaArrastre = this.indiceArrastrado() !== null;

        this.indiceArrastrado.set(null);
        this.puedeArrastrar.set(false);

        if (!habiaArrastre) return;

        const idsNuevos = this.noticias().map((n) => n.id);
        const idsPrevios = this.ordenOriginal.map((n) => n.id);

        // Si se soltó en el mismo lugar, no hay nada que guardar.
        if (idsNuevos.join() === idsPrevios.join()) return;

        this.guardarOrden(idsNuevos);
    }

    private guardarOrden(ids: number[]): void {
        this.reordenando.set(true);

        this.service.reordenar({ ids }).subscribe({
            next: (lista) => {
                this.reordenando.set(false);
                this.noticias.set(lista);
                this.avisos.exito('Se actualizó el orden de las noticias.');
            },
            error: (e) => {
                this.reordenando.set(false);
                this.noticias.set(this.ordenOriginal);
                this.avisos.error(this.mensajeDeError(e));
            },
        });
    }
}