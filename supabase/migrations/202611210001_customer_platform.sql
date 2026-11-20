begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.catalog_snapshots (
  id uuid primary key default gen_random_uuid(),
  city_slug text not null check (city_slug = 'hyderabad'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 20000000),
  source_name text not null check (length(source_name) between 3 and 200),
  published boolean not null default false,
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index catalog_one_published_city on public.catalog_snapshots(city_slug) where published;
alter table public.catalog_snapshots enable row level security;
revoke all on public.catalog_snapshots from anon, authenticated;
grant select(id, city_slug, payload, source_name, published, created_at) on public.catalog_snapshots to anon, authenticated;
create policy published_catalog_read on public.catalog_snapshots for select to anon, authenticated using (published);

create table public.customer_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{"savedIds":[],"compareIds":[],"recentIds":[],"savedSearches":[]}'::jsonb
    check (jsonb_typeof(state) = 'object' and octet_length(state::text) <= 131072),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);
alter table public.customer_states enable row level security;
revoke all on public.customer_states from anon, authenticated;
grant select, insert, update on public.customer_states to authenticated;
create policy customer_state_select on public.customer_states for select to authenticated using ((select auth.uid()) = user_id);
create policy customer_state_insert on public.customer_states for insert to authenticated with check ((select auth.uid()) = user_id);
create policy customer_state_update on public.customer_states for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.save_customer_state(expected_version integer, next_state jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved public.customer_states;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  if expected_version = 0 then
    insert into public.customer_states(user_id, state) values(auth.uid(), next_state)
    on conflict (user_id) do nothing returning * into saved;
  else
    update public.customer_states set state = next_state, version = version + 1, updated_at = now()
    where user_id = auth.uid() and version = expected_version returning * into saved;
  end if;
  if saved.user_id is null then return null; end if;
  return jsonb_build_object('state', saved.state, 'version', saved.version);
end; $$;
revoke all on function public.save_customer_state(integer, jsonb) from public, anon;
grant execute on function public.save_customer_state(integer, jsonb) to authenticated;

create table public.viewing_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key uuid not null,
  payload_hash text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 16384),
  subject jsonb,
  status text not null default 'pending' check (status in ('pending','confirmed','completed','cancelled')),
  created_at timestamptz not null default now(),
  unique(user_id, request_key)
);
create index viewing_requests_owner on public.viewing_requests(user_id, created_at desc);
alter table public.viewing_requests enable row level security;
revoke all on public.viewing_requests from anon, authenticated;
grant select on public.viewing_requests to authenticated;
create policy viewing_owner_read on public.viewing_requests for select to authenticated using ((select auth.uid()) = user_id);

create table public.listing_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key uuid not null,
  payload_hash text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 32768),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  unique(user_id, request_key)
);
create index listing_submissions_owner on public.listing_submissions(user_id, created_at desc);
alter table public.listing_submissions enable row level security;
revoke all on public.listing_submissions from anon, authenticated;
grant select on public.listing_submissions to authenticated;
create policy listing_owner_read on public.listing_submissions for select to authenticated using ((select auth.uid()) = user_id);

create table private.request_budgets (
  bucket text not null,
  window_start bigint not null,
  requests integer not null,
  primary key(bucket, window_start)
);
create index request_budget_expiry on private.request_budgets(window_start);
alter table private.request_budgets enable row level security;

create function public.consume_request_budget(bucket_key text, request_limit integer, window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare period bigint; used integer;
begin
  if length(bucket_key) <> 64 or request_limit not between 1 and 1000 or window_seconds <> 60 then raise invalid_parameter_value; end if;
  period := floor(extract(epoch from now()) / window_seconds)::bigint;
  insert into private.request_budgets(bucket, window_start, requests) values(bucket_key, period, 1)
  on conflict(bucket, window_start) do update set requests = least(private.request_budgets.requests + 1, request_limit + 1)
  returning requests into used;
  delete from private.request_budgets where (bucket, window_start) in
    (select bucket, window_start from private.request_budgets where window_start < period - 60 limit 100);
  return used <= request_limit;
end; $$;
revoke all on function public.consume_request_budget(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_request_budget(text, integer, integer) to service_role;

-- Publishing is an operator action. Never grant this to customer JWTs.
create function public.publish_catalog(snapshot_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare city text;
begin
  perform pg_advisory_xact_lock(hashtext('propit-catalog-publish'));
  select city_slug into strict city from public.catalog_snapshots where id = snapshot_id;
  update public.catalog_snapshots set published = false where city_slug = city and published;
  update public.catalog_snapshots set published = true where id = snapshot_id;
end; $$;
revoke all on function public.publish_catalog(uuid) from public, anon, authenticated;
grant execute on function public.publish_catalog(uuid) to service_role;

grant all on public.catalog_snapshots, public.customer_states, public.viewing_requests, public.listing_submissions to service_role;

commit;
