revoke all on function public.has_role(uuid, public.app_role) from public;
revoke all on function public.has_role(uuid, public.app_role) from anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;

drop policy if exists "own training examples" on public.training_examples;
create policy "admins manage training examples"
on public.training_examples for all to authenticated
using (public.has_role(auth.uid(), 'admin') and auth.uid() = user_id)
with check (public.has_role(auth.uid(), 'admin') and auth.uid() = user_id);

drop policy if exists "own language profile" on public.language_profiles;
create policy "authenticated read language profile"
on public.language_profiles for select to authenticated
using (true);
create policy "admins insert language profile"
on public.language_profiles for insert to authenticated
with check (public.has_role(auth.uid(), 'admin') and auth.uid() = user_id);
create policy "admins update language profile"
on public.language_profiles for update to authenticated
using (public.has_role(auth.uid(), 'admin') and auth.uid() = user_id)
with check (public.has_role(auth.uid(), 'admin') and auth.uid() = user_id);
create policy "admins delete language profile"
on public.language_profiles for delete to authenticated
using (public.has_role(auth.uid(), 'admin') and auth.uid() = user_id);