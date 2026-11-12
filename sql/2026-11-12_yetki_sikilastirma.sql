-- Nöbet Defteri · 12 Kasım 2026 · veritabanı yetkisi sıkılaştırma
-- 1) Yayınlı listeyi (schedules) yalnız yönetici doğrudan yazabilir.
-- 2) Üye takası kabul etmek ve "ilk isteyen alır" açık nöbetini almak için sunucudaki iki işlevi kullanır;
--    işlev listede yalnız o takası / o tek nöbeti değiştirdiğini denetler.
-- 3) Üye kendi üyelik satırında yalnız adını ve birimini değiştirebilir (sayı, gece, "nöbet tutmaz", yönetici vb. değil).
-- 4) Takas isteğinde alıcı yalnız "reddet" diyebilir; kabul sunucuda yapılır.

-- 1) schedules
drop policy if exists sched_insert on public.schedules;
drop policy if exists sched_update on public.schedules;
create policy sched_insert on public.schedules for insert with check (public.is_admin_of(dept_id));
create policy sched_update on public.schedules for update using (public.is_admin_of(dept_id)) with check (public.is_admin_of(dept_id));

-- 3) memberships: yönetici olmayan yalnız ad ve birim değiştirebilir
create or replace function public.trg_member_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin_of(old.dept_id) then return new; end if;
  if new.user_id is distinct from old.user_id or new.dept_id is distinct from old.dept_id
     or new.quota is distinct from old.quota or new.works_after is distinct from old.works_after
     or new.carry_t is distinct from old.carry_t or new.carry_w is distinct from old.carry_w or new.carry_b is distinct from old.carry_b
     or new.shift_prefs is distinct from old.shift_prefs or new.is_admin is distinct from old.is_admin
     or new.is_test is distinct from old.is_test or new.joined_at is distinct from old.joined_at then
    raise exception 'Bu ayarı yalnız yönetici değiştirebilir' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists memberships_guard on public.memberships;
create trigger memberships_guard before update on public.memberships for each row execute function public.trg_member_guard();

-- 4) swap_requests: yönetici olmayan alıcı yalnız bekleyen isteği reddedebilir
create or replace function public.trg_swap_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin_of(old.dept_id) or current_setting('nd.sunucu', true) = '1' then return new; end if;
  if new.id is distinct from old.id or new.dept_id is distinct from old.dept_id or new.month is distinct from old.month
     or new.day is distinct from old.day or new.out_id is distinct from old.out_id or new.in_id is distinct from old.in_id
     or new.note is distinct from old.note or old.status is distinct from 'bekliyor' or new.status is distinct from 'red' then
    raise exception 'Takas isteği burada yalnız reddedilebilir' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists swap_requests_guard on public.swap_requests;
create trigger swap_requests_guard before update on public.swap_requests for each row execute function public.trg_swap_guard();

-- 2a) takas kabulü: istemci yeni listeyi gönderir; işlev yalnız o günde çıkan kişinin yerine alan kişinin yazıldığını denetler
create or replace function public.swap_accept(req bigint, new_data jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  r public.swap_requests; s public.schedules; k text; oa jsonb; na jsonb; i int; diff int := 0;
  derived text[] := array['cnt','hours','night','wk','bay','dc','nc','wec','wdc','mh','md','ek'];
begin
  select * into r from public.swap_requests where id = req for update;
  if r.id is null then return json_build_object('error', 'İstek bulunamadı'); end if;
  if r.status is distinct from 'bekliyor' then return json_build_object('error', 'Bu istek zaten yanıtlanmış'); end if;
  if not (r.in_id = auth.uid()
          or (public.is_admin_of(r.dept_id) and exists (select 1 from public.memberships m where m.user_id = r.in_id and m.dept_id = r.dept_id and m.is_test))) then
    return json_build_object('error', 'Bu isteği yalnız alıcı yanıtlayabilir');
  end if;
  select * into s from public.schedules where dept_id = r.dept_id and month = r.month for update;
  if s.dept_id is null then return json_build_object('error', 'Liste bulunamadı'); end if;
  if (s.data - derived - 'asg') is distinct from (new_data - derived - 'asg') then
    return json_build_object('error', 'Listede takas dışında değişiklik var');
  end if;
  for k in select jsonb_object_keys(coalesce(s.data -> 'asg', '{}'::jsonb)) union select jsonb_object_keys(coalesce(new_data -> 'asg', '{}'::jsonb)) loop
    if k = r.day::text then continue; end if;
    if (s.data -> 'asg' -> k) is distinct from (new_data -> 'asg' -> k) then
      return json_build_object('error', 'Takas günü dışında değişiklik var');
    end if;
  end loop;
  oa := coalesce(s.data -> 'asg' -> (r.day::text), '[]'::jsonb);
  na := coalesce(new_data -> 'asg' -> (r.day::text), '[]'::jsonb);
  if jsonb_typeof(oa) <> 'array' or jsonb_typeof(na) <> 'array' or jsonb_array_length(oa) <> jsonb_array_length(na) then
    return json_build_object('error', 'Takas günü uyuşmuyor');
  end if;
  for i in 0 .. jsonb_array_length(oa) - 1 loop
    if (oa -> i) is distinct from (na -> i) then
      if (oa -> i ->> 'id') = r.out_id::text and (na -> i ->> 'id') = r.in_id::text and ((oa -> i) - 'id') = ((na -> i) - 'id') then
        diff := diff + 1;
      else
        return json_build_object('error', 'Takas günü uyuşmuyor');
      end if;
    end if;
  end loop;
  if diff <> 1 then return json_build_object('error', 'Takas günü uyuşmuyor'); end if;
  update public.schedules set data = new_data where dept_id = r.dept_id and month = r.month;
  perform set_config('nd.sunucu', '1', true);     -- yalnız bu işlem içinde: kabul durumunu sunucu yazar
  update public.swap_requests set status = 'kabul' where id = req;
  return json_build_object('ok', true);
end $$;

-- 2b) açık nöbeti alma ("ilk isteyen alır"): o güne yalnız çağıran kişinin tek bir nöbeti eklenmiş olmalı
create or replace function public.open_claim(d uuid, mk text, day int, new_data jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  s public.schedules; dep public.departments; k text; oa jsonb; na jsonb; i int; me uuid := auth.uid();
  derived text[] := array['cnt','hours','night','wk','bay','dc','nc','wec','wdc','mh','md','ek'];
begin
  if me is null or not exists (select 1 from public.memberships m where m.user_id = me and m.dept_id = d) then
    return json_build_object('error', 'Bu ekibin üyesi değilsin');
  end if;
  select * into dep from public.departments where id = d;
  if coalesce(dep.opts ->> 'open_mode', 'off') <> 'first' then
    return json_build_object('error', 'Bu ekipte açık nöbeti yönetici veriyor');
  end if;
  select * into s from public.schedules where dept_id = d and month = mk for update;
  if s.dept_id is null then return json_build_object('error', 'Liste bulunamadı'); end if;
  if (s.data - derived - 'asg') is distinct from (new_data - derived - 'asg') then
    return json_build_object('error', 'Listede başka değişiklik var');
  end if;
  for k in select jsonb_object_keys(coalesce(s.data -> 'asg', '{}'::jsonb)) union select jsonb_object_keys(coalesce(new_data -> 'asg', '{}'::jsonb)) loop
    if k = day::text then continue; end if;
    if (s.data -> 'asg' -> k) is distinct from (new_data -> 'asg' -> k) then
      return json_build_object('error', 'Başka günler değişmiş');
    end if;
  end loop;
  oa := coalesce(s.data -> 'asg' -> (day::text), '[]'::jsonb);
  na := coalesce(new_data -> 'asg' -> (day::text), '[]'::jsonb);
  if jsonb_typeof(oa) <> 'array' or jsonb_typeof(na) <> 'array' or jsonb_array_length(na) <> jsonb_array_length(oa) + 1 then
    return json_build_object('error', 'O güne tek bir nöbet eklenmeli');
  end if;
  for i in 0 .. jsonb_array_length(oa) - 1 loop
    if (oa -> i) is distinct from (na -> i) then return json_build_object('error', 'O günün diğer nöbetleri değişmiş'); end if;
    if (oa -> i ->> 'id') = me::text and coalesce((oa -> i ->> 'ic')::boolean, false) = false then
      return json_build_object('error', 'O gün zaten nöbetin var');
    end if;
  end loop;
  if (na -> jsonb_array_length(oa) ->> 'id') is distinct from me::text then
    return json_build_object('error', 'Yalnız kendi adına nöbet alabilirsin');
  end if;
  update public.schedules set data = new_data where dept_id = d and month = mk;
  return json_build_object('ok', true);
end $$;

revoke all on function public.swap_accept(bigint, jsonb) from public, anon;
revoke all on function public.open_claim(uuid, text, int, jsonb) from public, anon;
grant execute on function public.swap_accept(bigint, jsonb) to authenticated;
grant execute on function public.open_claim(uuid, text, int, jsonb) to authenticated;
