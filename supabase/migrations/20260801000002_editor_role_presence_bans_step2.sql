-- =====================================================================
-- STEP 2 of 2 — editor role permissions, online presence, and user bans.
-- Run this only after step 1 has finished successfully.
--
-- Everything here is idempotent: re-running it is safe.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. New profile columns
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists banned        boolean not null default false,
  add column if not exists banned_at     timestamptz,
  add column if not exists banned_reason text,
  add column if not exists last_seen_at  timestamptz;

create index if not exists profiles_last_seen_at_idx
  on public.profiles (last_seen_at desc nulls last);


-- ---------------------------------------------------------------------
-- 2. Role helpers
--    security definer so they can read user_roles no matter what RLS the
--    caller is subject to. Prefixed bs_ so they can't collide with
--    anything the project already defines.
-- ---------------------------------------------------------------------
create or replace function public.bs_is_admin(_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r where r.user_id = _uid and r.role = 'admin'
  );
$$;

create or replace function public.bs_is_editor(_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r where r.user_id = _uid and r.role = 'editor'
  );
$$;

create or replace function public.bs_is_staff(_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = _uid and r.role in ('admin', 'editor')
  );
$$;

create or replace function public.bs_is_banned(_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.banned from public.profiles p where p.id = _uid), false);
$$;

grant execute on function public.bs_is_admin(uuid)  to authenticated;
grant execute on function public.bs_is_editor(uuid) to authenticated;
grant execute on function public.bs_is_staff(uuid)  to authenticated;
grant execute on function public.bs_is_banned(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 3. Presence heartbeat
--    The app calls this about once a minute while a tab is visible; the
--    admin list treats anyone seen in the last 3 minutes as online.
-- ---------------------------------------------------------------------
create or replace function public.touch_presence()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

grant execute on function public.touch_presence() to authenticated;


-- ---------------------------------------------------------------------
-- 4. Admin-only mutations
--    These are the server-side half of "editors can't promote or delete
--    admins" and "only admins can ban". Hiding the buttons is not enough.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.bs_is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;
  if p_role not in ('student', 'editor', 'admin') then
    raise exception 'Unknown role: %', p_role;
  end if;

  delete from public.user_roles
   where user_id = p_user_id and role in ('admin', 'editor');

  if p_role <> 'student' then
    insert into public.user_roles (user_id, role)
    values (p_user_id, p_role::public.app_role)
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.admin_set_banned(
  p_user_id uuid,
  p_banned  boolean,
  p_reason  text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.bs_is_admin() then
    raise exception 'Only admins can ban or unban users';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot ban yourself';
  end if;

  update public.profiles
     set banned        = p_banned,
         banned_at     = case when p_banned then now() else null end,
         banned_reason = case when p_banned then p_reason else null end
   where id = p_user_id;
end;
$$;

grant execute on function public.admin_set_role(uuid, text)            to authenticated;
grant execute on function public.admin_set_banned(uuid, boolean, text) to authenticated;


-- ---------------------------------------------------------------------
-- 5. Editors need write access to their four sections
--    Existing policies grant admins everything; these add editors on top
--    for content only. Named distinctly so they never clash with yours.
-- ---------------------------------------------------------------------
drop policy if exists "editors manage questions" on public.questions;
create policy "editors manage questions" on public.questions
  for all to authenticated
  using (public.bs_is_editor()) with check (public.bs_is_editor());

drop policy if exists "editors manage daily tests" on public.daily_tests;
create policy "editors manage daily tests" on public.daily_tests
  for all to authenticated
  using (public.bs_is_editor()) with check (public.bs_is_editor());

drop policy if exists "editors manage mock exams" on public.mock_exams;
create policy "editors manage mock exams" on public.mock_exams
  for all to authenticated
  using (public.bs_is_editor()) with check (public.bs_is_editor());

drop policy if exists "editors manage mock exam sections" on public.mock_exam_sections;
create policy "editors manage mock exam sections" on public.mock_exam_sections
  for all to authenticated
  using (public.bs_is_editor()) with check (public.bs_is_editor());

drop policy if exists "editors manage mock exam questions" on public.mock_exam_questions;
create policy "editors manage mock exam questions" on public.mock_exam_questions
  for all to authenticated
  using (public.bs_is_editor()) with check (public.bs_is_editor());

drop policy if exists "editors manage news" on public.news_articles;
create policy "editors manage news" on public.news_articles
  for all to authenticated
  using (public.bs_is_editor()) with check (public.bs_is_editor());

-- The mock-exam editor picks from the pool of tests, so editors need to
-- read tests — but not create or change them (Tests stays admin-only).
drop policy if exists "editors read tests" on public.tests;
create policy "editors read tests" on public.tests
  for select to authenticated using (public.bs_is_editor());

drop policy if exists "editors read test questions" on public.test_questions;
create policy "editors read test questions" on public.test_questions
  for select to authenticated using (public.bs_is_editor());


-- ---------------------------------------------------------------------
-- 6. A banned user is locked out at the data layer, not just the UI.
--    `as restrictive` ANDs with your existing policies instead of
--    replacing them, so nothing else has to be touched.
-- ---------------------------------------------------------------------
drop policy if exists "banned users blocked" on public.test_sessions;
create policy "banned users blocked" on public.test_sessions
  as restrictive for all to authenticated
  using (not public.bs_is_banned()) with check (not public.bs_is_banned());

drop policy if exists "banned users blocked" on public.attempts;
create policy "banned users blocked" on public.attempts
  as restrictive for all to authenticated
  using (not public.bs_is_banned()) with check (not public.bs_is_banned());


-- ---------------------------------------------------------------------
-- 7. Optional: grant the first editor by email.
--    Uncomment, set the address, run.
-- ---------------------------------------------------------------------
-- insert into public.user_roles (user_id, role)
-- select p.id, 'editor'::public.app_role
--   from public.profiles p
--  where p.email = 'someone@example.com'
-- on conflict do nothing;
