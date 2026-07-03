-- Storage-bucket för orderbilder (BilderTab laddar upp hit)
insert into storage.buckets (id, name, public)
values ('order-bilder', 'order-bilder', true)
on conflict (id) do update set public = true;

-- Rättigheter på storage.objects för bucketen (appen kör som anon-roll)
drop policy if exists "order-bilder läs" on storage.objects;
drop policy if exists "order-bilder ladda upp" on storage.objects;
drop policy if exists "order-bilder radera" on storage.objects;

create policy "order-bilder läs" on storage.objects
  for select using (bucket_id = 'order-bilder');
create policy "order-bilder ladda upp" on storage.objects
  for insert with check (bucket_id = 'order-bilder');
create policy "order-bilder radera" on storage.objects
  for delete using (bucket_id = 'order-bilder');
