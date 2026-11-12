-- Demo content for Kashkadarya (Qarshi, Gʻuzor, Shahrisabz, Kitob, Koson, Muborak).
-- Needs 008_nearby.sql first; independent of seed_uzbekistan.sql. Remove with cleanup_demo.sql.
-- Users: player25–34@demo.kickoff.invalid · groups: de000001-…05–07 · games: de000002-…19–27
-- Times are UTC; Uzbekistan is UTC+5 (14:00 UTC = 19:00 in Qarshi).
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select ('de000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'player' || n || '@demo.kickoff.invalid',
       jsonb_build_object('full_name', name), now() - ((n - 24) || ' days')::interval, now()
from (values (25,'Sanjar Joʻrayev'),(26,'Farrux Normatov'),(27,'Islom Haydarov'),(28,'Bobur Choriyev'),
             (29,'Elyor Mamatqulov'),(30,'Doniyor Rajabov'),(31,'Alisher Toshpoʻlatov'),(32,'Mirjalol Boʻriyev'),
             (33,'Akmal Qurbonov'),(34,'Zafar Eshmurodov')) v(n, name);

create temp table ku on commit drop as
select n, ('de000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid id from generate_series(25,34) n;

insert into public.groups (id, name, description, created_by, lat, lng) values
  ('de000001-0000-4000-8000-000000000005', 'Qarshi Futbol Jamoasi',
   'Qarshida haftada bir necha marta oʻyin, hamma darajalar uchun. Pickup games around Qarshi, all levels welcome.',
   (select id from ku where n = 25), 38.86, 65.79),
  ('de000001-0000-4000-8000-000000000006', 'Gʻuzor Futbol Ishqibozlari',
   'Gʻuzorda dam olish kunlari va hafta oʻrtasida futbol.',
   (select id from ku where n = 29), 38.62, 66.25),
  ('de000001-0000-4000-8000-000000000007', 'Shahrisabz–Kitob Futbol',
   'Shahrisabz va Kitobda kechki va shanba oʻyinlari. Evening and Saturday games in Shahrisabz and Kitob.',
   (select id from ku where n = 31), 39.06, 66.83);

insert into public.group_members (group_id, user_id, role, status)
select 'de000001-0000-4000-8000-000000000005'::uuid, id, 'participant', 'active' from ku where n in (26,27,28,33)
union all select 'de000001-0000-4000-8000-000000000006'::uuid, id, 'participant', 'active' from ku where n in (28,30,34)
union all select 'de000001-0000-4000-8000-000000000007'::uuid, id, 'participant', 'active' from ku where n in (26,32);

-- id, host n, title, venue, address, lat, lng, starts_at, duration, min, max, price (tiyin), method, instructions, group
create temp table kg (id uuid, host int, title text, descr text, venue text, address text, lat float8, lng float8,
                      starts timestamptz, dur int, mn int, mx int, price int, method text, instr text, grp uuid) on commit drop;
insert into kg values
  ('de000002-0000-4000-8000-000000000019', 25, 'Nasaf maydonida shanba oʻyini', 'Katta maydon, ikki taym 40 daqiqadan. Hamma darajalar uchun.',
   'Nasaf stadioni', 'Qarshi, Qashqadaryo viloyati', 38.8510, 65.7960, '2026-11-14 10:00+00', 90, 14, 22, 0, 'stripe', null,
   'de000001-0000-4000-8000-000000000005'),
  ('de000002-0000-4000-8000-000000000020', 26, 'Universitet maydonida 7v7', 'Seshanba kechki oʻyin, chiroqlar bor.',
   'QarDU sport maydoni', 'Kuchabogʻ koʻchasi, Qarshi', 38.8420, 65.7850, '2026-11-17 14:00+00', 90, 10, 16, 0, 'stripe', null, null),
  ('de000002-0000-4000-8000-000000000021', 27, 'Qarshi futzal kechasi', 'Пятница, 5 на 5, крытый зал. Замены по ходу.',
   'Qarshi sport saroyi', 'Mustaqillik shoh koʻchasi, Qarshi', 38.8650, 65.8000, '2026-11-13 15:00+00', 60, 8, 12, 2000000, 'direct',
   'Naqd pul, oʻyindan oldin · Наличными перед игрой', 'de000001-0000-4000-8000-000000000005'),
  ('de000002-0000-4000-8000-000000000022', 29, 'Gʻuzor yakshanba oʻyini', 'Yakshanba kuni tuman stadionida. Oq va qora futbolka olib keling.',
   'Gʻuzor tuman stadioni', 'Gʻuzor, Qashqadaryo viloyati', 38.6210, 66.2480, '2026-11-15 10:00+00', 90, 12, 18, 0, 'stripe', null,
   'de000001-0000-4000-8000-000000000006'),
  ('de000002-0000-4000-8000-000000000023', 30, 'Gʻuzor 5v5', 'Hafta oʻrtasidagi tez oʻyin.',
   'Gʻuzor mini-futbol maydoni', 'Gʻuzor markazi', 38.6150, 66.2560, '2026-11-18 14:00+00', 60, 8, 12, 1500000, 'direct',
   'Naqd pul, oʻyindan oldin', 'de000001-0000-4000-8000-000000000006'),
  ('de000002-0000-4000-8000-000000000024', 31, 'Shahrisabz shanba kubogi', 'Shanba kuni katta maydonda. Jamoalar joyida tuziladi.',
   'Shahrisabz markaziy stadioni', 'Shahrisabz, Qashqadaryo viloyati', 39.0580, 66.8300, '2026-11-21 10:00+00', 90, 12, 18, 0, 'stripe', null,
   'de000001-0000-4000-8000-000000000007'),
  ('de000002-0000-4000-8000-000000000025', 32, 'Kitob kechki futbol', 'Payshanba kechqurun, sunʼiy qoplama.',
   'Kitob stadioni', 'Kitob, Qashqadaryo viloyati', 39.1200, 66.8800, '2026-11-19 13:30+00', 90, 10, 14, 0, 'stripe', null,
   'de000001-0000-4000-8000-000000000007'),
  ('de000002-0000-4000-8000-000000000026', 33, 'Koson pickup', 'Sunday morning game, all levels.',
   'Koson mini-futbol maydoni', 'Koson, Qashqadaryo viloyati', 39.0380, 65.5850, '2026-11-22 05:00+00', 90, 10, 16, 0, 'stripe', null, null),
  ('de000002-0000-4000-8000-000000000027', 34, 'Muborak 7v7', 'Shanba kungi doʻstona oʻyin.',
   'Muborak stadioni', 'Muborak, Qashqadaryo viloyati', 39.2550, 65.1530, '2026-11-21 11:00+00', 90, 10, 14, 0, 'stripe', null, null);

-- Open to everyone (group_id only shows which group runs them), so testers can see them.
insert into public.matches (id, host_id, title, description, venue_name, address, lat, lng, starts_at, duration_min,
                            min_players, max_players, price_cents, currency, status, group_id, visibility, payment_method, payment_instructions)
select kg.id, ku.id, title, descr, venue, address, lat, lng, starts, dur, mn, mx, price, 'uzs', 'open', grp, 'public', method, instr
from kg join ku on ku.n = kg.host;

-- players going (hosts already added by trigger)
insert into public.rsvps (match_id, user_id, status)
select v.m, ku.id, 'going' from (values
  ('de000002-0000-4000-8000-000000000019'::uuid, array[26,27,28,29,30,31,33,34]),
  ('de000002-0000-4000-8000-000000000020'::uuid, array[25,27,28,33]),
  ('de000002-0000-4000-8000-000000000021'::uuid, array[25,26,28,30,33,34]),
  ('de000002-0000-4000-8000-000000000022'::uuid, array[25,26,28,30,31,34]),
  ('de000002-0000-4000-8000-000000000023'::uuid, array[28,29,34]),
  ('de000002-0000-4000-8000-000000000024'::uuid, array[25,26,27,29,32]),
  ('de000002-0000-4000-8000-000000000025'::uuid, array[26,30,31]),
  ('de000002-0000-4000-8000-000000000026'::uuid, array[25,28]),
  ('de000002-0000-4000-8000-000000000027'::uuid, array[29,30])
) v(m, ns) join ku on ku.n = any(v.ns);

insert into public.chat_messages (user_id, body, created_at, match_id, group_id)
select ku.id, body, now() - (mins || ' minutes')::interval, mid, gid from (values
  (25, 'Shanba kuni Nasafda soat 15:00 da boshlaymiz', 240, 'de000002-0000-4000-8000-000000000019'::uuid, null::uuid),
  (28, 'Men boraman, ikki doʻstimni ham olib kelaman', 220, 'de000002-0000-4000-8000-000000000019'::uuid, null::uuid),
  (33, 'Кроссовки или бутсы?', 90, 'de000002-0000-4000-8000-000000000019'::uuid, null::uuid),
  (25, 'Бутсы можно, поле натуральное', 85, 'de000002-0000-4000-8000-000000000019'::uuid, null::uuid),
  (27, 'Juma kuni futzal ham bor, joylar cheklangan', 360, null::uuid, 'de000001-0000-4000-8000-000000000005'::uuid),
  (26, 'Zoʻr, roʻyxatdan oʻtdim', 350, null::uuid, 'de000001-0000-4000-8000-000000000005'::uuid)
) v(n, body, mins, mid, gid) join ku on ku.n = v.n;

commit;
