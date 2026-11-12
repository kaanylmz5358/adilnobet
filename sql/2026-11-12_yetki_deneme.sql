-- Yetki değişikliğinin denemesi: aynı işlem içinde değişikliği kurar, uydurma bir ekip üzerinde üye / yönetici / yabancı gözüyle dener,
-- sonunda bilerek hata verir; böylece HİÇBİR ŞEY kalıcı olarak yazılmaz. Sonuçlar hata mesajında (SONUC>>) görünür.
do $do$
declare res text:=''; tmp text; n int;
begin
execute $mig$drop policy if exists sched_insert on public.schedules$mig$;
execute $mig$drop policy if exists sched_update on public.schedules$mig$;
execute $mig$create policy sched_insert on public.schedules for insert with check (public.is_admin_of(dept_id))$mig$;
execute $mig$create policy sched_update on public.schedules for update using (public.is_admin_of(dept_id)) with check (public.is_admin_of(dept_id))$mig$;
execute $mig$create or replace function public.trg_member_guard() returns trigger
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
end $$$mig$;
execute $mig$drop trigger if exists memberships_guard on public.memberships$mig$;
execute $mig$create trigger memberships_guard before update on public.memberships for each row execute function public.trg_member_guard()$mig$;
execute $mig$create or replace function public.trg_swap_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin_of(old.dept_id) or current_setting('nd.sunucu', true) = '1' then return new; end if;
  if new.id is distinct from old.id or new.dept_id is distinct from old.dept_id or new.month is distinct from old.month
     or new.day is distinct from old.day or new.out_id is distinct from old.out_id or new.in_id is distinct from old.in_id
     or new.note is distinct from old.note or old.status is distinct from 'bekliyor' or new.status is distinct from 'red' then
    raise exception 'Takas isteği burada yalnız reddedilebilir' using errcode = '42501';
  end if;
  return new;
end $$$mig$;
execute $mig$drop trigger if exists swap_requests_guard on public.swap_requests$mig$;
execute $mig$create trigger swap_requests_guard before update on public.swap_requests for each row execute function public.trg_swap_guard()$mig$;
execute $mig$create or replace function public.swap_accept(req bigint, new_data jsonb) returns json
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
end $$$mig$;
execute $mig$create or replace function public.open_claim(d uuid, mk text, day int, new_data jsonb) returns json
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
end $$$mig$;
execute $mig$revoke all on function public.swap_accept(bigint, jsonb) from public, anon$mig$;
execute $mig$revoke all on function public.open_claim(uuid, text, int, jsonb) from public, anon$mig$;
execute $mig$grant execute on function public.swap_accept(bigint, jsonb) to authenticated$mig$;
execute $mig$grant execute on function public.open_claim(uuid, text, int, jsonb) to authenticated$mig$;

insert into departments(id,name,join_code,opts) values ('00000000-0000-4000-9000-00000000d001','__test__','ZZTEST99','{}'::jsonb);
insert into memberships(user_id,dept_id,name,is_admin) values ('00000000-0000-4000-9000-0000000000a1','00000000-0000-4000-9000-00000000d001','A',true),('00000000-0000-4000-9000-0000000000b1','00000000-0000-4000-9000-00000000d001','M1',false),('00000000-0000-4000-9000-0000000000b2','00000000-0000-4000-9000-00000000d001','M2',false),('00000000-0000-4000-9000-0000000000b3','00000000-0000-4000-9000-00000000d001','M3',false);
insert into schedules(dept_id,month,data) values ('00000000-0000-4000-9000-00000000d001','2099-01','{"mode":"shifts","asg":{"1":[{"id":"00000000-0000-4000-9000-0000000000a1","s":0},{"id":"00000000-0000-4000-9000-0000000000b1","s":1}],"2":[{"id":"00000000-0000-4000-9000-0000000000b1","s":0},{"id":"00000000-0000-4000-9000-0000000000b2","s":1}],"3":[{"id":"00000000-0000-4000-9000-0000000000b2","s":0}]},"cnt":{"00000000-0000-4000-9000-0000000000a1":1,"00000000-0000-4000-9000-0000000000b1":2,"00000000-0000-4000-9000-0000000000b2":2},"rules":{"x":1}}'::jsonb);
insert into swap_requests(id,dept_id,month,day,out_id,in_id,status) overriding system value values (-91,'00000000-0000-4000-9000-00000000d001','2099-01',1,'00000000-0000-4000-9000-0000000000b1','00000000-0000-4000-9000-0000000000b3','bekliyor'),(-92,'00000000-0000-4000-9000-00000000d001','2099-01',2,'00000000-0000-4000-9000-0000000000b2','00000000-0000-4000-9000-0000000000b3','bekliyor'),(-93,'00000000-0000-4000-9000-00000000d001','2099-01',3,'00000000-0000-4000-9000-0000000000b2','00000000-0000-4000-9000-0000000000b1','bekliyor');
execute 'set local role authenticated';

perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-9000-0000000000b1','role','authenticated')::text, true);
begin update schedules set data='{}'::jsonb where dept_id='00000000-0000-4000-9000-00000000d001' and month='2099-01'; get diagnostics n = row_count; tmp:='satir='||n; res:=res||'uye_liste_yazar: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'uye_liste_yazar: HATA '||sqlerrm||E'\n'; end;
begin update memberships set name='M1x' where user_id='00000000-0000-4000-9000-0000000000b1' and dept_id='00000000-0000-4000-9000-00000000d001'; get diagnostics n = row_count; tmp:='satir='||n; res:=res||'uye_ad_degistirir: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'uye_ad_degistirir: HATA '||sqlerrm||E'\n'; end;
begin update memberships set shift_prefs='{"noDuty":true}'::jsonb where user_id='00000000-0000-4000-9000-0000000000b1' and dept_id='00000000-0000-4000-9000-00000000d001'; tmp:=''; res:=res||'uye_kendi_gece_ayari: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'uye_kendi_gece_ayari: HATA '||sqlerrm||E'\n'; end;
begin update memberships set quota=9 where user_id='00000000-0000-4000-9000-0000000000b1' and dept_id='00000000-0000-4000-9000-00000000d001'; tmp:=''; res:=res||'uye_kendi_sayi: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'uye_kendi_sayi: HATA '||sqlerrm||E'\n'; end;
begin update memberships set is_admin=true where user_id='00000000-0000-4000-9000-0000000000b1' and dept_id='00000000-0000-4000-9000-00000000d001'; tmp:=''; res:=res||'uye_kendini_yonetici: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'uye_kendini_yonetici: HATA '||sqlerrm||E'\n'; end;
begin tmp:=swap_accept(-91,'{"mode":"shifts","asg":{"1":[{"id":"00000000-0000-4000-9000-0000000000a1","s":0},{"id":"00000000-0000-4000-9000-0000000000b3","s":1}],"2":[{"id":"00000000-0000-4000-9000-0000000000b1","s":0},{"id":"00000000-0000-4000-9000-0000000000b2","s":1}],"3":[{"id":"00000000-0000-4000-9000-0000000000b2","s":0}]},"cnt":{"changed":1},"rules":{"x":1}}'::jsonb)::text; res:=res||'uye_baskasinin_takasini_kabul: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'uye_baskasinin_takasini_kabul: HATA '||sqlerrm||E'\n'; end;
begin update swap_requests set status='red',reason='reddedildi' where id=-93; get diagnostics n = row_count; tmp:='satir='||n; res:=res||'uye_alici_reddeder: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'uye_alici_reddeder: HATA '||sqlerrm||E'\n'; end;
perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-9000-0000000000b3','role','authenticated')::text, true);
begin update swap_requests set status='kabul' where id=-91; tmp:=''; res:=res||'alici_dogrudan_kabul_yazar: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'alici_dogrudan_kabul_yazar: HATA '||sqlerrm||E'\n'; end;
begin update swap_requests set day=3 where id=-91; tmp:=''; res:=res||'alici_ayni_gunu_degistirmeye_calisir: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'alici_ayni_gunu_degistirmeye_calisir: HATA '||sqlerrm||E'\n'; end;
begin tmp:=swap_accept(-91,'{"mode":"shifts","asg":{"1":[{"id":"00000000-0000-4000-9000-0000000000a1","s":0},{"id":"00000000-0000-4000-9000-0000000000b3","s":1}],"2":[{"id":"00000000-0000-4000-9000-0000000000b3","s":0},{"id":"00000000-0000-4000-9000-0000000000b2","s":1}],"3":[{"id":"00000000-0000-4000-9000-0000000000b2","s":0}]},"cnt":{"changed":1},"rules":{"x":1}}'::jsonb)::text; res:=res||'takas_baska_gunu_de_degistirir: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'takas_baska_gunu_de_degistirir: HATA '||sqlerrm||E'\n'; end;
begin tmp:=swap_accept(-91,'{"mode":"shifts","asg":{"1":[{"id":"00000000-0000-4000-9000-0000000000a1","s":0},{"id":"00000000-0000-4000-9000-0000000000b3","s":1}],"2":[{"id":"00000000-0000-4000-9000-0000000000b1","s":0},{"id":"00000000-0000-4000-9000-0000000000b2","s":1}],"3":[{"id":"00000000-0000-4000-9000-0000000000b2","s":0}]},"cnt":{"changed":1},"rules":{"x":2}}'::jsonb)::text; res:=res||'takas_kurallari_degistirir: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'takas_kurallari_degistirir: HATA '||sqlerrm||E'\n'; end;
begin tmp:=swap_accept(-91,'{"mode":"shifts","asg":{"1":[{"id":"00000000-0000-4000-9000-0000000000a1","s":0},{"id":"00000000-0000-4000-9000-0000000000b3","s":1}],"2":[{"id":"00000000-0000-4000-9000-0000000000b1","s":0},{"id":"00000000-0000-4000-9000-0000000000b2","s":1}],"3":[{"id":"00000000-0000-4000-9000-0000000000b2","s":0}]},"cnt":{"changed":1},"rules":{"x":1}}'::jsonb)::text; res:=res||'takas_dogru: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'takas_dogru: HATA '||sqlerrm||E'\n'; end;
begin select (data->'asg'->'1')::text||' st='||(select status from swap_requests where id=-91) into tmp from schedules where dept_id='00000000-0000-4000-9000-00000000d001' and month='2099-01'; res:=res||'takas_sonrasi_liste: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'takas_sonrasi_liste: HATA '||sqlerrm||E'\n'; end;
begin tmp:=swap_accept(-91,'{"mode":"shifts","asg":{"1":[{"id":"00000000-0000-4000-9000-0000000000a1","s":0},{"id":"00000000-0000-4000-9000-0000000000b3","s":1}],"2":[{"id":"00000000-0000-4000-9000-0000000000b1","s":0},{"id":"00000000-0000-4000-9000-0000000000b2","s":1}],"3":[{"id":"00000000-0000-4000-9000-0000000000b2","s":0}]},"cnt":{"changed":1},"rules":{"x":1}}'::jsonb)::text; res:=res||'takas_ikinci_kez: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'takas_ikinci_kez: HATA '||sqlerrm||E'\n'; end;
begin tmp:=open_claim('00000000-0000-4000-9000-00000000d001','2099-01',3,'{"mode":"shifts","asg":{"1":[{"id":"00000000-0000-4000-9000-0000000000a1","s":0},{"id":"00000000-0000-4000-9000-0000000000b1","s":1}],"2":[{"id":"00000000-0000-4000-9000-0000000000b1","s":0},{"id":"00000000-0000-4000-9000-0000000000b2","s":1}],"3":[{"id":"00000000-0000-4000-9000-0000000000b2","s":0},{"id":"00000000-0000-4000-9000-0000000000b3","s":1}]},"cnt":{"00000000-0000-4000-9000-0000000000a1":1,"00000000-0000-4000-9000-0000000000b1":2,"00000000-0000-4000-9000-0000000000b2":2},"rules":{"x":1}}'::jsonb)::text; res:=res||'acik_nobet_mod_kapali: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'acik_nobet_mod_kapali: HATA '||sqlerrm||E'\n'; end;
perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-9000-0000000000a1','role','authenticated')::text, true);
begin update departments set opts='{"open_mode":"first"}'::jsonb where id='00000000-0000-4000-9000-00000000d001'; get diagnostics n = row_count; tmp:='satir='||n; res:=res||'yonetici_acik_nobet_ac: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'yonetici_acik_nobet_ac: HATA '||sqlerrm||E'\n'; end;
perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-9000-0000000000b3','role','authenticated')::text, true);
begin tmp:=open_claim('00000000-0000-4000-9000-00000000d001','2099-01',3,'{"mode":"shifts","asg":{"1":[{"id":"00000000-0000-4000-9000-0000000000a1","s":0},{"id":"00000000-0000-4000-9000-0000000000b1","s":1}],"2":[{"id":"00000000-0000-4000-9000-0000000000b1","s":0},{"id":"00000000-0000-4000-9000-0000000000b2","s":1}],"3":[{"id":"00000000-0000-4000-9000-0000000000b2","s":0},{"id":"00000000-0000-4000-9000-0000000000b1","s":1}]},"cnt":{"00000000-0000-4000-9000-0000000000a1":1,"00000000-0000-4000-9000-0000000000b1":2,"00000000-0000-4000-9000-0000000000b2":2},"rules":{"x":1}}'::jsonb)::text; res:=res||'acik_nobet_baskasi_adina: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'acik_nobet_baskasi_adina: HATA '||sqlerrm||E'\n'; end;
begin tmp:=open_claim('00000000-0000-4000-9000-00000000d001','2099-01',3,'{"mode":"shifts","asg":{"1":[{"id":"00000000-0000-4000-9000-0000000000a1","s":0},{"id":"00000000-0000-4000-9000-0000000000b1","s":1}],"2":[{"id":"00000000-0000-4000-9000-0000000000b1","s":0},{"id":"00000000-0000-4000-9000-0000000000b2","s":1}],"3":[{"id":"00000000-0000-4000-9000-0000000000b2","s":0},{"id":"00000000-0000-4000-9000-0000000000b3","s":1}]},"cnt":{"00000000-0000-4000-9000-0000000000a1":1,"00000000-0000-4000-9000-0000000000b1":2,"00000000-0000-4000-9000-0000000000b2":2},"rules":{"x":1}}'::jsonb)::text; res:=res||'acik_nobet_eski_liste_ile: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'acik_nobet_eski_liste_ile: HATA '||sqlerrm||E'\n'; end;
begin tmp:=open_claim('00000000-0000-4000-9000-00000000d001','2099-01',3,'{"mode":"shifts","asg":{"1":[{"id":"00000000-0000-4000-9000-0000000000a1","s":0},{"id":"00000000-0000-4000-9000-0000000000b3","s":1}],"2":[{"id":"00000000-0000-4000-9000-0000000000b1","s":0},{"id":"00000000-0000-4000-9000-0000000000b2","s":1}],"3":[{"id":"00000000-0000-4000-9000-0000000000b2","s":0},{"id":"00000000-0000-4000-9000-0000000000b3","s":1}]},"cnt":{"changed":1},"rules":{"x":1}}'::jsonb)::text; res:=res||'acik_nobet_dogru: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'acik_nobet_dogru: HATA '||sqlerrm||E'\n'; end;
begin select (data->'asg'->'3')::text into tmp from schedules where dept_id='00000000-0000-4000-9000-00000000d001' and month='2099-01'; res:=res||'acik_nobet_sonrasi: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'acik_nobet_sonrasi: HATA '||sqlerrm||E'\n'; end;
perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-9000-0000000000a1','role','authenticated')::text, true);
begin update schedules set data=data||'{"z":1}'::jsonb where dept_id='00000000-0000-4000-9000-00000000d001' and month='2099-01'; get diagnostics n = row_count; tmp:='satir='||n; res:=res||'yonetici_liste_yazar: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'yonetici_liste_yazar: HATA '||sqlerrm||E'\n'; end;
begin update memberships set shift_prefs='{"target":5}'::jsonb, quota=3 where user_id='00000000-0000-4000-9000-0000000000b2' and dept_id='00000000-0000-4000-9000-00000000d001'; get diagnostics n = row_count; tmp:='satir='||n; res:=res||'yonetici_uye_ayari: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'yonetici_uye_ayari: HATA '||sqlerrm||E'\n'; end;
begin update swap_requests set status='kabul' where id=-92; get diagnostics n = row_count; tmp:='satir='||n; res:=res||'yonetici_takas_kabul: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'yonetici_takas_kabul: HATA '||sqlerrm||E'\n'; end;
perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-9000-0000000000ff','role','authenticated')::text, true);
begin tmp:=open_claim('00000000-0000-4000-9000-00000000d001','2099-01',3,'{"mode":"shifts","asg":{"1":[{"id":"00000000-0000-4000-9000-0000000000a1","s":0},{"id":"00000000-0000-4000-9000-0000000000b1","s":1}],"2":[{"id":"00000000-0000-4000-9000-0000000000b1","s":0},{"id":"00000000-0000-4000-9000-0000000000b2","s":1}],"3":[{"id":"00000000-0000-4000-9000-0000000000b2","s":0},{"id":"00000000-0000-4000-9000-0000000000b3","s":1}]},"cnt":{"00000000-0000-4000-9000-0000000000a1":1,"00000000-0000-4000-9000-0000000000b1":2,"00000000-0000-4000-9000-0000000000b2":2},"rules":{"x":1}}'::jsonb)::text; res:=res||'yabanci_acik_nobet: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'yabanci_acik_nobet: HATA '||sqlerrm||E'\n'; end;
begin tmp:=swap_accept(-92,'{"mode":"shifts","asg":{"1":[{"id":"00000000-0000-4000-9000-0000000000a1","s":0},{"id":"00000000-0000-4000-9000-0000000000b3","s":1}],"2":[{"id":"00000000-0000-4000-9000-0000000000b1","s":0},{"id":"00000000-0000-4000-9000-0000000000b2","s":1}],"3":[{"id":"00000000-0000-4000-9000-0000000000b2","s":0}]},"cnt":{"changed":1},"rules":{"x":1}}'::jsonb)::text; res:=res||'yabanci_takas: ok '||coalesce(tmp,'')||E'\n'; exception when others then res:=res||'yabanci_takas: HATA '||sqlerrm||E'\n'; end;
raise exception 'SONUC>>%', res;
end $do$;