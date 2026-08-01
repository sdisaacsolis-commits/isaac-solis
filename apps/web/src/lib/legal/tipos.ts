/**
 * Tipos compartidos del contenido legal (Aviso de Privacidad, Términos).
 *
 * El texto legal es la ÚNICA fuente localizable en es-MX y vive en este módulo
 * (`apps/web/src/lib/legal/`), nunca suelto en JSX (CLAUDE.md §12). Las páginas
 * lo renderizan a partir de estas estructuras.
 */

/** Una sección con encabezado (`<h2>`) y uno o más párrafos. */
export type SeccionLegal = {
  readonly titulo: string;
  readonly parrafos: readonly string[];
};

/** Documento legal completo listo para renderizar. */
export type DocumentoLegal = {
  /** Título principal de la página (`<h1>`). */
  readonly titulo: string;
  /** Fecha de última actualización en formato ISO (AAAA-MM-DD). */
  readonly actualizado: string;
  /** Entradilla opcional antes de las secciones numeradas. */
  readonly introduccion?: readonly string[];
  readonly secciones: readonly SeccionLegal[];
};
