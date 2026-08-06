-- Virtual Mental Health Center (Mission 35)
-- Private session notes + clinic day schedule.
-- Additive only; does not alter session_reports RLS or message RPCs.

DO $$ BEGIN
  CREATE TYPE public.clinic_note_format AS ENUM (
    'soap', 'dap', 'birp', 'free', 'voice'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.clinic_appointment_status AS ENUM (
    'scheduled', 'checked_in', 'in_session', 'completed', 'no_show', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.clinic_urgency AS ENUM (
    'routine', 'soon', 'urgent', 'emergent'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.clinic_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  day_date date NOT NULL,
  summary jsonb,
  reflection_journal text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (therapist_id, day_date)
);

CREATE TABLE IF NOT EXISTS public.clinic_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_day_id uuid NOT NULL REFERENCES public.clinic_days (id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  avatar_id uuid NOT NULL REFERENCES public.avatars (id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  slot_index int NOT NULL DEFAULT 0,
  scheduled_at timestamptz NOT NULL,
  status public.clinic_appointment_status NOT NULL DEFAULT 'scheduled',
  urgency public.clinic_urgency NOT NULL DEFAULT 'routine',
  referral_source text NOT NULL DEFAULT 'Primary care referral',
  session_number int NOT NULL DEFAULT 1,
  difficulty text NOT NULL DEFAULT 'intermediate'
    CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'expert')),
  outstanding_tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clinic_appointments_day_idx
  ON public.clinic_appointments (clinic_day_id, slot_index);
CREATE INDEX IF NOT EXISTS clinic_appointments_therapist_idx
  ON public.clinic_appointments (therapist_id, scheduled_at);
CREATE INDEX IF NOT EXISTS clinic_appointments_session_idx
  ON public.clinic_appointments (session_id);

CREATE TABLE IF NOT EXISTS public.session_private_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  format public.clinic_note_format NOT NULL DEFAULT 'free',
  body text NOT NULL DEFAULT '',
  voice_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_private_notes_session_idx
  ON public.session_private_notes (session_id, created_at);

-- Optional session UI mode for resume routing (chat | therapy_room)
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS ui_mode text
  CHECK (ui_mode IS NULL OR ui_mode IN ('chat', 'therapy_room'));

ALTER TABLE public.clinic_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_private_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapist select own clinic_days"
  ON public.clinic_days FOR SELECT TO authenticated
  USING (
    therapist_id = (select auth.uid())
    OR (select public.is_admin())
  );

CREATE POLICY "Therapist insert own clinic_days"
  ON public.clinic_days FOR INSERT TO authenticated
  WITH CHECK (therapist_id = (select auth.uid()));

CREATE POLICY "Therapist update own clinic_days"
  ON public.clinic_days FOR UPDATE TO authenticated
  USING (
    therapist_id = (select auth.uid())
    OR (select public.is_admin())
  )
  WITH CHECK (
    therapist_id = (select auth.uid())
    OR (select public.is_admin())
  );

CREATE POLICY "Therapist select own clinic_appointments"
  ON public.clinic_appointments FOR SELECT TO authenticated
  USING (
    therapist_id = (select auth.uid())
    OR (select public.is_admin())
  );

CREATE POLICY "Therapist insert own clinic_appointments"
  ON public.clinic_appointments FOR INSERT TO authenticated
  WITH CHECK (therapist_id = (select auth.uid()));

CREATE POLICY "Therapist update own clinic_appointments"
  ON public.clinic_appointments FOR UPDATE TO authenticated
  USING (
    therapist_id = (select auth.uid())
    OR (select public.is_admin())
  )
  WITH CHECK (
    therapist_id = (select auth.uid())
    OR (select public.is_admin())
  );

CREATE POLICY "Therapist select own private notes"
  ON public.session_private_notes FOR SELECT TO authenticated
  USING (
    therapist_id = (select auth.uid())
    OR (select public.is_admin())
  );

CREATE POLICY "Therapist insert own private notes"
  ON public.session_private_notes FOR INSERT TO authenticated
  WITH CHECK (
    therapist_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id AND s.therapist_id = (select auth.uid())
    )
  );

CREATE POLICY "Therapist update own private notes"
  ON public.session_private_notes FOR UPDATE TO authenticated
  USING (therapist_id = (select auth.uid()))
  WITH CHECK (therapist_id = (select auth.uid()));

CREATE POLICY "Therapist delete own private notes"
  ON public.session_private_notes FOR DELETE TO authenticated
  USING (therapist_id = (select auth.uid()));

COMMENT ON TABLE public.session_private_notes IS
  'Therapist private notes during VMHC sessions. Never used in patient LLM prompts.';
COMMENT ON TABLE public.clinic_days IS
  'Virtual Mental Health Center clinic day (FEATURE_THERAPY_ROOM).';
COMMENT ON COLUMN public.sessions.ui_mode IS
  'Optional UI surface: chat (legacy) or therapy_room (VMHC).';
