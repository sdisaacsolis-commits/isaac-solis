import type { DocumentoLegal } from "./tipos";

/**
 * Aviso de Privacidad Integral conforme a la Ley Federal de Protección de Datos
 * Personales en Posesión de los Particulares (LFPDPPP) y su Reglamento.
 *
 * IMPORTANTE: los datos entre corchetes «[…]» son marcadores de posición que
 * deben completarse con la información legal real de la sociedad responsable
 * antes de operar en producción. No inventar razón social, domicilio ni datos
 * de contacto. Este documento requiere revisión de un abogado (ver
 * `docs/legal/README.md`).
 */
export const avisoPrivacidad: DocumentoLegal = {
  titulo: "Aviso de Privacidad Integral",
  actualizado: "2026-07-29",
  introduccion: [
    "En Dogtoralia protegemos tus datos personales. Este Aviso de Privacidad Integral se emite en cumplimiento de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), su Reglamento y los Lineamientos del Aviso de Privacidad vigentes en México.",
    "Te pedimos leerlo con atención antes de proporcionar tus datos personales o los de tus mascotas a través de la plataforma.",
  ],
  secciones: [
    {
      titulo: "1. Identidad y domicilio del responsable",
      parrafos: [
        "El responsable del tratamiento de tus datos personales es Dogtoralia, operado por [Razón social], con domicilio en [Domicilio fiscal completo, México] y correo electrónico de contacto en materia de privacidad: [correo de contacto: privacidad@dogtoralia.mx].",
        "Cuando utilizas la plataforma como propietario de una mascota, la clínica veterinaria que te atiende también actúa como responsable respecto de los datos clínicos que registra sobre tu mascota. Dogtoralia trata esos datos por cuenta de la clínica en calidad de encargado tecnológico, además de tratar por cuenta propia los datos de tu cuenta.",
      ],
    },
    {
      titulo: "2. Datos personales que recabamos",
      parrafos: [
        "De los propietarios de mascotas recabamos datos de identificación y contacto: nombre, apellidos, correo electrónico y, cuando lo proporcionas, número telefónico. Para tu cuenta almacenamos las credenciales de acceso mediante nuestro proveedor de autenticación; nunca conservamos tu contraseña en texto claro.",
        "Asociados a tu cuenta tratamos datos de tus mascotas y datos de salud animal: nombre, especie, raza, fecha de nacimiento, historial de consultas, diagnósticos, recetas, esquema de vacunación y demás información clínica que la clínica veterinaria registra durante la atención. Estos datos describen a tu mascota; se vinculan a tu cuenta para darte acceso a su expediente.",
        "También recabamos datos de uso técnicos estrictamente necesarios para operar el servicio (por ejemplo, registros de acceso y de actividad para seguridad y auditoría).",
        "No recabamos datos personales sensibles de las personas propietarias (como origen étnico, estado de salud humana, creencias u orientación) a través de la plataforma. No solicites ni registres ese tipo de datos en campos de texto libre.",
      ],
    },
    {
      titulo: "3. Finalidades del tratamiento",
      parrafos: [
        "Finalidades primarias (necesarias para la relación y el servicio): crear y administrar tu cuenta; permitirte buscar clínicas y solicitar, confirmar y gestionar citas; darte acceso al expediente, cartilla de vacunación y recetas de tus mascotas; permitir que la clínica veterinaria te brinde atención y lleve el registro clínico; enviarte notificaciones y recordatorios relacionados con tus citas y la atención de tus mascotas; atender tus solicitudes de soporte; y cumplir obligaciones legales, de seguridad y de auditoría.",
        "Finalidades secundarias (no necesarias para el servicio y a las que puedes oponerte): envío de comunicaciones sobre novedades del producto y mejoras, así como encuestas de satisfacción. Si no deseas que tus datos se traten para estas finalidades, puedes manifestarlo en cualquier momento mediante el mecanismo descrito en la sección de derechos ARCO; tu negativa no será motivo para negarte el servicio.",
      ],
    },
    {
      titulo: "4. Fundamento del tratamiento",
      parrafos: [
        "El tratamiento de tus datos para las finalidades primarias se sustenta en la existencia de la relación de servicio entre tú y Dogtoralia y, en su caso, con la clínica veterinaria, así como en el consentimiento que otorgas al registrarte y utilizar la plataforma, en términos de los artículos 8 y 9 de la LFPDPPP.",
        "Cuando la ley lo permite, ciertos datos se tratan sin requerir consentimiento adicional, por ejemplo cuando sean necesarios para cumplir obligaciones derivadas de la relación jurídica contigo o para cumplir disposiciones legales aplicables.",
      ],
    },
    {
      titulo: "5. Transferencias y encargados",
      parrafos: [
        "Para prestar el servicio nos apoyamos en proveedores tecnológicos que tratan datos por nuestra cuenta y bajo nuestras instrucciones (encargados), entre ellos Supabase (infraestructura de base de datos, autenticación y almacenamiento) y Resend (envío de correo transaccional). Estos proveedores solo tratan los datos para prestarnos el servicio contratado y están obligados a mantener su confidencialidad y seguridad.",
        "No vendemos, ni comercializamos, ni cedemos tus datos personales a terceros con fines de mercadotecnia ajena.",
        "Compartimos los datos de tu mascota con la clínica veterinaria que eliges para tu atención, ya que es indispensable para brindarte el servicio. Podremos transferir datos cuando la ley lo exija o lo permita sin consentimiento, por ejemplo, para atender requerimientos de autoridades competentes debidamente fundados y motivados. En cualquier otro caso solicitaremos tu consentimiento.",
        "Algunos de nuestros proveedores pueden almacenar o procesar datos en servidores ubicados fuera de México. En esos casos adoptamos medidas para que el tratamiento se mantenga conforme a este aviso y a la normativa aplicable.",
      ],
    },
    {
      titulo: "6. Derechos ARCO y su ejercicio",
      parrafos: [
        "Tienes derecho a Acceder a tus datos personales, a Rectificarlos cuando sean inexactos o incompletos, a Cancelarlos cuando consideres que no se requieren para las finalidades señaladas, y a Oponerte a su tratamiento para fines específicos (derechos ARCO). También puedes revocar el consentimiento que nos hayas otorgado y limitar el uso o divulgación de tus datos.",
        "Para ejercer estos derechos, envía tu solicitud al correo [correo de contacto: privacidad@dogtoralia.mx]. La solicitud debe contener: (i) tu nombre y un medio para comunicarte la respuesta; (ii) los documentos que acrediten tu identidad o, en su caso, la representación legal; (iii) la descripción clara de los datos respecto de los que buscas ejercer el derecho; y (iv) cualquier elemento que facilite la localización de los datos.",
        "Responderemos tu solicitud en los plazos que marca la LFPDPPP (por regla general, dentro de los 20 días hábiles siguientes a su recepción; y de proceder, se hará efectiva dentro de los 15 días hábiles posteriores). Ten presente que, por tratarse de datos clínicos y por razones de seguridad y de obligaciones legales, algunos registros de la atención veterinaria son inmutables: en esos casos la cancelación puede no proceder y se conservarán conforme a la normativa aplicable.",
      ],
    },
    {
      titulo: "7. Uso de cookies y tecnologías similares",
      parrafos: [
        "La plataforma utiliza cookies y tecnologías de almacenamiento local estrictamente necesarias para mantener tu sesión iniciada de forma segura y para el correcto funcionamiento del servicio. No utilizamos cookies de publicidad de terceros.",
        "Puedes configurar tu navegador para bloquear o eliminar cookies; sin embargo, deshabilitar las cookies necesarias puede impedir que inicies sesión o uses ciertas funciones.",
      ],
    },
    {
      titulo: "8. Medidas de seguridad",
      parrafos: [
        "Aplicamos medidas de seguridad administrativas, técnicas y físicas para proteger tus datos frente a daño, pérdida, alteración, destrucción o uso, acceso o tratamiento no autorizado. Entre ellas: aislamiento estricto de la información entre clínicas mediante controles a nivel de base de datos, cifrado en tránsito, control de acceso por roles, y registro de auditoría de operaciones sensibles.",
      ],
    },
    {
      titulo: "9. Cambios al aviso de privacidad",
      parrafos: [
        "Este aviso puede actualizarse para reflejar cambios en nuestras prácticas, en el servicio o en la normativa aplicable. Publicaremos la versión vigente en esta misma página e indicaremos la fecha de última actualización. Cuando los cambios sean sustanciales, procuraremos informarte por los medios de contacto que tengamos registrados.",
        "Te recomendamos revisar periódicamente esta página. El uso continuado de la plataforma tras la publicación de cambios implica que has tomado conocimiento de la versión actualizada.",
      ],
    },
  ],
} as const;
