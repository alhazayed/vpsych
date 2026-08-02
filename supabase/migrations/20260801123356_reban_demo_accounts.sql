-- Re-assert the security contract: *.vpsych.test demo accounts stay banned.
-- README documents these as disabled; they were observed unbanned in production.

UPDATE auth.users
SET banned_until = '2099-01-01 00:00:00+00'
WHERE email IN ('admin@vpsych.test', 'therapist@vpsych.test')
  AND (banned_until IS NULL OR banned_until < now());
