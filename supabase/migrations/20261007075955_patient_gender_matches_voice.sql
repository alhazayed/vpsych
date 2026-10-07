-- Patient gender is male or female and matches the patient's voice
-- (a female voice means a female patient and vice versa). Owner decision
-- 2026-10-07.
--
-- jordan-hale is the only active patient that broke the rule: authored as
-- non-binary (they/them) in English but voiced by male voices in both
-- languages (Adam EN, Fadi AR), and its Arabic personality (رامي نصّار) is
-- already written as a man. Make the patient male: set the gender and remove
-- the English passages that state a non-binary identity. Nothing clinical
-- changes (diagnosis, symptoms, history, risk); the Arabic personality and
-- both voices are untouched.
--
-- Inactive draft/test rows are left as they are; the app refuses to save or
-- publish a patient whose gender is not male/female or does not match its
-- voice, so none of them can go live unfixed.
--
-- Revert: set gender back to 'non-binary' in avatars.gender,
-- avatars.clinical_core.gender and personas.identity.gender, and restore the
-- English text from the values quoted below.

update public.avatars a
set
  clinical_core = jsonb_set(a.clinical_core, '{gender}', '"male"'),
  gender = 'male',
  persona_prompt = replace(
    a.persona_prompt,
    ' You use they/them pronouns; this is settled and unremarkable to you and is not what you are here about.',
    ''
  ),
  personalities = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              a.personalities,
              '{en-US,persona_prompt}',
              to_jsonb(replace(
                a.personalities #>> '{en-US,persona_prompt}',
                ' You use they/them pronouns; this is settled and unremarkable to you and is not what you are here about.',
                ''
              ))
            ),
            '{en-US,case_file,identity,full_biography}',
            to_jsonb(replace(
              a.personalities #>> '{en-US,case_file,identity,full_biography}',
              ' Jordan came out as non-binary at 28. It went better than they had spent two years rehearsing: their sister already knew, their mother cried and then adjusted, their father says ''they'' correctly about eighty percent of the time and is visibly trying. It is settled. It is not why they are here, and they will say so, kindly, if a therapist goes looking for a problem there.',
              ''
            ))
          ),
          '{en-US,case_file,consistency_rules,never_changes,0}',
          to_jsonb('Male; he/him pronouns, used naturally and never a topic in this case.'::text)
        ),
        '{en-US,case_file,consistency_rules,immutable_biographical_facts,0}',
        to_jsonb(replace(
          a.personalities #>> '{en-US,case_file,consistency_rules,immutable_biographical_facts,0}',
          'Jordan Hale (they/them)',
          'Jordan Hale (he/him)'
        ))
      ),
      '{en-US,case_file,therapy_behaviour,culturally_specific_notes,3}',
      to_jsonb('Gender is not a clinical issue in this case; a therapist who makes it the topic has misread the patient.'::text)
    ),
    '{en-US,parity_note}',
    to_jsonb(replace(
      a.personalities #>> '{en-US,parity_note}',
      ' Non-binary, uses they/them — this is settled, unremarkable to them, and is NOT a clinical issue in this case. A therapist who treats gender as the presenting problem has misread the patient.',
      ''
    ))
  ),
  updated_at = now()
where a.slug = 'jordan-hale'
  and a.clinical_core ->> 'gender' = 'non-binary';

update public.personas p
set identity = jsonb_set(p.identity, '{gender}', '"male"')
from public.avatars a
where a.id = p.avatar_id
  and a.slug = 'jordan-hale'
  and p.identity ->> 'gender' = 'non-binary';
