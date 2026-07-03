-- Skärper profiles-policyn: alla inloggade kan LÄSA, men bara admins kan ÄNDRA roll/modulåtkomst.
-- Alla kan fortsatt uppdatera sin egen profil (t.ex. namn), men inte roll/modul_order/modul_fastighet på andra.
drop policy if exists "Autentiserade användare kan läsa och skriva" on profiles;

create policy "Alla autentiserade kan läsa profiler"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "Admins kan uppdatera alla profiler"
  on profiles for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.roll = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.roll = 'admin'));

create policy "Användare kan uppdatera sin egen profil"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and roll = (select roll from profiles where id = auth.uid()));

-- VIKTIGT: sätt minst en admin, annars kan ingen ändra roller framöver (moment 22).
-- Byt ut e-postadressen mot ditt eget konto om det inte är adam.hofmann1@gmail.com.
update profiles set roll = 'admin' where epost = 'adam.hofmann1@gmail.com';
