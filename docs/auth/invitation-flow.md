# Flujo de invitaciones

> Fase 3. RPCs: `invite_clinic_member`, `resend_clinic_invitation`,
> `accept_clinic_invitation`. El token viaja SOLO en el enlace del correo.

## Crear (admins de clínica u organización)

1. Formulario en `/app/personal`: clínica, correo, rol y nombre opcional (solo para el
   saludo del correo; NO es identidad oficial).
2. La RPC valida permisos, normaliza el correo, rechaza duplicados pendientes
   (clínica+correo+rol), genera un token aleatorio de 256 bits y guarda ÚNICAMENTE su
   hash SHA-256. Devuelve el token UNA sola vez.
3. El servidor construye `{APP_URL}/invitaciones/{token}` y lo entrega al proveedor de
   correo. El token no se persiste, no va a logs (redacción a últimos 4 caracteres), no va
   a analytics ni a mensajes de error.

## Consistencia invitación ↔ correo

Crear y enviar son operaciones distintas y así se manejan:

1. La invitación se crea transaccionalmente (existe aunque el correo falle).
2. Se intenta el envío y se registra el resultado operativo NO sensible
   (`invitacion.correo.enviado|fallo`).
3. Si falla, la UI informa “invitación creada, correo no enviado” y ofrece **Reenviar**.
4. Los reintentos no duplican: el índice único de pendientes lo impide.
5. **Reenviar** = `resend_clinic_invitation`: genera token nuevo y REEMPLAZA el hash en la
   misma fila (el enlace anterior queda inválido al instante) extendiendo la vigencia.
   Nunca se reconstruye un token desde su hash.

## Aceptar (`/invitaciones/[token]`)

- La página nunca acepta automáticamente: muestra contexto y un botón explícito.
- Sin sesión: botones a iniciar sesión/registro conservando `next=/invitaciones/{token}`.
- Con sesión: muestra el correo autenticado y el botón de aceptar; la RPC valida estado
  `pending`, vigencia y que el correo del JWT coincida con el invitado, y crea (atómico)
  la membresía de organización (`member`) si falta + la membresía de clínica con el rol
  invitado + marca `accepted`.
- Errores manejados en UI: vencida, ya usada/revocada, correo distinto, membresía
  suspendida, ya es miembro, formato inválido.
- La página lleva `robots: noindex` (el URL contiene el token).

## Revocar

`UPDATE status: pending → revoked` — única mutación directa permitida a clientes sobre
invitaciones (política RLS + GRANT de columna `status`).

## Qué NO puede hacer un cliente

Leer `token_hash` (columna sin GRANT), crear invitaciones por INSERT directo, marcar
`accepted`/`expired` a mano, ni reenviar sin ser admin. Probado en pgTAP (suites 05 y 06).
