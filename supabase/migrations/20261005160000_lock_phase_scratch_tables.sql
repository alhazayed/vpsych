-- Close the Supabase security advisor findings left after the skill-test release.
--
-- 1. _phase85_hmac_results, _phase86a_results and _phase87_results are scratch
--    tables written by the Phase 8.5-8.7 production verification runs. No
--    migration created them and the app never reads them, but they sat in the
--    exposed public schema with RLS off and SELECT/INSERT granted to
--    `authenticated`. Enable RLS with no policies and drop the API grants so
--    only the service role / postgres can reach them. The rows are kept.
-- 2. voice_profiles_set_updated_at had a role-mutable search_path.
-- 3. quality_ledger_reject_mutation is a trigger function; nobody needs to call
--    it over /rest/v1/rpc. Triggers keep firing without EXECUTE.
--
-- Reversible: `alter table ... disable row level security` and re-grant.

alter table if exists public._phase85_hmac_results enable row level security;
alter table if exists public._phase86a_results enable row level security;
alter table if exists public._phase87_results enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['_phase85_hmac_results', '_phase86a_results', '_phase87_results']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end
$$;

alter function public.voice_profiles_set_updated_at() set search_path = public, pg_temp;

revoke execute on function public.quality_ledger_reject_mutation() from public, anon, authenticated;
