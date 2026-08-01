# Documentos legales — fuentes y estado

Las páginas legales públicas de Dogtoralia se renderizan desde una **fuente
única** de contenido es-MX, no desde cadenas sueltas en JSX (CLAUDE.md §10, §12).

## Fuentes de contenido

| Página                                 | Ruta pública           | Fuente del texto                             |
| -------------------------------------- | ---------------------- | -------------------------------------------- |
| Aviso de Privacidad Integral (LFPDPPP) | `/aviso-de-privacidad` | `apps/web/src/lib/legal/aviso-privacidad.ts` |
| Términos y Condiciones                 | `/terminos`            | `apps/web/src/lib/legal/terminos.ts`         |

- Tipos compartidos: `apps/web/src/lib/legal/tipos.ts`
  (`DocumentoLegal`, `SeccionLegal`).
- Barrel de exportación: `apps/web/src/lib/legal/index.ts`.
- Componente de render accesible:
  `apps/web/src/components/portal/documento-legal.tsx`.
- Encabezados/nav mínimos vía i18n: namespace `legal` en
  `apps/web/src/lib/i18n/es-mx.ts`.

Para editar un texto legal, modifica el archivo de contenido correspondiente en
`apps/web/src/lib/legal/`; ambas páginas se actualizan solas.

## ⚠️ Revisión legal requerida antes de producción

El contenido es sustantivo y está redactado conforme a la **LFPDPPP**, pero:

- Contiene **marcadores de posición entre corchetes** «[Razón social]»,
  «[Domicilio]», «[Ciudad, México]» y «[correo de contacto:
  privacidad@dogtoralia.mx]» que deben completarse con los datos legales
  **reales** de la sociedad responsable. No inventar datos legales.
- **Debe ser revisado y aprobado por un abogado** antes de operar en producción
  con clínicas y usuarios reales. Este material no constituye asesoría legal.

El responsable declarado del tratamiento es **Dogtoralia**. Cumplimiento de
referencia: Ley Federal de Protección de Datos Personales en Posesión de los
Particulares (LFPDPPP) y su Reglamento.
