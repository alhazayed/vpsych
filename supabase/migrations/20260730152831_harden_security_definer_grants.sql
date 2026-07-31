-- Revoke public/anon execute on sensitive functions
revoke execute on function public.create_session_report(uuid, jsonb, text, jsonb) from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Authenticated may call report writer and role helpers; trigger fn is not for RPC
grant execute on function public.create_session_report(uuid, jsonb, text, jsonb) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_user_role() to authenticated;
