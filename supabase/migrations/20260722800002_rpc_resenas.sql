-- ============================================================================
-- Fase 8.1 — Reseñas: RPCs de propietario, moderación de clínica y lectura
-- pública curada (con re-emisión de las RPCs de descubrimiento + calificación)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Propietario: enviar y editar su reseña
-- ----------------------------------------------------------------------------
create or replace function public.submit_review(
  p_appointment_id uuid,
  p_rating smallint,
  p_body text,
  p_title text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_appt public.appointments%rowtype;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_id uuid;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión.' using errcode = '42501';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'CALIFICACION_INVALIDA: usa de 1 a 5 estrellas.' using errcode = '22023';
  end if;
  if v_body is null or char_length(v_body) < 3 then
    raise exception 'RESENA_VACIA: escribe tu opinión.' using errcode = '22023';
  end if;

  select a.* into v_appt from public.appointments a
  join public.pet_owners o on o.id = a.owner_id
  where a.id = p_appointment_id and o.user_id = v_user;
  if not found then
    raise exception 'CITA_NO_ENCONTRADA: no es una cita tuya.' using errcode = 'P0002';
  end if;
  if v_appt.status <> 'completed' then
    raise exception 'CITA_NO_COMPLETADA: solo puedes reseñar una cita ya atendida.'
      using errcode = '23514';
  end if;

  begin
    insert into public.reviews
      (organization_id, clinic_id, appointment_id, pet_id, owner_id,
       veterinarian_clinic_member_id, author_user_id, rating, title, body)
    values
      (v_appt.organization_id, v_appt.clinic_id, p_appointment_id, v_appt.pet_id,
       v_appt.owner_id, v_appt.veterinarian_clinic_member_id, v_user, p_rating,
       nullif(btrim(coalesce(p_title, '')), ''), v_body)
    returning id into v_id;
  exception
    when unique_violation then
      raise exception 'RESENA_DUPLICADA: ya reseñaste esta cita; edítala si quieres cambiarla.'
        using errcode = '23505';
  end;

  return v_id;
end;
$$;

-- Editar la propia reseña dentro de una ventana (30 días desde su creación).
create or replace function public.update_my_review(
  p_review_id uuid,
  p_rating smallint,
  p_body text,
  p_title text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_review public.reviews%rowtype;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
begin
  select * into v_review from public.reviews r
  where r.id = p_review_id and r.author_user_id = v_user for update;
  if not found or v_review.deleted_at is not null then
    raise exception 'RESENA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_review.created_at < now() - interval '30 days' then
    raise exception 'PLAZO_EXCEDIDO: las reseñas solo se editan dentro de 30 días.'
      using errcode = '22023';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'CALIFICACION_INVALIDA: usa de 1 a 5 estrellas.' using errcode = '22023';
  end if;
  if v_body is null or char_length(v_body) < 3 then
    raise exception 'RESENA_VACIA: escribe tu opinión.' using errcode = '22023';
  end if;

  update public.reviews
  set rating = p_rating, body = v_body, title = nullif(btrim(coalesce(p_title, '')), '')
  where id = p_review_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Clínica: responder públicamente y reportar
-- ----------------------------------------------------------------------------
create or replace function public.reply_to_review(
  p_review_id uuid,
  p_reply text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_review public.reviews%rowtype;
  v_reply text := nullif(btrim(coalesce(p_reply, '')), '');
begin
  select * into v_review from public.reviews r where r.id = p_review_id for update;
  if not found or v_review.deleted_at is not null then
    raise exception 'RESENA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if not public.is_clinic_operational_staff(v_review.clinic_id) then
    raise exception 'PERMISO_DENEGADO: tu rol no responde reseñas en esta clínica.'
      using errcode = '42501';
  end if;
  if v_reply is null then
    raise exception 'RESPUESTA_VACIA: escribe la respuesta.' using errcode = '22023';
  end if;

  update public.reviews
  set clinic_reply = v_reply, clinic_reply_at = now(), clinic_reply_by = v_user
  where id = p_review_id;

  insert into public.review_moderation_events
    (review_id, organization_id, clinic_id, action, actor_user_id)
  values (p_review_id, v_review.organization_id, v_review.clinic_id, 'replied', v_user);
end;
$$;

-- Reportar: la clínica marca una reseña (no la oculta; deja rastro). Ocultar
-- es acto elevado (abajo).
create or replace function public.report_review(
  p_review_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_review public.reviews%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null then
    raise exception 'MOTIVO_REQUERIDO: indica por qué reportas la reseña.' using errcode = '22023';
  end if;
  select * into v_review from public.reviews r where r.id = p_review_id for update;
  if not found or v_review.deleted_at is not null then
    raise exception 'RESENA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if not public.is_clinic_operational_staff(v_review.clinic_id) then
    raise exception 'PERMISO_DENEGADO: tu rol no reporta reseñas en esta clínica.'
      using errcode = '42501';
  end if;

  update public.reviews
  set reported_at = now(), reported_by = v_user, report_reason = v_reason
  where id = p_review_id;

  insert into public.review_moderation_events
    (review_id, organization_id, clinic_id, action, reason, actor_user_id)
  values (p_review_id, v_review.organization_id, v_review.clinic_id, 'reported', v_reason, v_user);
end;
$$;

-- Ocultar/restaurar: SOLO administración de la organización (moderación
-- elevada), con motivo y auditoría; el contenido NUNCA se borra.
create or replace function public.set_review_visibility(
  p_review_id uuid,
  p_hidden boolean,
  p_reason text
)
returns public.review_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_review public.reviews%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into v_review from public.reviews r where r.id = p_review_id for update;
  if not found or v_review.deleted_at is not null then
    raise exception 'RESENA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if not public.is_organization_admin(v_review.organization_id) then
    raise exception 'PERMISO_DENEGADO: solo administración de la organización modera reseñas.'
      using errcode = '42501';
  end if;
  if v_reason is null then
    raise exception 'MOTIVO_REQUERIDO: la moderación requiere motivo.' using errcode = '22023';
  end if;

  if p_hidden then
    update public.reviews
    set status = 'hidden', hidden_at = now(), hidden_by = v_user, hidden_reason = v_reason
    where id = p_review_id;
    insert into public.review_moderation_events
      (review_id, organization_id, clinic_id, action, reason, actor_user_id)
    values (p_review_id, v_review.organization_id, v_review.clinic_id, 'hidden', v_reason, v_user);
    return 'hidden';
  else
    update public.reviews
    set status = 'published', hidden_at = null, hidden_by = null, hidden_reason = null
    where id = p_review_id;
    insert into public.review_moderation_events
      (review_id, organization_id, clinic_id, action, reason, actor_user_id)
    values (p_review_id, v_review.organization_id, v_review.clinic_id, 'restored', v_reason, v_user);
    return 'published';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Portal del propietario: citas reseñables y mis reseñas
-- ----------------------------------------------------------------------------
create or replace function public.get_my_reviewable_appointments()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'appointment_id', a.id, 'folio', a.folio, 'completed_at', a.completed_at,
    'clinic_name', c.name, 'clinic_slug', c.slug, 'pet_name', p.name,
    'veterinarian', coalesce(pr.display_name,
      nullif(btrim(concat(pr.first_name, ' ', pr.last_name)), '')),
    'review', (select jsonb_build_object('id', rv.id, 'rating', rv.rating,
                 'title', rv.title, 'body', rv.body, 'status', rv.status)
               from public.reviews rv where rv.appointment_id = a.id
                 and rv.deleted_at is null)
  ) order by a.completed_at desc), '[]'::jsonb)
  from public.appointments a
  join public.pet_owners o on o.id = a.owner_id
  join public.clinics c on c.id = a.clinic_id
  join public.pets p on p.id = a.pet_id
  join public.clinic_members m on m.id = a.veterinarian_clinic_member_id
  join public.profiles pr on pr.id = m.user_id
  where o.user_id = (select auth.uid()) and a.status = 'completed'
  limit 100;
$$;

-- ----------------------------------------------------------------------------
-- Lectura PÚBLICA curada de reseñas (anon): solo publicadas de clínicas
-- públicas; nunca datos de moderación ni de otras organizaciones.
-- ----------------------------------------------------------------------------
create or replace function public.get_clinic_reviews(
  p_clinic_slug text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_clinic uuid;
begin
  select c.id into v_clinic from public.clinics c
  where c.slug = p_clinic_slug and public.clinic_is_publicly_visible(c.id);
  if not found then
    return jsonb_build_object('rating', jsonb_build_object('average', null, 'count', 0),
                              'reviews', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'rating', public.clinic_rating(v_clinic),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rating', r.rating, 'title', r.title, 'body', r.body,
        'created_at', r.created_at,
        -- Autor enmascarado (nombre + inicial del apellido) desde el propietario.
        'author', coalesce(
          nullif(btrim(concat(left(po.first_name, 20), ' ',
            left(po.last_name, 1), case when po.last_name is not null then '.' else '' end)), ''),
          'Propietario'),
        'veterinarian', coalesce(vpr.display_name,
          nullif(btrim(concat(vpr.first_name, ' ', vpr.last_name)), '')),
        'clinic_reply', r.clinic_reply, 'clinic_reply_at', r.clinic_reply_at)
        order by r.created_at desc)
      from public.reviews r
      join public.pet_owners po on po.id = r.owner_id
      join public.clinic_members m on m.id = r.veterinarian_clinic_member_id
      join public.profiles vpr on vpr.id = m.user_id
      where r.clinic_id = v_clinic and r.status = 'published' and r.deleted_at is null
      limit least(greatest(coalesce(p_limit, 20), 1), 50)
      offset greatest(coalesce(p_offset, 0), 0)
    ), '[]'::jsonb));
end;
$$;

-- ----------------------------------------------------------------------------
-- Re-emisión de las RPCs de descubrimiento (inmutables las originales) con el
-- promedio de calificación agregado — resto del cuerpo idéntico a Fase 8.
-- ----------------------------------------------------------------------------
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
                           where s.clinic_id = c.id and s.active),
      'rating', public.clinic_rating(c.id)
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
    'rating', public.clinic_rating(c.id),
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

-- ----------------------------------------------------------------------------
-- Permisos de ejecución
-- ----------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'get_clinic_reviews(text, integer, integer)',
    'search_public_clinics(text, text, public.service_category, integer, integer)',
    'get_public_clinic(text)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'submit_review(uuid, smallint, text, text)',
    'update_my_review(uuid, smallint, text, text)',
    'reply_to_review(uuid, text)',
    'report_review(uuid, text)',
    'set_review_visibility(uuid, boolean, text)',
    'get_my_reviewable_appointments()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;
