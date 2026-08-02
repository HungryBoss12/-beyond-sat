-- =====================================================================
-- BeyondSAT — STEP 2, run AFTER you have signed up through the app.
--
-- Everything below is idempotent: running it twice is harmless.
--
-- WHY THIS IS A SEPARATE FILE: an admin row has to point at a real user id
-- in auth.users, and that row only exists once you have created the account
-- through the app's own signup form. Creating the user by hand in SQL is
-- possible but skips password hashing and the confirmation flow, so it is
-- not worth the risk — signing up takes ten seconds.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. BEFORE RUNNING: replace every CHANGE-ME@example.com below with the
--    exact address you signed up with. There are four of them in the
--    statements that actually run (sections 2, 3 and 3), so use your
--    editor's find-and-replace rather than doing it by eye.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 2. Confirm the account exists first. This should return exactly 1 row.
--    If it returns 0, the signup did not complete — check the address.
-- ---------------------------------------------------------------------
select u.id, u.email, u.created_at, u.email_confirmed_at
  from auth.users u
 where u.email = 'javazbek80@gmail.com';


-- ---------------------------------------------------------------------
-- 3. Grant admin.
--    handle_new_user() already inserted a 'student' row on signup; the
--    app treats the highest role as authoritative, so leaving it is fine.
--    Deleting it anyway keeps the table tidy and matches what
--    admin_set_role() does.
-- ---------------------------------------------------------------------
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
  from auth.users u
 where u.email = 'javazbek80@gmail.com'
on conflict (user_id, role) do nothing;

delete from public.user_roles
 where role = 'student'
   and user_id in (select id from auth.users where email = 'javazbek80@gmail.com');


-- ---------------------------------------------------------------------
-- 4. Verify. Expect one row: your email with role = admin.
-- ---------------------------------------------------------------------
select u.email, r.role, r.created_at
  from public.user_roles r
  join auth.users u on u.id = r.user_id
 order by r.created_at;


-- ---------------------------------------------------------------------
-- 5. Optional — the Desmos calculator key.
--    The schema seeds this row with an empty value, which makes the
--    in-test calculator fall back to nothing. Fill it in if you have a
--    key, or set it later from Admin -> Settings.
-- ---------------------------------------------------------------------
-- update public.app_settings
--    set value = 'your-desmos-api-key'
--  where key = 'desmos_api_key';


-- ---------------------------------------------------------------------
-- 6. Optional — grant someone the editor role.
--    Editors can manage questions, mock exams, daily tests and news, and
--    nothing else. They cannot promote, demote, ban or delete anyone.
-- ---------------------------------------------------------------------
-- insert into public.user_roles (user_id, role)
-- select u.id, 'editor'::public.app_role
--   from auth.users u
--  where u.email = 'editor@example.com'
-- on conflict (user_id, role) do nothing;
