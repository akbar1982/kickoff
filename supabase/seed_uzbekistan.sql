-- Demo content for Uzbekistan testers. Needs 008_nearby.sql first. Remove with cleanup_demo.sql.
-- Users: player13–24@demo.kickoff.invalid · groups: de000001-…03/04 · games: de000002-…10–18
-- Times are UTC; Uzbekistan is UTC+5 (14:00 UTC = 19:00 in Tashkent).
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select ('de000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'player' || n || '@demo.kickoff.invalid',
       jsonb_build_object('full_name', name), now() - ((n - 12) || ' days')::interval, now()
from (values (13,'Aziz Karimov'),(14,'Dilshod Rahimov'),(15,'Jasur Tursunov'),(16,'Sardor Aliyev'),
             (17,'Bekzod Nazarov'),(18,'Rustam Yusupov'),(19,'Timur Ismoilov'),(20,'Otabek Saidov'),
             (21,'Shohruh Ergashev'),(22,'Kamola Umarova'),(23,'Nodir Xolmatov'),(24,'Ulugʻbek Qodirov')) v(n, name);

create temp table u as select n, ('de000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid id from generate_series(13,24) n;

insert into public.groups (id, name, description, created_by, lat, lng) values
  ('de000001-0000-4000-8000-000000000003', 'Toshkent Pickup Futbol',
   'Toshkent boʻylab haftada bir necha marta oʻyin. Hamma darajadagi oʻyinchilar uchun. Pickup games across Tashkent, all levels welcome.',
   (select id from u where n = 13), 41.31, 69.24),
  ('de000001-0000-4000-8000-000000000004', 'Samarqand Futbol Doʻstlari',
   'Samarqandda dam olish kunlari va hafta oʻrtasida futbol. Weekend and midweek games in Samarkand.',
   (select id from u where n = 21), 39.65, 66.96);

insert into public.group_members (group_id, user_id, role, status)
select 'de000001-0000-4000-8000-000000000003'::uuid, id, 'participant', 'active' from u where n between 14 and 20
union all select 'de000001-0000-4000-8000-000000000004'::uuid, id, 'participant', 'active' from u where n in (22,23,24);

-- id, host n, title, venue, address, lat, lng, starts_at, duration, min, max, price (tiyin), method, instructions, group
create temp table g (id uuid, host int, title text, descr text, venue text, address text, lat float8, lng float8,
                     starts timestamptz, dur int, mn int, mx int, price int, method text, instr text, grp uuid);
insert into g values
  ('de000002-0000-4000-8000-000000000010', 13, 'Chilonzor 7v7', 'Shanba kungi oʻyin, hamma darajalar uchun. Oq va qora futbolka olib keling.',
   'Chilonzor sport majmuasi', 'Bunyodkor shoh koʻchasi, Chilonzor, Toshkent', 41.2856, 69.2034, '2026-11-14 11:00+00', 90, 10, 16, 0, 'stripe', null,
   'de000001-0000-4000-8000-000000000003'),
  ('de000002-0000-4000-8000-000000000011', 15, 'Пятничный мини-футбол', 'Играем 5 на 5, замены по ходу. Крытый зал.',
   'Sergeli futzal zali', 'Sergeli tumani, Toshkent', 41.2260, 69.2190, '2026-11-13 15:00+00', 60, 8, 12, 3000000, 'direct',
   'Naqd pul, oʻyindan oldin · Наличными перед игрой', null),
  ('de000002-0000-4000-8000-000000000012', 14, 'Yunusobod Sunday League', 'Full field, two halves of 40 minutes. Bring shin guards.',
   'Yunusobod sport majmuasi', 'Amir Temur shoh koʻchasi, Yunusobod, Toshkent', 41.3648, 69.2869, '2026-11-15 06:00+00', 120, 14, 22, 0, 'stripe', null, null),
  ('de000002-0000-4000-8000-000000000013', 13, 'Anhor boʻyida kechki futbol', 'Sunʼiy qoplamali maydon, chiroqlar bor.',
   'Anhor mini-futbol maydoni', 'Navoiy koʻchasi, Shayxontohur, Toshkent', 41.3160, 69.2580, '2026-11-16 14:30+00', 90, 10, 14, 0, 'stripe', null,
   'de000001-0000-4000-8000-000000000003'),
  ('de000002-0000-4000-8000-000000000014', 18, 'After-Work 8v8', 'Intermediate pace. Pitch is booked, lights included.',
   'Buyuk Ipak Yoʻli futbol maydoni', 'Buyuk Ipak Yoʻli koʻchasi, Mirzo Ulugʻbek, Toshkent', 41.3290, 69.3360, '2026-11-18 14:00+00', 90, 12, 16, 2500000, 'direct',
   'Naqd pul yoki Click, oʻyindan oldin', null),
  ('de000002-0000-4000-8000-000000000015', 20, 'Chirchiq Saturday Match', 'Toshkentdan 40 daqiqa. Hamma uchun ochiq.',
   'Chirchiq stadioni', 'Chirchiq, Toshkent viloyati', 41.4689, 69.5822, '2026-11-21 05:00+00', 90, 14, 22, 0, 'stripe', null, null),
  ('de000002-0000-4000-8000-000000000016', 21, 'Registon kubogi', 'Dam olish kuni katta maydonda oʻyin. Jamoalar joyida tuziladi.',
   'Dinamo stadioni', 'Samarqand', 39.6505, 66.9560, '2026-11-14 11:00+00', 90, 12, 18, 0, 'stripe', null,
   'de000001-0000-4000-8000-000000000004'),
  ('de000002-0000-4000-8000-000000000017', 22, 'Samarqand futzal', 'Hafta oʻrtasidagi tez oʻyin, 5 ga 5.',
   'Samarqand futzal markazi', 'Universitet xiyoboni, Samarqand', 39.6547, 66.9757, '2026-11-19 14:00+00', 60, 8, 12, 2000000, 'direct',
   'Naqd pul, oʻyindan oldin', 'de000001-0000-4000-8000-000000000004'),
  ('de000002-0000-4000-8000-000000000018', 24, 'Buxoro pickup', 'Sunday game in Bukhara, all levels.',
   'Buxoro Arena', 'Buxoro', 39.7550, 64.4410, '2026-11-22 11:00+00', 90, 10, 16, 0, 'stripe', null, null);

-- Uzbekistan games are open to everyone (group_id only shows which group runs them), so testers can see them.
insert into public.matches (id, host_id, title, description, venue_name, address, lat, lng, starts_at, duration_min,
                            min_players, max_players, price_cents, currency, status, group_id, visibility, payment_method, payment_instructions)
select g.id, u.id, title, descr, venue, address, lat, lng, starts, dur, mn, mx, price, 'uzs', 'open', grp, 'public', method, instr
from g join u on u.n = g.host;

-- players going (hosts already added by trigger)
insert into public.rsvps (match_id, user_id, status)
select v.m, u.id, 'going' from (values
  ('de000002-0000-4000-8000-000000000010'::uuid, array[14,15,16,17,18,19,20,23]),
  ('de000002-0000-4000-8000-000000000011'::uuid, array[13,14,16,17,19,20,24]),
  ('de000002-0000-4000-8000-000000000012'::uuid, array[13,15,16,17,18,19,20,22,23]),
  ('de000002-0000-4000-8000-000000000013'::uuid, array[14,15,17,19]),
  ('de000002-0000-4000-8000-000000000014'::uuid, array[13,14,15,16,17,19,20,21,22,23,24]),
  ('de000002-0000-4000-8000-000000000015'::uuid, array[13,16]),
  ('de000002-0000-4000-8000-000000000016'::uuid, array[13,14,15,16,17,18,19,20,22,23,24]),
  ('de000002-0000-4000-8000-000000000017'::uuid, array[21,23]),
  ('de000002-0000-4000-8000-000000000018'::uuid, array[21,22])
) v(m, ns) join u on u.n = any(v.ns);

insert into public.chat_messages (user_id, body, created_at, match_id, group_id)
select u.id, body, now() - (mins || ' minutes')::interval, mid, gid from (values
  (13, 'Shanba kuni Chilonzorda oʻynaymiz, soat 16:00 da', 300, 'de000002-0000-4000-8000-000000000010'::uuid, null::uuid),
  (16, 'Men keldim 👍 Toʻp olib kelaman', 280, 'de000002-0000-4000-8000-000000000010', null),
  (19, 'Кто-нибудь может подвезти от метро Чиланзар?', 120, 'de000002-0000-4000-8000-000000000010', null),
  (14, 'Могу, напиши мне', 110, 'de000002-0000-4000-8000-000000000010', null),
  (13, 'Dushanba kuni Anhor boʻyida ham oʻyin bor, roʻyxatdan oʻting', 400, null, 'de000001-0000-4000-8000-000000000003'),
  (17, 'Zoʻr, men qatnashaman', 390, null, 'de000001-0000-4000-8000-000000000003'),
  (20, 'Keyingi hafta Chirchiqda ham oʻynasak boʻladimi?', 200, null, 'de000001-0000-4000-8000-000000000003')
) v(n, body, mins, mid, gid) join u on u.n = v.n;

commit;
