-- Admin powers in the database require the two-step login (TOTP, Supabase
-- assurance level aal2), the same as the app's admin pages.
--
-- Before this, the app required aal2 for /admin and /api/admin, but RLS only
-- checked profiles.role. Someone holding only an admin's password got an aal1
-- token and could call PostgREST directly with the public anon key to read
-- every report, transcript and profile, change profiles, and run admin RPCs.
--
-- 1. is_admin() and is_platform_admin() return true only for an aal2 token.
-- 2. The policies (57 in production) that inlined `EXISTS (... p.role = 'admin')` instead of
--    calling is_admin() are rewritten to call it, so they follow the same rule.
--    The rewrite is mechanical (only that subquery is replaced) and the block
--    fails, rolling everything back, if any inline admin check is left.
--
-- An admin at aal1 is treated like any other signed-in user: their own rows
-- still work, admin rows do not. Server code using the service role is
-- unaffected (it bypasses RLS and was never is_admin()).
--
-- Reverse: restore the previous is_admin() / is_platform_admin() bodies (see
-- 20260730132727 and 20260803202511). The policy rewrite is behaviour-neutral
-- once is_admin() no longer checks aal, so it does not need undoing.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )
  and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

comment on function public.is_admin() is
  'True for an admin whose token passed two-step login (aal2). Use this, never an inline profiles.role check, in policies.';

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin();
$$;

do $$
declare
  r record;
  -- The deparsed form of the inline check, with either auth.uid() spelling.
  pat constant text := $p$EXISTS \( SELECT 1\s+FROM profiles p\s+WHERE \(\(p\.id = (\( SELECT auth\.uid\(\) AS uid\)|auth\.uid\(\))\) AND \(p\.role = 'admin'::user_role\)\)\)$p$;
  rep constant text := '( SELECT public.is_admin() AS is_admin)';
  new_qual text;
  new_check text;
  stmt text;
  n int := 0;
begin
  -- pg_policies prints names relative to public; re-run them the same way.
  perform set_config('search_path', 'public', true);

  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%''admin''::user_role%'
  loop
    new_qual := regexp_replace(r.qual, pat, rep, 'g');
    new_check := regexp_replace(r.with_check, pat, rep, 'g');
    stmt := format('alter policy %I on public.%I', r.policyname, r.tablename);
    if new_qual is not null then
      stmt := stmt || format(' using (%s)', new_qual);
    end if;
    if new_check is not null then
      stmt := stmt || format(' with check (%s)', new_check);
    end if;
    execute stmt;
    n := n + 1;
  end loop;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') || coalesce(with_check, '')) ~* $p$role\s*=\s*'admin'$p$
  ) then
    raise exception 'admin MFA migration: an inline admin role check is left in a policy';
  end if;

  raise notice 'admin MFA migration: rewrote % policies to use is_admin()', n;
end $$;
