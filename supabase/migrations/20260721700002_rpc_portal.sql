-- ============================================================================
-- Fase 8 — Portal público: RPCs de lectura curada, reservación de invitado y
-- portal del propietario
-- ============================================================================
-- El sitio público (anon) y el portal del propietario JAMÁS leen tablas base:
-- toda la superficie es SECURITY DEFINER con campos curados (nunca notas
-- internas, nunca datos clínicos en lo público, nunca datos de otras
-- organizaciones).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Lectura pública (anon): clínicas, veterinarios, ciudades y huecos reales
-- ----------------------------------------------------------------------------

-- Clínicas visibles públicamente: opt-in explícito y operativas.
create or replace function public.clinic_is_publicly_visible(p_clinic_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.clinics c
    where c.id = p_clinic_id and c.is_public and c.deleted_at is null
      and c.status in ('trial', 'active')
  );
$$;

create or replace function public.search_public_clinics(
  p_q text default null,
  p_city text default null,
  p_category public.service_category default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(fila), '[]'::jsonb) from (
    select jsonb_build_object(
      'slug', c.slug, 'name', c.name, 'city', c.city, 'state', c.state,
      'neighborhood', c.neighborhood, 'description', left(c.description, 300),
      'accepts_online_booking', c.accepts_online_booking,
      'services_count', (select count(*) from public.clinic_services s
                         where s.clinic_id = c.id and s.active),
      'price_from_cents', (select min(s.price_cents) from public.clinic_services s
                           where s.clinic_id = c.id and s.active)
    ) as fila
    from public.clinics c
    where public.clinic_is_publicly_visible(c.id)
      and c.slug is not null
      and (p_q is null or c.name ilike '%' || p_q || '%'
           or exists (select 1 from public.clinic_services s
                      where s.clinic_id = c.id and s.active
                        and s.name ilike '%' || p_q || '%'))
      and (p_city is null or c.city ilike p_city)
      and (p_category is null or exists (
            select 1 from public.clinic_services s
            where s.clinic_id = c.id and s.category = p_category
              and s.active))
    order by c.name
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
    offset greatest(coalesce(p_offset, 0), 0)
  ) filas;
$$;

create or replace function public.get_public_clinic(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'slug', c.slug, 'name', c.name, 'description', c.description,
    'phone', c.phone, 'email', c.email,
    'address_line_1', c.address_line_1, 'address_line_2', c.address_line_2,
    'neighborhood', c.neighborhood, 'city', c.city, 'state', c.state,
    'postal_code', c.postal_code, 'timezone', c.timezone,
    'accepts_online_booking', c.accepts_online_booking,
    'services', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'category', s.category,
        'duration_minutes', s.duration_minutes, 'price_cents', s.price_cents,
        'description', s.description) order by s.name), '[]'::jsonb)
      from public.clinic_services s
      where s.clinic_id = c.id and s.active
    ),
    'veterinarians', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'clinic_member_id', m.id,
        'display_name', coalesce(pr.display_name,
          nullif(btrim(concat(pr.first_name, ' ', pr.last_name)), '')),
        'professional_license', m.professional_license,
        'profile_slug', (select vp.slug from public.veterinarian_public_profiles vp
                         where vp.user_id = m.user_id and vp.is_public
                           and vp.deleted_at is null)
      ) order by pr.display_name), '[]'::jsonb)
      from public.clinic_members m
      join public.profiles pr on pr.id = m.user_id
      where m.clinic_id = c.id and m.role = 'veterinarian'
        and m.status = 'active' and m.deleted_at is null
    )
  )
  from public.clinics c
  where c.slug = p_slug and public.clinic_is_publicly_visible(c.id);
$$;

create or replace function public.get_public_veterinarian(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'slug', vp.slug, 'headline', vp.headline, 'bio', vp.bio,
    'display_name', coalesce(pr.display_name,
      nullif(btrim(concat(pr.first_name, ' ', pr.last_name)), '')),
    'clinics', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'clinic_slug', c.slug, 'clinic_name', c.name, 'city', c.city,
        'state', c.state, 'accepts_online_booking', c.accepts_online_booking,
        'clinic_member_id', m.id, 'professional_license', m.professional_license
      ) order by c.name), '[]'::jsonb)
      from public.clinic_members m
      join public.clinics c on c.id = m.clinic_id
      where m.user_id = vp.user_id and m.role = 'veterinarian'
        and m.status = 'active' and m.deleted_at is null
        and public.clinic_is_publicly_visible(c.id) and c.slug is not null
    )
  )
  from public.veterinarian_public_profiles vp
  join public.profiles pr on pr.id = vp.user_id
  where vp.slug = p_slug and vp.is_public and vp.deleted_at is null;
$$;

create or replace function public.list_public_cities()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('city', city, 'clinics', total)
                            order by total desc, city), '[]'::jsonb)
  from (
    select c.city, count(*) as total
    from public.clinics c
    where public.clinic_is_publicly_visible(c.id) and c.city is not null
      and c.slug is not null
    group by c.city
  ) ciudades;
$$;

-- Enmienda de Fase 8 a get_available_slots (la migración original es
-- inmutable): mismo cuerpo y misma verdad de agenda, con UNA extensión — el
-- GUC transaccional app.portal_public_slots, que SOLO fijan las funciones
-- públicas de esta migración tras verificar que la clínica es pública y
-- acepta reservación en línea. Para el personal nada cambia.
create or replace function public.get_available_slots(
  p_clinic_id uuid,
  p_veterinarian_clinic_member_id uuid,
  p_clinic_service_id uuid,
  p_from_date date,
  p_to_date date
)
returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_duration int;
  v_buffer_before int;
  v_buffer_after int;
  v_day date;
  v_window record;
  v_slot timestamptz;
  v_slot_end timestamptz;
  v_occupies_from timestamptz;
  v_occupies_until timestamptz;
  v_window_start timestamptz;
  v_window_end timestamptz;
begin
  if not public.is_clinic_member(p_clinic_id)
     and coalesce(current_setting('app.portal_public_slots', true), '') = '' then
    raise exception 'PERMISO_DENEGADO: no eres miembro de la clínica' using errcode = '42501';
  end if;

  if p_to_date < p_from_date or p_to_date - p_from_date > 31 then
    raise exception 'RANGO_EXCESIVO: consulta entre 1 y 31 días' using errcode = '22023';
  end if;

  select c.timezone into v_tz from public.clinics c where c.id = p_clinic_id;
  if v_tz is null then
    raise exception 'CLINICA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;

  select s.duration_minutes, s.buffer_before_minutes, s.buffer_after_minutes
  into v_duration, v_buffer_before, v_buffer_after
  from public.clinic_services s
  where s.id = p_clinic_service_id and s.clinic_id = p_clinic_id and s.active;
  if not found then
    raise exception 'SERVICIO_INVALIDO: el servicio no existe o no está activo en la clínica'
      using errcode = 'P0002';
  end if;

  v_day := p_from_date;
  while v_day <= p_to_date loop
    for v_window in
      -- Ventanas del horario semanal vigente para ese día…
      select ((v_day::timestamp + s.start_time) at time zone v_tz) as w_start,
             ((v_day::timestamp + s.end_time) at time zone v_tz) as w_end
      from public.veterinarian_schedules s
      where s.clinic_member_id = p_veterinarian_clinic_member_id
        and s.clinic_id = p_clinic_id
        and s.active
        and s.weekday = extract(isodow from v_day)::smallint
        and s.effective_from <= v_day
        and (s.effective_until is null or s.effective_until >= v_day)
      union all
      -- …más horarios especiales (special_hours agrega disponibilidad).
      select greatest(e.starts_at, (v_day::timestamp at time zone v_tz)),
             least(e.ends_at, ((v_day + 1)::timestamp at time zone v_tz))
      from public.schedule_exceptions e
      where e.clinic_member_id = p_veterinarian_clinic_member_id
        and e.clinic_id = p_clinic_id
        and e.type = 'special_hours'
        and e.starts_at < ((v_day + 1)::timestamp at time zone v_tz)
        and e.ends_at > (v_day::timestamp at time zone v_tz)
    loop
      v_window_start := v_window.w_start;
      v_window_end := v_window.w_end;
      v_slot := v_window_start;

      while v_slot + make_interval(mins => v_duration) <= v_window_end loop
        v_slot_end := v_slot + make_interval(mins => v_duration);
        v_occupies_from := v_slot - make_interval(mins => v_buffer_before);
        v_occupies_until := v_slot_end + make_interval(mins => v_buffer_after);

        if v_slot > now()
          -- Sin excepciones bloqueantes que crucen la ventana ocupada.
          and not exists (
            select 1 from public.schedule_exceptions e
            where e.clinic_id = p_clinic_id
              and e.type <> 'special_hours'
              and (e.clinic_member_id is null
                   or e.clinic_member_id = p_veterinarian_clinic_member_id)
              and tstzrange(e.starts_at, e.ends_at, '[)')
                  && tstzrange(v_occupies_from, v_occupies_until, '[)')
          )
          -- Sin citas que ocupen agenda en ese rango (misma regla que EXCLUDE).
          and not exists (
            select 1 from public.appointments a
            where a.veterinarian_clinic_member_id = p_veterinarian_clinic_member_id
              and a.status in ('pending_confirmation', 'confirmed', 'checked_in', 'in_progress')
              and tstzrange(a.occupies_from, a.occupies_until, '[)')
                  && tstzrange(v_occupies_from, v_occupies_until, '[)')
          )
        then
          slot_start := v_slot;
          slot_end := v_slot_end;
          return next;
        end if;

        v_slot := v_slot + interval '15 minutes';
      end loop;
    end loop;
    v_day := v_day + 1;
  end loop;

  return;
end;
$$;

-- Huecos reales para el widget público: SOLO clínicas con reservación en
-- línea habilitada; delega en get_available_slots (misma verdad de agenda).
create or replace function public.get_public_available_slots(
  p_clinic_slug text,
  p_service_id uuid,
  p_veterinarian_clinic_member_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_clinic uuid;
begin
  select c.id into v_clinic from public.clinics c
  where c.slug = p_clinic_slug and public.clinic_is_publicly_visible(c.id)
    and c.accepts_online_booking;
  if not found then
    raise exception 'RESERVACION_NO_DISPONIBLE: esta clínica no acepta reservación en línea.'
      using errcode = 'P0002';
  end if;
  -- Bypass transaccional SOLO tras validar que la clínica es públicamente
  -- reservable; se limpia al terminar la transacción.
  perform set_config('app.portal_public_slots', '1', true);
  return coalesce((
    select jsonb_agg(jsonb_build_object('slot_start', s.slot_start, 'slot_end', s.slot_end)
                     order by s.slot_start)
    from public.get_available_slots(
      v_clinic, p_veterinarian_clinic_member_id, p_service_id, p_from, p_to) s
  ), '[]'::jsonb);
end;
$$;

-- ----------------------------------------------------------------------------
-- Reservación pública de invitado (sin cuenta, como Doctoralia): crea
-- propietario+mascota mínimos SIN verificar y una cita `requested` con fuente
-- owner_portal que NO ocupa agenda hasta que la clínica la confirme.
-- ----------------------------------------------------------------------------
create or replace function public.request_public_appointment(
  p_clinic_slug text,
  p_service_id uuid,
  p_veterinarian_clinic_member_id uuid,
  p_start timestamptz,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_pet_name text,
  p_pet_species public.pet_species,
  p_reason text default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic public.clinics%rowtype;
  v_first text := nullif(btrim(coalesce(p_first_name, '')), '');
  v_last text := nullif(btrim(coalesce(p_last_name, '')), '');
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_pet_name text := nullif(btrim(coalesce(p_pet_name, '')), '');
  v_existing record;
  v_result jsonb;
  v_service public.clinic_services%rowtype;
  v_owner uuid;
  v_pet uuid;
  v_end timestamptz;
  v_folio text;
  v_appointment uuid;
begin
  select c.* into v_clinic from public.clinics c
  where c.slug = p_clinic_slug and public.clinic_is_publicly_visible(c.id)
    and c.accepts_online_booking;
  if not found then
    raise exception 'RESERVACION_NO_DISPONIBLE: esta clínica no acepta reservación en línea.'
      using errcode = 'P0002';
  end if;

  -- Idempotencia del formulario: doble envío devuelve la misma solicitud.
  if p_request_id is not null then
    select r.appointment_id into v_existing from public.public_booking_requests r
    where r.clinic_id = v_clinic.id and r.request_id = p_request_id;
    if found then
      select jsonb_build_object('folio', a.folio, 'status', a.status) into v_result
      from public.appointments a where a.id = v_existing.appointment_id;
      return v_result;
    end if;
  end if;

  if v_first is null or v_last is null or v_pet_name is null then
    raise exception 'DATOS_REQUERIDOS: nombre, apellidos y mascota son obligatorios.'
      using errcode = '22023';
  end if;
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'CORREO_INVALIDO: captura un correo válido.' using errcode = '22023';
  end if;
  if v_phone is not null and v_phone !~ '^\+[0-9]{7,15}$' then
    raise exception 'TELEFONO_INVALIDO: usa formato internacional (+52…).' using errcode = '22023';
  end if;
  if p_start <= now() then
    raise exception 'FECHA_PASADA: elige un horario futuro.' using errcode = '22023';
  end if;

  -- Anti-abuso básico: máximo 5 solicitudes por correo y clínica en 24 h.
  if (select count(*) from public.public_booking_requests r
      where r.clinic_id = v_clinic.id and r.guest_email = v_email
        and r.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'SOLICITUDES_EXCEDIDAS: intenta de nuevo más tarde o llama a la clínica.'
      using errcode = '54000';
  end if;

  select s.* into v_service from public.clinic_services s
  where s.id = p_service_id and s.clinic_id = v_clinic.id
    and s.active;
  if not found then
    raise exception 'SERVICIO_INVALIDO: el servicio no está disponible.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.clinic_service_veterinarians sv
    join public.clinic_members m on m.id = sv.clinic_member_id
    where sv.clinic_service_id = p_service_id
      and sv.clinic_member_id = p_veterinarian_clinic_member_id
      and m.status = 'active' and m.deleted_at is null
  ) then
    raise exception 'VETERINARIO_INVALIDO: el veterinario no ofrece este servicio.'
      using errcode = 'P0002';
  end if;

  -- El horario solicitado debe ser un hueco REAL vigente.
  perform set_config('app.portal_public_slots', '1', true);
  if not exists (
    select 1 from public.get_available_slots(
      v_clinic.id, p_veterinarian_clinic_member_id, p_service_id,
      (p_start at time zone v_clinic.timezone)::date,
      (p_start at time zone v_clinic.timezone)::date) s
    where s.slot_start = p_start
  ) then
    raise exception 'HORARIO_NO_DISPONIBLE: ese horario ya no está disponible.'
      using errcode = '23P01';
  end if;

  -- Propietario y mascota mínimos, marcados como registro en línea SIN
  -- verificar (la clínica los depura al confirmar; duplicados se advierten
  -- con las herramientas de la Fase 4).
  insert into public.pet_owners (first_name, last_name, email, phone)
  values (v_first, v_last, v_email, v_phone)
  returning id into v_owner;
  insert into public.pets (name, species) values (v_pet_name, p_pet_species)
  returning id into v_pet;
  insert into public.pet_owner_relationships (pet_id, owner_id, is_primary, status)
  values (v_pet, v_owner, true, 'active');
  insert into public.clinic_pet_relationships
    (organization_id, clinic_id, pet_id, status, source)
  values (v_clinic.organization_id, v_clinic.id, v_pet, 'active', 'owner_registration');

  v_end := p_start + make_interval(mins => v_service.duration_minutes);
  v_folio := public.next_appointment_folio(
    v_clinic.id, extract(year from (now() at time zone v_clinic.timezone))::smallint);

  -- `requested` NO ocupa agenda (EXCLUDE de Fase 5): la clínica decide.
  insert into public.appointments
    (organization_id, clinic_id, pet_id, owner_id, veterinarian_clinic_member_id,
     status, source, folio, scheduled_start, scheduled_end,
     occupies_from, occupies_until, reason)
  values
    (v_clinic.organization_id, v_clinic.id, v_pet, v_owner,
     p_veterinarian_clinic_member_id, 'requested', 'owner_portal', v_folio,
     p_start, v_end,
     p_start - make_interval(mins => v_service.buffer_before_minutes),
     v_end + make_interval(mins => v_service.buffer_after_minutes),
     nullif(btrim(coalesce(p_reason, '')), ''))
  returning id into v_appointment;

  insert into public.appointment_services
    (appointment_id, clinic_service_id, service_name, category, duration_minutes, price_cents)
  values (v_appointment, v_service.id, v_service.name, v_service.category,
          v_service.duration_minutes, v_service.price_cents);

  insert into public.public_booking_requests
    (organization_id, clinic_id, appointment_id, owner_id, pet_id, guest_email, request_id)
  values (v_clinic.organization_id, v_clinic.id, v_appointment, v_owner, v_pet,
          v_email, p_request_id);

  insert into public.audit_log
    (organization_id, clinic_id, actor_user_id, action, entity_type, entity_id, new_data)
  values (v_clinic.organization_id, v_clinic.id, (select auth.uid()),
          'public_booking_request', 'appointments', v_appointment,
          jsonb_build_object('folio', v_folio, 'source', 'owner_portal'));

  return jsonb_build_object('folio', v_folio, 'status', 'requested');
end;
$$;

-- ----------------------------------------------------------------------------
-- Portal del propietario: invitación explícita + lecturas curadas
-- ----------------------------------------------------------------------------
create or replace function public.create_portal_invitation(
  p_clinic_id uuid,
  p_owner_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_owner public.pet_owners%rowtype;
  v_org uuid;
  v_token text;
begin
  if not public.is_clinic_operational_staff(p_clinic_id) then
    raise exception 'PERMISO_DENEGADO: tu rol no invita propietarios al portal.'
      using errcode = '42501';
  end if;
  select o.* into v_owner from public.pet_owners o
  where o.id = p_owner_id and o.deleted_at is null;
  if not found then
    raise exception 'PROPIETARIO_NO_ENCONTRADO' using errcode = 'P0002';
  end if;
  if v_owner.email is null then
    raise exception 'CORREO_REQUERIDO: el propietario necesita correo para el portal.'
      using errcode = '22023';
  end if;
  if v_owner.user_id is not null then
    raise exception 'YA_VINCULADO: este propietario ya tiene cuenta del portal.'
      using errcode = '23505';
  end if;
  -- El propietario debe tener relación vigente con la clínica que invita.
  if not exists (
    select 1 from public.owner_clinic_relationships ocr
    where ocr.owner_id = p_owner_id and ocr.clinic_id = p_clinic_id
      and ocr.deleted_at is null
  ) and not exists (
    select 1
    from public.pet_owner_relationships por
    join public.clinic_pet_relationships cpr on cpr.pet_id = por.pet_id
    where por.owner_id = p_owner_id and cpr.clinic_id = p_clinic_id
      and por.status = 'active' and por.deleted_at is null
      and cpr.status = 'active' and cpr.deleted_at is null
  ) then
    raise exception 'PROPIETARIO_SIN_RELACION: el propietario no pertenece a esta clínica.'
      using errcode = '23514';
  end if;

  select c.organization_id into v_org from public.clinics c where c.id = p_clinic_id;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  update public.portal_invitations set status = 'revoked'
  where owner_id = p_owner_id and status = 'pending';

  insert into public.portal_invitations
    (organization_id, clinic_id, owner_id, email, token_hash, expires_at, invited_by)
  values (v_org, p_clinic_id, p_owner_id, v_owner.email,
          encode(extensions.digest(v_token, 'sha256'), 'hex'),
          now() + interval '7 days', v_user);

  return v_token; -- se muestra/envía UNA sola vez; solo el hash persiste
end;
$$;

create or replace function public.accept_portal_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_inv public.portal_invitations%rowtype;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión.' using errcode = '42501';
  end if;
  select i.* into v_inv from public.portal_invitations i
  where i.token_hash = encode(extensions.digest(btrim(coalesce(p_token, '')), 'sha256'), 'hex')
    and i.status = 'pending'
  for update;
  if not found or v_inv.expires_at < now() then
    raise exception 'INVITACION_INVALIDA: el enlace no es válido o expiró.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.pet_owners o
             where o.id = v_inv.owner_id and o.user_id is not null) then
    raise exception 'YA_VINCULADO: este propietario ya tiene cuenta.' using errcode = '23505';
  end if;

  update public.pet_owners set user_id = v_user where id = v_inv.owner_id;
  update public.pet_owner_relationships set can_access_portal = true
  where owner_id = v_inv.owner_id and status = 'active' and deleted_at is null;
  update public.portal_invitations
  set status = 'accepted', accepted_at = now(), accepted_by = v_user
  where id = v_inv.id;

  insert into public.audit_log
    (organization_id, clinic_id, actor_user_id, action, entity_type, entity_id, new_data)
  values (v_inv.organization_id, v_inv.clinic_id, v_user, 'portal_link',
          'pet_owners', v_inv.owner_id, jsonb_build_object('portal', true));

  return v_inv.owner_id;
end;
$$;

-- Lecturas del portal: SIEMPRE curadas (sin notas internas, sin SOAP, sin
-- datos de otras organizaciones más allá de lo que ya es del propietario).
create or replace function public.get_my_pets()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'pet_id', p.id, 'name', p.name, 'species', p.species, 'breed', p.breed,
    'sex', p.sex, 'birth_date', p.birth_date) order by p.name), '[]'::jsonb)
  from public.pet_owner_relationships por
  join public.pet_owners o on o.id = por.owner_id
  join public.pets p on p.id = por.pet_id
  where o.user_id = (select auth.uid()) and o.deleted_at is null
    and por.status = 'active' and por.deleted_at is null and por.can_access_portal
    and p.deleted_at is null;
$$;

create or replace function public.get_my_appointments()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'appointment_id', a.id, 'folio', a.folio, 'status', a.status,
    'scheduled_start', a.scheduled_start, 'scheduled_end', a.scheduled_end,
    'reason', a.reason, 'pet_name', p.name, 'clinic_name', c.name,
    'clinic_timezone', c.timezone,
    'veterinarian', coalesce(pr.display_name,
      nullif(btrim(concat(pr.first_name, ' ', pr.last_name)), ''))
  ) order by a.scheduled_start desc), '[]'::jsonb)
  from public.appointments a
  join public.pet_owners o on o.id = a.owner_id
  join public.pets p on p.id = a.pet_id
  join public.clinics c on c.id = a.clinic_id
  join public.clinic_members m on m.id = a.veterinarian_clinic_member_id
  join public.profiles pr on pr.id = m.user_id
  where o.user_id = (select auth.uid()) and o.deleted_at is null
  limit 100;
$$;

create or replace function public.get_my_pet_history(p_pet_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.pet_owner_relationships por
    join public.pet_owners o on o.id = por.owner_id
    where por.pet_id = p_pet_id and o.user_id = (select auth.uid())
      and por.status = 'active' and por.deleted_at is null and por.can_access_portal
  ) then
    raise exception 'PERMISO_DENEGADO: esta mascota no está vinculada a tu cuenta.'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'encounters', coalesce((
      select jsonb_agg(jsonb_build_object(
        'folio', e.folio, 'started_at', e.started_at, 'finalized_at', e.finalized_at,
        'chief_complaint', e.chief_complaint, 'clinic_name', c.name)
        order by e.started_at desc)
      from public.clinical_encounters e
      join public.clinics c on c.id = e.clinic_id
      where e.pet_id = p_pet_id and e.status = 'finalized' and e.deleted_at is null
    ), '[]'::jsonb),
    'prescriptions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'folio', rx.folio, 'status', rx.status, 'issued_at', rx.issued_at,
        'clinic_name', c.name,
        'items', (select jsonb_agg(jsonb_build_object(
            'medication_name', i.medication_name, 'dosage_text', i.dosage_text,
            'frequency_text', i.frequency_text, 'duration_text', i.duration_text)
            order by i.position, i.created_at)
          from public.prescription_items i where i.prescription_id = rx.id))
        order by rx.issued_at desc)
      from public.prescriptions rx
      join public.clinics c on c.id = rx.clinic_id
      where rx.pet_id = p_pet_id and rx.status <> 'draft' and rx.deleted_at is null
    ), '[]'::jsonb),
    'vaccinations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'vaccine_name', v.vaccine_name_snapshot, 'administered_at', v.administered_at,
        'next_due_at', v.next_due_at, 'source', v.source, 'status', v.status,
        'clinic_name', c.name) order by v.administered_at desc)
      from public.vaccination_records v
      join public.clinics c on c.id = v.clinic_id
      where v.pet_id = p_pet_id and v.deleted_at is null
    ), '[]'::jsonb));
end;
$$;

-- El propietario cancela SU cita futura (hasta 2 h antes); la clínica recibe
-- el aviso por el flujo normal de notificaciones.
create or replace function public.cancel_my_appointment(
  p_appointment_id uuid,
  p_reason text default null
)
returns public.appointment_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_appt public.appointments%rowtype;
begin
  select a.* into v_appt from public.appointments a
  join public.pet_owners o on o.id = a.owner_id
  where a.id = p_appointment_id and o.user_id = v_user
  for update of a;
  if not found then
    raise exception 'CITA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_appt.status = 'cancelled' then
    return 'cancelled';
  end if;
  if v_appt.status not in ('requested', 'pending_confirmation', 'confirmed') then
    raise exception 'ESTADO_INVALIDO: esta cita ya no puede cancelarse en línea.'
      using errcode = '23514';
  end if;
  if v_appt.scheduled_start < now() + interval '2 hours' then
    raise exception 'PLAZO_EXCEDIDO: para cancelar con menos de 2 horas llama a la clínica.'
      using errcode = '22023';
  end if;

  perform set_config('app.appointment_reason',
    coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Cancelada por el propietario'), true);
  update public.appointments
  set status = 'cancelled', cancelled_at = now(),
      cancellation_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''),
                                     'Cancelada por el propietario')
  where id = p_appointment_id;
  perform set_config('app.appointment_reason', '', true);

  perform public.cancel_pending_appointment_notifications(p_appointment_id);
  perform public.enqueue_appointment_notifications(p_appointment_id, 'cancellation');

  return 'cancelled';
end;
$$;

-- ----------------------------------------------------------------------------
-- Permisos de ejecución
-- ----------------------------------------------------------------------------
do $$
declare
  f text;
begin
  -- Superficie PÚBLICA (anon incluida).
  foreach f in array array[
    'clinic_is_publicly_visible(uuid)',
    'search_public_clinics(text, text, public.service_category, integer, integer)',
    'get_public_clinic(text)',
    'get_public_veterinarian(text)',
    'list_public_cities()',
    'get_public_available_slots(text, uuid, uuid, date, date)',
    'request_public_appointment(text, uuid, uuid, timestamptz, text, text, text, text, text, public.pet_species, text, uuid)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
  -- Superficie del portal y del panel (requiere sesión).
  foreach f in array array[
    'create_portal_invitation(uuid, uuid)',
    'accept_portal_invitation(text)',
    'get_my_pets()',
    'get_my_appointments()',
    'get_my_pet_history(uuid)',
    'cancel_my_appointment(uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;
