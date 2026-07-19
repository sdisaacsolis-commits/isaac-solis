/**
 * Capa mínima de i18n (CLAUDE.md §12): ningún texto de UI vive suelto en JSX.
 *
 * Fase 1: un solo diccionario `es-MX` tipado. Cuando se agreguen idiomas, este módulo
 * se sustituye por una librería de i18n manteniendo las mismas llaves.
 */
export const mensajes = {
  marca: {
    nombre: "Dogtoralia",
    eslogan: "Gestión veterinaria, agenda y cuidado de mascotas en un solo lugar",
  },
  meta: {
    tituloPorDefecto: "Dogtoralia — Gestión veterinaria",
    plantillaTitulo: "%s | Dogtoralia",
    descripcion: "Gestión veterinaria, agenda y cuidado de mascotas en un solo lugar.",
  },
  inicio: {
    etiquetaHero: "Plataforma veterinaria mexicana",
    descripcionHero:
      "Dogtoralia conecta clínicas veterinarias, médicos veterinarios y propietarios de mascotas para que el bienestar animal sea más simple, ordenado y confiable.",
    botonProximamente: "Próximamente",
    tituloBotonProximamente: "Disponible próximamente",
    etiquetaSeccionModulos: "Módulos en desarrollo",
    enDesarrollo: "En desarrollo",
    modulos: [
      {
        titulo: "Agenda inteligente",
        descripcion:
          "Citas por veterinario sin traslapes, con confirmación, reprogramación y recordatorios automáticos.",
      },
      {
        titulo: "Expediente clínico",
        descripcion:
          "Historial completo de cada mascota: consultas, vacunas, desparasitaciones, diagnósticos y recetas.",
      },
      {
        titulo: "Cuidado conectado",
        descripcion:
          "Los propietarios reciben recordatorios de citas y vacunas, y consultan el historial de sus mascotas.",
      },
    ],
    derechos: "Todos los derechos reservados.",
    lemaPie: "Hecho en México con amor por los animales.",
  },
} as const;
