# Despliegue a producción (Vercel + Supabase + dominio propio)

Runbook para publicar Dogtoralia en tu dominio. Arquitectura de despliegue:

- **Web (Next.js App Router)** → **Vercel** (build desde Git, HTTPS y dominio automáticos).
- **Backend (PostgreSQL + Auth + Storage + Edge Functions)** → **Supabase Cloud** (proyecto hosted).
- **Correo transaccional** → **Resend** (con dominio verificado).
- **Recordatorios programados** → `pg_cron` + `pg_net` dentro de Supabase (golpean la Edge Function
  `send-reminders`).

> **Estado real de este despliegue (ago 2026):**
>
> - **Dominio:** `dogtoralia.mx` (registrado y con DNS en **Hostinger / hPanel**).
> - **Web ya desplegada en Vercel**, accesible temporalmente en `https://dogtoralia-chi.vercel.app`.
> - **Supabase de producción:** proyecto `izixhghxlmsfjwsbohxt`
>   (`https://izixhghxlmsfjwsbohxt.supabase.co`), ya cableado en Vercel
>   (`NEXT_PUBLIC_SUPABASE_URL`).
> - **Decisión de dominio:** la app **reemplaza la raíz** — `dogtoralia.mx` (+`www`) apuntará a
>   Vercel y sustituirá al sitio WordPress que hoy sirve Hostinger en esa dirección. Ver el paso 8,
>   que está escrito para este caso concreto.
>
> Donde el documento diga `<PROJECT_REF>`, usa `izixhghxlmsfjwsbohxt` (no es secreto: ya aparece en
> la cabecera CSP pública del sitio).

> **Regla de oro (CLAUDE.md §1-2):** ningún secreto se commitea. La `service_role key`, el
> `CRON_SECRET` y el `RESEND_API_KEY` viven **solo** en el gestor de secretos de cada plataforma
> (Vercel Environment Variables, Supabase Function Secrets / Vault). **La `service_role` jamás se
> configura en Vercel** (la web no la usa en runtime; solo Edge Functions).

---

## 0. Qué necesitas tener a la mano

| Requisito                            | Nota                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| Cuenta de **GitHub** con el repo     | Ya lo tienes (`sdisaacsolis-commits/isaac-solis`, `main` en verde).                      |
| Cuenta de **Vercel**                 | Gratis para empezar; conecta tu GitHub.                                                  |
| Cuenta de **Supabase**               | Plan Free sirve para beta; **Pro** recomendado para backups diarios y `pg_cron` estable. |
| Cuenta de **Resend**                 | Para correo real. Requiere verificar tu dominio.                                         |
| Tu **dominio** y acceso a su **DNS** | Para apuntar registros A/CNAME y verificar el correo.                                    |
| **Supabase CLI**                     | Ya es dependencia del repo: usa `pnpm exec supabase ...`.                                |

Versiones que fija el repo: **Node 22** (`.nvmrc`), **pnpm 10.33.0** (`packageManager`).

---

## 1. Crear el proyecto Supabase de producción

1. En <https://supabase.com/dashboard> → **New project**.
   - **Name**: `dogtoralia-prod` (o el que prefieras).
   - **Database Password**: genera una fuerte y **guárdala** (la necesitarás para `db push`).
   - **Region**: la más cercana a México — `East US (North Virginia)` o `West US`. Elige una y no la
     cambies después.
2. Cuando termine de aprovisionar, en **Project Settings → API** anota:
   - **Project URL** → `https://<PROJECT_REF>.supabase.co`
   - **`anon` public key**
   - **`service_role` key** (secreta — solo para Edge Functions).
3. En **Project Settings → General** anota el **Reference ID** (`<PROJECT_REF>`).

---

## 2. Aplicar el esquema (migraciones) a producción

Todo el esquema vive en `supabase/migrations/` (fuente de verdad). Se aplica con `db push` — **no**
uses el dashboard para crear tablas a mano (CLAUDE.md §15).

```bash
# Desde la raíz del repo, en tu máquina (necesita Docker sólo para el CLI, no para el push):
pnpm exec supabase login                 # abre el navegador y pega el token
pnpm exec supabase link --project-ref <PROJECT_REF>
#   te pedirá la Database Password del paso 1.

# Vista previa de lo que se aplicará (recomendado):
pnpm exec supabase db push --dry-run

# Aplicar TODAS las migraciones a la base de producción:
pnpm exec supabase db push
```

> **No apliques `supabase/seed.sql`**: son datos ficticios de desarrollo. En producción la base
> arranca vacía y cada clínica crea sus propios datos durante el onboarding (ver
> `docs/beta/onboarding.md`). El plan `beta` gratuito **sí** se crea solo: lo siembra una migración,
> no el seed.

### Verificar el aislamiento en producción (opcional pero recomendado)

La suite pgTAP corre contra una base efímera, no contra prod. Como verificación rápida de que la RLS
quedó **forzada** en todas las tablas, ejecuta en el **SQL Editor** de Supabase:

```sql
select count(*) as tablas_sin_rls_forzada
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and not (c.relrowsecurity and c.relforcerowsecurity);
-- Debe devolver 0.
```

---

## 3. Desplegar las Edge Functions

Hay dos funciones en `supabase/functions/`:

- **`send-reminders`** — procesador programado de recordatorios (activo).
- **`stripe-webhook`** — scaffold de pagos **sin cobros** (`COBRO_ACTIVO=false`); despliégalo para
  tener el endpoint listo, pero no procesa nada hasta post-MVP.

```bash
pnpm exec supabase functions deploy send-reminders --project-ref <PROJECT_REF>
pnpm exec supabase functions deploy stripe-webhook  --project-ref <PROJECT_REF>
```

### Secretos de las funciones (Function Secrets)

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los **inyecta Supabase automáticamente** en las Edge
Functions; **no** los declares. Solo necesitas añadir los tuyos:

```bash
# Genera un CRON_SECRET fuerte (mínimo 16 caracteres):
openssl rand -base64 24

pnpm exec supabase secrets set --project-ref <PROJECT_REF> \
  CRON_SECRET='<EL_CRON_SECRET_GENERADO>' \
  EMAIL_MODE='resend' \
  RESEND_API_KEY='<TU_RESEND_API_KEY>' \
  EMAIL_FROM='Dogtoralia <notificaciones@dogtoralia.mx>' \
  EMAIL_REPLY_TO='soporte@dogtoralia.mx'
```

> Consigue el `RESEND_API_KEY` y verifica el dominio remitente en el **paso 6** antes de poner
> `EMAIL_MODE='resend'`. Mientras tanto puedes desplegar con `EMAIL_MODE='dev'` (no envía nada).

---

## 4. Programar los recordatorios (`pg_cron` + `pg_net` + Vault)

En el **SQL Editor** de Supabase (una sola vez). Esto guarda el secreto en el Vault —nunca en SQL
versionado— y agenda una llamada HTTP cada 15 minutos a `send-reminders`.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Reemplaza <PROJECT_REF> y <EL_CRON_SECRET> por los valores reales:
select vault.create_secret(
  'https://<PROJECT_REF>.functions.supabase.co/send-reminders', 'send_reminders_url');
select vault.create_secret('<EL_CRON_SECRET>', 'send_reminders_cron_secret');

select cron.schedule(
  'send-reminders-cada-15-min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'send_reminders_url'),
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                    where name = 'send_reminders_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Prueba manual de que la función responde (debe dar `200` con un resumen JSON):

```bash
curl -X POST "https://<PROJECT_REF>.functions.supabase.co/send-reminders" \
  -H "Authorization: Bearer <EL_CRON_SECRET>"
```

Para desagendar: `select cron.unschedule('send-reminders-cada-15-min');`
(Detalles y alternativa con Vercel Cron: `supabase/functions/send-reminders/README.md`.)

---

## 5. Configurar Supabase Auth (URLs de redirección)

En **Authentication → URL Configuration**:

- **Site URL**: `https://dogtoralia.mx`
- **Redirect URLs** (añade ambas, exactas):
  - `https://dogtoralia.mx/confirmar`
  - `https://dogtoralia.mx/actualizar-contrasena`

Estas rutas existen en la app (`docs/auth/authentication-flow.md`). Si sirves también en `www`,
añade las variantes con `https://www.dogtoralia.mx/...`.

En **Authentication → Providers → Email**: deja **Confirm email** activado para producción (a
diferencia de local). El correo de confirmación lo enviará el SMTP que configures en el paso 6.

---

## 6. Correo transaccional (Resend + verificación de dominio)

1. En <https://resend.com> → **Domains → Add Domain** → `dogtoralia.mx`.
2. Resend te dará registros **DNS** (SPF `TXT`, **DKIM** `CNAME`, y un `MX` para bounces). Añádelos en
   tu proveedor de DNS y espera a que Resend marque el dominio como **Verified**.
3. **API Keys → Create API Key** → cópiala a `RESEND_API_KEY` (paso 3, secretos de la función; y en
   Vercel, paso 7).
4. Configura un **DMARC** básico (recomendado): registro `TXT` en `_dmarc.dogtoralia.mx` con
   `v=DMARC1; p=none; rua=mailto:dmarc@dogtoralia.mx`.

> **Correo de Supabase Auth (confirmación/recuperación):** por defecto sale del SMTP compartido de
> Supabase con límites bajos. Para producción, en **Authentication → Emails → SMTP Settings** conecta
> tu propio SMTP (Resend ofrece credenciales SMTP) usando `notificaciones@dogtoralia.mx` como
> remitente. Así los correos de auth también salen con tu marca y sin límite de plataforma.

---

## 7. Desplegar la web en Vercel

1. En <https://vercel.com/new> → **Import Git Repository** → elige `isaac-solis`.
2. Configuración del proyecto:
   - **Framework Preset**: `Next.js` (autodetectado).
   - **Root Directory**: **`apps/web`** ← importante (monorepo). Vercel detecta el workspace pnpm y
     corre `pnpm install` en la raíz automáticamente; deja activada la opción _"Include files outside
     the root directory"_ si aparece.
   - **Build Command / Install Command / Output**: deja los valores por defecto. Los paquetes internos
     (`@dogtoralia/ui|types|validation|config`) se consumen como TypeScript fuente, así que
     `next build` los transpila sin paso previo.
   - **Node.js Version**: `22.x`.
3. **Environment Variables** (Production). Añade exactamente estas:

   | Variable                        | Valor                                       | Notas                                                                      |
   | ------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
   | `NEXT_PUBLIC_APP_URL`           | `https://dogtoralia.mx`                     | Tu dominio final (con `https://`, sin `/` final).                          |
   | `NEXT_PUBLIC_SUPABASE_URL`      | `https://<PROJECT_REF>.supabase.co`         | Del paso 1.                                                                |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<anon key>`                                | Del paso 1. Segura para el navegador (RLS protege todo).                   |
   | `EMAIL_MODE`                    | `resend`                                    | La web también envía correos (invitaciones al portal, outbox oportunista). |
   | `RESEND_API_KEY`                | `<tu key de Resend>`                        | Del paso 6. Secreta.                                                       |
   | `EMAIL_FROM`                    | `Dogtoralia <notificaciones@dogtoralia.mx>` | Debe usar el dominio verificado.                                           |
   | `EMAIL_REPLY_TO`                | `soporte@dogtoralia.mx`                     | Opcional.                                                                  |

   > **NO** añadas `SUPABASE_SERVICE_ROLE_KEY` ni `CRON_SECRET` en Vercel: la web no los usa y la
   > `service_role` jamás debe llegar al hosting del cliente (CLAUDE.md §2). Los límites de archivos
   > (`PET_PHOTO_SIGNED_URL_SECONDS`, `CLINICAL_FILE_MAX_MB`, etc.) tienen valores por defecto seguros;
   > solo añádelos si quieres cambiarlos.

4. **Deploy**. El primer build tarda unos minutos. Cuando termine tendrás una URL `*.vercel.app`
   funcional para probar antes de conectar el dominio.

---

## 8. Conectar `dogtoralia.mx` a Vercel (reemplazando el WordPress de Hostinger)

> ⚠️ **Esto es destructivo para el sitio actual:** al cambiar el registro `A` de la raíz, el
> WordPress que hoy sirve Hostinger en `dogtoralia.mx` **dejará de verse** en esa dirección (los
> archivos siguen en tu hosting; es reversible volviendo a apuntar el DNS). Haz los pasos en este
> orden para no quedar caído ni romper el login.

### 8.1 Añadir los dominios en Vercel

En el proyecto de Vercel → **Settings → Domains → Add**, agrega **los dos**:

- `dogtoralia.mx`
- `www.dogtoralia.mx`

Elige el **canónico** en esa misma pantalla (recomendado: apex `dogtoralia.mx`, con `www` →
redirección a apex). Vercel mostrará la configuración DNS esperada y el estado (`Invalid` hasta que
el DNS apunte a Vercel).

### 8.2 Cambiar el DNS en Hostinger (hPanel)

En **hPanel → Dominios → `dogtoralia.mx` → DNS / Nameservers → Zona DNS** (si tus nameservers son de
Hostinger, `nsX.dns-parking.com`; si los cambiaste a otro proveedor, edita ahí):

1. **Registro `A` de la raíz** — edita el existente (hoy apunta a la IP de tu hosting):

   | Tipo | Nombre        | Valor (Vercel) | TTL       |
   | ---- | ------------- | -------------- | --------- |
   | `A`  | `@` (o vacío) | `76.76.21.21`  | 300 (5 m) |

2. **`www`** — elimina cualquier `A`/`CNAME` de `www` que exista y crea:

   | Tipo    | Nombre | Valor (Vercel)         | TTL |
   | ------- | ------ | ---------------------- | --- |
   | `CNAME` | `www`  | `cname.vercel-dns.com` | 300 |

> Los valores exactos (IP del `A` y destino del `CNAME`) los confirma **la pantalla de Vercel**; usa
> esos si difieren de los de arriba.
>
> **NO toques los registros `MX`** ni los `TXT`/`CNAME` de correo (SPF/DKIM) si usas correo con
> `@dogtoralia.mx` en Hostinger: cambiar el `A` web no afecta al correo, y esos registros los
> necesitas también para Resend (paso 6).
>
> **CAA:** si Hostinger tiene un registro `CAA` que restringe emisores de certificados, añade
> `0 issue "letsencrypt.org"` o elimínalo, o Vercel no podrá emitir el TLS.

### 8.3 Esperar validación + TLS

Baja el TTL antes ayuda a que propague rápido (minutos a un par de horas). Cuando en Vercel ambos
dominios aparezcan como **Valid** y con **certificado emitido**, `https://dogtoralia.mx` ya sirve la
app. Verifícalo:

```bash
curl -sI https://dogtoralia.mx | grep -i "server\|x-powered-by"
# Debe decir "server: Vercel" y YA NO "x-powered-by: PHP" (eso sería el WordPress viejo aún cacheado).
```

### 8.4 Apuntar la app y Auth al dominio final

Solo cuando el dominio ya sirva la app por HTTPS:

1. **Vercel → Settings → Environment Variables**: pon
   `NEXT_PUBLIC_APP_URL = https://dogtoralia.mx` (Production) y **redeploy** (Deployments → ⋯ →
   Redeploy) para que la nueva URL entre al bundle y a la CSP.
2. **Supabase → Authentication → URL Configuration** (paso 5): **Site URL** = `https://dogtoralia.mx`
   y añade a **Redirect URLs** `https://dogtoralia.mx/confirmar` y
   `https://dogtoralia.mx/actualizar-contrasena`. Deja también las de `dogtoralia-chi.vercel.app`
   durante la transición (no estorban) y quítalas cuando ya no las uses.

> **Coherencia:** `NEXT_PUBLIC_APP_URL` y el **Site URL** de Supabase deben ser el **mismo** dominio
> canónico (`https://dogtoralia.mx`). Si eliges `www` como canónico, usa esa variante en ambos.

---

## 9. Verificación post-despliegue (smoke test)

Con el dominio en línea, comprueba:

- [ ] La **portada** pública carga (`https://dogtoralia.mx`).
- [ ] `/aviso-de-privacidad` y `/terminos` responden `200`.
- [ ] **Registro** de una cuenta → llega el correo de confirmación → el enlace abre `/confirmar` y
      deja iniciar sesión.
- [ ] Recuperación de contraseña → correo → `/actualizar-contrasena` funciona.
- [ ] Crear una **clínica** y verificar en Supabase que se le creó su **suscripción `beta`**
      automáticamente (`select * from subscriptions;`).
- [ ] Invitar a un propietario al portal → llega el correo de invitación (envío real vía Resend).
- [ ] La cabecera de seguridad responde: `curl -sI https://dogtoralia.mx | grep -i content-security`.
- [ ] `send-reminders` responde `200` a la prueba `curl` del paso 4 y el cron aparece en
      `select * from cron.job;`.

---

## 10. Checklist de seguridad final

- [ ] `service_role key` **solo** en Supabase (Function Secrets), **nunca** en Vercel ni en el repo.
- [ ] `CRON_SECRET` y `RESEND_API_KEY` en el gestor de secretos, no en Git.
- [ ] RLS forzada en todas las tablas (verificación SQL del paso 2 = `0`).
- [ ] Confirmación de correo **activada** en Auth para producción.
- [ ] Buckets de Storage privados (así los crean las migraciones) — el acceso va por URL firmada.
- [ ] Backups: en **Supabase Free** son limitados; considera **Pro** para _Point-in-Time Recovery_
      antes de manejar datos reales de clínicas.
- [ ] **Páginas legales**: `/aviso-de-privacidad` y `/terminos` tienen _placeholders_ y **requieren
      revisión de un abogado** y completar tus datos reales antes de operar (ver `docs/legal/`).

---

## 11. Mapa de dónde va cada variable

| Variable                        | Vercel (web) | Supabase (Edge Functions) | Notas                                    |
| ------------------------------- | :----------: | :-----------------------: | ---------------------------------------- |
| `NEXT_PUBLIC_APP_URL`           |      ✅      |             —             | Dominio final.                           |
| `NEXT_PUBLIC_SUPABASE_URL`      |      ✅      |  (auto: `SUPABASE_URL`)   | —                                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` |      ✅      |             —             | Pública.                                 |
| `SUPABASE_SERVICE_ROLE_KEY`     | ❌ **nunca** |     (auto, inyectada)     | Solo funciones.                          |
| `CRON_SECRET`                   |      ❌      |            ✅             | Compartido con el scheduler (`pg_cron`). |
| `EMAIL_MODE`                    |      ✅      |            ✅             | `resend` en prod.                        |
| `RESEND_API_KEY`                |      ✅      |            ✅             | Secreta.                                 |
| `EMAIL_FROM` / `EMAIL_REPLY_TO` |      ✅      |            ✅             | Dominio verificado en Resend.            |
| `STRIPE_*`                      |      —       |        (post-MVP)         | Vacías: `COBRO_ACTIVO=false`.            |

---

## 12. Despliegue continuo

Tras la configuración inicial, Vercel **redespliega solo** en cada push a `main`. Para cambios de
esquema en el futuro: añade una migración nueva en `supabase/migrations/`, y tras fusionar a `main`
ejecuta `pnpm exec supabase db push` contra producción (las migraciones son inmutables una vez
fusionadas — CLAUDE.md §15). Regenera tipos en el mismo PR (`pnpm db:types`).

> **Requisito**: el despliegue continuo depende de que el proyecto de Vercel tenga el repositorio
> de GitHub conectado (**Settings → Git → Connected Git Repository** = este repo, **Production
> Branch** = `main`). Sin esa conexión, fusionar a `main` NO publica nada y el sitio queda
> congelado en el último build manual — verificado durante la puesta en producción (ago 2026).
> Síntoma típico: rutas nuevas (p. ej. `/aviso-de-privacidad`) responden 404 en el dominio aunque
> ya estén en `main`.

### Bitácora de la base de producción

Las migraciones de las Fases 8.1–11 (`resenas`, `rpc_resenas`, `recordatorios_backend`,
`metricas_admin`, `suscripciones`) se aplicaron al proyecto `izixhghxlmsfjwsbohxt` el
12-sep-2026 vía el Management API de Supabase, con las versiones registradas idénticas a los
archivos de `supabase/migrations/` (verificado: `supabase_migrations.schema_migrations`).
Cualquier `supabase db push` futuro parte de ese estado sin re-aplicar nada. Verificación
post-aplicación: RLS forzada en las 53 tablas (0 hallazgos), plan `beta` sembrado, backfill de
suscripciones completo y `/buscar` en 200.
