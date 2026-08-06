-- Therapy Room Mode (Mission 34)
-- Optional immersive interaction mode + private notes + immersion metrics.
-- Classic VoiceSession remains default (interaction_mode = 'classic').

alter table public.sessions
  add column if not exists interaction_mode text not null default 'classic';

alter table public.sessions
  add column if not exists private_notes text not null default '';

alter table public.sessions
  add column if not exists immersion_metrics jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sessions_interaction_mode_check'
  ) then
    alter table public.sessions
      add constraint sessions_interaction_mode_check
      check (interaction_mode in ('classic', 'therapy_room'));
  end if;
end $$;

comment on column public.sessions.interaction_mode is
  'classic = VoiceSession chat UI; therapy_room = immersive Therapy Room Mode';
comment on column public.sessions.private_notes is
  'Therapist private notes — never sent to the patient agent; exported with session';
comment on column public.sessions.immersion_metrics is
  'Therapy Room Immersion Index (TRII) snapshot written at session end';
