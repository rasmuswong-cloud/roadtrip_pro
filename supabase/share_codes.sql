create table if not exists public.trip_invites (
  code text primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid not null references public.user_profiles(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  used_at timestamptz
);

alter table public.trip_invites enable row level security;

drop policy if exists "owners manage trip invites" on public.trip_invites;

create policy "owners manage trip invites" on public.trip_invites
for all using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

create or replace function public.create_trip_invite(input_trip_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_code text;
begin
  if not public.is_trip_owner(input_trip_id) then
    raise exception 'Only trip owners can create invite codes.';
  end if;

  invite_code := upper(substr(replace(md5(random()::text || clock_timestamp()::text), '-', ''), 1, 8));

  insert into public.trip_invites (code, trip_id, created_by)
  values (invite_code, input_trip_id, auth.uid());

  return invite_code;
end;
$$;

create or replace function public.join_trip_by_code(input_code text)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.trip_invites;
  joined_trip public.trips;
begin
  select *
  into invite
  from public.trip_invites
  where code = upper(trim(input_code))
    and expires_at > now()
  limit 1;

  if invite.code is null then
    raise exception 'Invite code is invalid or expired.';
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (invite.trip_id, auth.uid(), 'editor')
  on conflict (trip_id, user_id)
  do update set role = excluded.role;

  update public.trip_invites
  set used_at = now()
  where code = invite.code;

  select *
  into joined_trip
  from public.trips
  where id = invite.trip_id;

  return joined_trip;
end;
$$;
