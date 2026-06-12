create or replace function public.move_itinerary_node(
  input_node_id uuid,
  input_direction integer
)
returns setof public.itinerary_nodes
language plpgsql
security invoker
set search_path = public
as $$
declare
  moving_node public.itinerary_nodes%rowtype;
  target_node public.itinerary_nodes%rowtype;
  ordered_node_ids uuid[];
  moving_index integer;
  target_index integer;
  moving_day date;
  updated_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  if input_direction not in (-1, 1) then
    raise exception 'Direction must be -1 or 1.' using errcode = '22023';
  end if;

  select *
  into moving_node
  from public.itinerary_nodes
  where id = input_node_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Itinerary node does not exist.' using errcode = 'P0002';
  end if;

  if not public.is_trip_editor(moving_node.trip_id) then
    raise exception 'You do not have permission to move this itinerary node.' using errcode = '42501';
  end if;

  moving_day := moving_node.starts_at::date;

  perform 1
  from public.itinerary_nodes
  where trip_id = moving_node.trip_id
    and deleted_at is null
    and starts_at::date is not distinct from moving_day
  for update;

  select array_agg(id order by sort_order asc, starts_at asc nulls last, id asc)
  into ordered_node_ids
  from public.itinerary_nodes
  where trip_id = moving_node.trip_id
    and deleted_at is null
    and starts_at::date is not distinct from moving_day;

  moving_index := array_position(ordered_node_ids, input_node_id);
  target_index := moving_index + input_direction;

  if moving_index is null then
    raise exception 'Itinerary node does not exist.' using errcode = 'P0002';
  end if;

  if target_index < 1 or target_index > coalesce(array_length(ordered_node_ids, 1), 0) then
    return query
      select *
      from public.itinerary_nodes
      where trip_id = moving_node.trip_id
        and deleted_at is null
        and starts_at::date is not distinct from moving_day
      order by sort_order asc, starts_at asc nulls last, id asc;
    return;
  end if;

  select *
  into target_node
  from public.itinerary_nodes
  where id = ordered_node_ids[target_index]
    and trip_id = moving_node.trip_id
    and deleted_at is null
    and starts_at::date is not distinct from moving_day
  for update;

  if not found then
    raise exception 'Move destination does not exist.' using errcode = 'P0002';
  end if;

  update public.itinerary_nodes
  set
    sort_order = case
      when id = moving_node.id then target_node.sort_order
      when id = target_node.id then moving_node.sort_order
      else sort_order
    end,
    updated_by = auth.uid()
  where id in (moving_node.id, target_node.id)
    and trip_id = moving_node.trip_id
    and deleted_at is null
    and starts_at::date is not distinct from moving_day;

  get diagnostics updated_count = row_count;

  if updated_count <> 2 then
    raise exception 'Itinerary node could not be moved.' using errcode = 'P0002';
  end if;

  with normalized as (
    select
      id,
      row_number() over (order by sort_order asc, starts_at asc nulls last, id asc) * 100 as next_sort_order
    from public.itinerary_nodes
    where trip_id = moving_node.trip_id
      and deleted_at is null
      and starts_at::date is not distinct from moving_day
  )
  update public.itinerary_nodes target
  set
    sort_order = normalized.next_sort_order,
    updated_by = auth.uid()
  from normalized
  where target.id = normalized.id
    and target.sort_order is distinct from normalized.next_sort_order;

  return query
    select *
    from public.itinerary_nodes
    where trip_id = moving_node.trip_id
      and deleted_at is null
      and starts_at::date is not distinct from moving_day
    order by sort_order asc, starts_at asc nulls last, id asc;
end;
$$;

revoke all on function public.move_itinerary_node(uuid, integer) from public;
revoke all on function public.move_itinerary_node(uuid, integer) from anon;
grant execute on function public.move_itinerary_node(uuid, integer) to authenticated;
