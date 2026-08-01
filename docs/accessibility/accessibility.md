# Accesibilidad — Dogtoralia (Fase 12)

> Revisión de accesibilidad del panel web y del portal público, con checklist de
> verificación y hallazgos. Fecha: 2026-07-29. Base normativa de referencia:
> WCAG 2.1 AA como guía (no certificación).

## 1. Fundamentos ya presentes

- **Base de componentes Radix/shadcn** (`packages/ui`): primitivos accesibles
  (foco gestionado, roles ARIA, navegación por teclado) para diálogos, menús,
  selects y demás controles interactivos.
- **Idioma declarado**: el layout raíz fija `<html lang="es-MX">`
  (`apps/web/src/app/layout.tsx`), de modo que lectores de pantalla y el
  navegador aplican la pronunciación y tipografía correctas.
- **Etiquetas de formulario**: el componente `FormField` (`packages/ui`) asocia
  siempre `<Label htmlFor>` con su control, marca los campos requeridos y
  anuncia los errores con `role="alert"` y `aria-describedby`. Los mensajes de
  validación (Zod, es-MX) son texto claro para el usuario.
- **Navegación por teclado y foco visible**: los enlaces y botones usan
  `focus-visible:ring-2 focus-visible:ring-ring`; no se elimina el outline del
  foco. Los controles interactivos son `<a>`/`<button>` reales (no `div`
  clicables).
- **Semántica de landmarks**: los layouts usan `<header>`, `<main>`, `<footer>`
  y `<nav aria-label>`. El layout del portal público envuelve el contenido en un
  único `<main>`; las páginas aportan un `<h1>` único y jerarquía `h2`.
- **i18n**: ningún texto de UI vive suelto en JSX (CLAUDE.md §12); esto permite
  traducir y mantener consistencia de etiquetas accesibles.
- **Contraste del tema**: la paleta define tokens `ink`/`ink-muted` sobre
  `surface`/`surface-muted` y `brand-*` con contraste suficiente para texto; los
  estados de foco usan un anillo de alto contraste (`ring`).
- **Contenido no textual**: los emojis decorativos (p. ej. 🐾 en la marca) se
  marcan con `aria-hidden="true"` para no ensuciar el árbol de accesibilidad.

## 2. Páginas legales (Fase 12)

- `/aviso-de-privacidad` y `/terminos` se renderizan dentro del `<main>` del
  layout del portal, con `<article>` que contiene un `<h1>` único, una
  `<section>` por apartado encabezada por `<h2>` y párrafos legibles.
- Incluyen un `<nav aria-label>` con enlace «Volver al inicio» y foco visible.
- Ancho de lectura acotado (`max-w-3xl`) para legibilidad de textos largos.

## 3. Checklist de revisión

| Área           | Criterio                                             | Estado |
| -------------- | ---------------------------------------------------- | ------ |
| Idioma         | `<html lang="es-MX">` presente                       | ✅     |
| Landmarks      | `header`/`main`/`footer`/`nav` con etiqueta          | ✅     |
| Encabezados    | `h1` único por página + jerarquía `h2`               | ✅     |
| Formularios    | label asociado + error anunciado (`FormField`)       | ✅     |
| Teclado        | foco visible, controles nativos, sin trampas de foco | ✅     |
| Enlaces        | texto de enlace descriptivo (sin «clic aquí» vacío)  | ✅     |
| Imágenes/emoji | decorativos con `aria-hidden`; alt donde aplique     | ✅     |
| Contraste      | tokens de texto/fondo y anillo de foco suficientes   | ✅     |
| i18n           | sin cadenas sueltas; etiquetas vía diccionario es-MX | ✅     |

## 4. Hallazgos y arreglos aplicados (Fase 12)

- **Pie de página**: los apartados «Aviso de privacidad» y «Términos» eran texto
  plano no accesible (`<p>` sin acción). Se convirtieron en enlaces reales
  (`<Link>`) dentro de un `<nav aria-label="Legal">`, con foco visible,
  apuntando a las nuevas páginas legales. Antes eran marcadores «(próximamente)».

No se detectaron otras barreras que requirieran refactors. Las mejoras mayores
(auditoría con lector de pantalla end-to-end y pruebas automatizadas de a11y en
CI) quedan como trabajo de mejora continua post-beta.

## 5. Recomendaciones futuras (no bloqueantes)

- Integrar `@axe-core/playwright` a los E2E para detección automática de
  regresiones de accesibilidad.
- Verificar contraste con herramienta automatizada al ajustar la paleta.
- Añadir un enlace «Saltar al contenido» al inicio de los layouts.
