import type { DocumentoLegal } from "./tipos";

/**
 * Términos y Condiciones del servicio Dogtoralia.
 *
 * IMPORTANTE: los datos entre corchetes «[…]» son marcadores de posición que
 * deben completarse con la información legal real antes de operar en producción.
 * Este documento requiere revisión de un abogado (ver `docs/legal/README.md`).
 */
export const terminos: DocumentoLegal = {
  titulo: "Términos y Condiciones",
  actualizado: "2026-07-29",
  introduccion: [
    "Estos Términos y Condiciones («Términos») regulan el acceso y uso de la plataforma Dogtoralia, operada por [Razón social] («Dogtoralia», «nosotros»). Al crear una cuenta o utilizar el servicio, aceptas estos Términos. Si no estás de acuerdo, no utilices la plataforma.",
  ],
  secciones: [
    {
      titulo: "1. Objeto del servicio",
      parrafos: [
        "Dogtoralia es una plataforma de software (SaaS) para la gestión de clínicas veterinarias en México: permite administrar agenda de citas, expedientes clínicos, recetas, esquemas de vacunación y recordatorios, así como ofrecer a los propietarios de mascotas un portal para buscar clínicas, solicitar citas y consultar la información de sus mascotas.",
        "Dogtoralia provee una herramienta tecnológica. No presta servicios de medicina veterinaria ni interviene en la relación clínica entre el profesional y el paciente.",
      ],
    },
    {
      titulo: "2. Cuenta y roles",
      parrafos: [
        "Para usar la plataforma debes crear una cuenta con información veraz y mantenerla actualizada. Eres responsable de la confidencialidad de tus credenciales y de la actividad realizada desde tu cuenta.",
        "La plataforma distingue roles (por ejemplo, personal y administración de la clínica, y propietarios de mascotas). El acceso a la información depende del rol y del vínculo con la clínica correspondiente. Cada clínica es responsable de administrar a su personal y los permisos que le otorga.",
        "Debes ser mayor de edad y contar con capacidad legal para aceptar estos Términos. Si actúas en representación de una clínica u organización, declaras contar con facultades para obligarla.",
      ],
    },
    {
      titulo: "3. Uso aceptable",
      parrafos: [
        "Te comprometes a usar la plataforma conforme a la ley y a estos Términos. Está prohibido, de manera enunciativa: acceder a datos de clínicas o personas a las que no tienes derecho; intentar vulnerar los controles de seguridad o el aislamiento entre clínicas; introducir código malicioso; usar el servicio para fines ilícitos; o registrar información de terceros sin la base legal para ello.",
        "Eres responsable de la información que capturas en la plataforma y de contar con el consentimiento o fundamento necesario para tratar los datos personales que registras.",
      ],
    },
    {
      titulo: "4. Datos clínicos y responsabilidad profesional",
      parrafos: [
        "Las decisiones médicas, diagnósticos, tratamientos, dosis y prescripciones son responsabilidad exclusiva del médico veterinario tratante, con base en su juicio profesional y su cédula. Dogtoralia no practica medicina veterinaria, no calcula dosis, no sugiere medicamentos ni sustituye el criterio profesional.",
        "La plataforma es una herramienta de registro y consulta. La información mostrada a los propietarios tiene fines informativos y no constituye asesoría veterinaria. Ante una urgencia o duda de salud de tu mascota, acude a un médico veterinario.",
        "Por integridad del expediente y cumplimiento normativo, ciertos registros clínicos (por ejemplo, consultas cerradas y recetas emitidas) son inmutables; las correcciones se realizan mediante adendas y no mediante la eliminación de la información original.",
      ],
    },
    {
      titulo: "5. Propiedad intelectual",
      parrafos: [
        "El software, la marca, el diseño y los contenidos de la plataforma son propiedad de Dogtoralia o de sus licenciantes y están protegidos por la legislación aplicable. Se te otorga una licencia limitada, no exclusiva e intransferible para usar el servicio conforme a estos Términos.",
        "La información y los datos que tú o tu clínica capturan siguen siendo de su titularidad; nos otorgas únicamente los permisos necesarios para operar y prestarte el servicio.",
      ],
    },
    {
      titulo: "6. Disponibilidad del servicio (fase beta)",
      parrafos: [
        "Actualmente el servicio se ofrece en fase beta y se proporciona «tal cual» y «según disponibilidad», sin garantías de continuidad, ausencia de errores o idoneidad para un fin particular. Durante la beta pueden ocurrir interrupciones, cambios de funcionalidad o pérdidas de datos derivadas de tareas de mantenimiento.",
        "Te recomendamos mantener respaldos de la información crítica. Podremos modificar, suspender o descontinuar funciones del servicio, procurando avisar con antelación razonable cuando sea posible.",
      ],
    },
    {
      titulo: "7. Limitación de responsabilidad",
      parrafos: [
        "En la máxima medida permitida por la ley, Dogtoralia no será responsable por daños indirectos, incidentales o consecuentes, ni por lucro cesante, pérdida de datos o interrupción del negocio derivados del uso o la imposibilidad de uso del servicio.",
        "Dogtoralia no es responsable de las decisiones clínicas ni de la calidad de la atención veterinaria prestada por las clínicas o profesionales que usan la plataforma, ni de la exactitud de la información que estos capturan.",
      ],
    },
    {
      titulo: "8. Protección de datos personales",
      parrafos: [
        "El tratamiento de datos personales se rige por nuestro Aviso de Privacidad Integral, disponible en la sección correspondiente de la plataforma. Al aceptar estos Términos reconoces haberlo leído.",
      ],
    },
    {
      titulo: "9. Ley aplicable y jurisdicción",
      parrafos: [
        "Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier controversia, las partes se someten a la jurisdicción de los tribunales competentes de [Ciudad, México], renunciando a cualquier otro fuero que pudiera corresponderles.",
      ],
    },
    {
      titulo: "10. Contacto",
      parrafos: [
        "Para dudas sobre estos Términos o el servicio, escríbenos a [correo de contacto: privacidad@dogtoralia.mx]. Podremos actualizar estos Términos; publicaremos la versión vigente en esta página con su fecha de actualización, y el uso continuado del servicio implica su aceptación.",
      ],
    },
  ],
} as const;
