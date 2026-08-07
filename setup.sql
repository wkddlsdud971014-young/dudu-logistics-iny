-- 두두택배 접수 표 - Supabase SQL Editor 에 통째로 붙여넣고 Run 한 번.
-- 여러 번 실행해도 안전합니다 (이미 있는 것은 건너뜁니다).
--
-- 260807 고친 곳 (화면_서버_대조표.md 참고)
--   1. 운송장 번호에 unique 를 걸었습니다  <- 화면으로는 못 막는 것
--   2. 접수 시각을 서버가 찍습니다          <- 화면으로는 못 막는 것
--   3. 접수 직후 상태 기본값을 넣었습니다    <- 화면으로는 못 막는 것
--   4. 권역·등급 이름을 규정에 맞췄습니다
--   5. 원장에 있는데 표에 없던 칸을 채웠습니다
--   6. 테스트 건을 나중에 골라 지울 수 있게 표시 칸을 뒀습니다

-- ─────────────────────────────────────────────────────────────
-- [1] 표 만들기 (이미 있으면 건너뜁니다)
-- ─────────────────────────────────────────────────────────────
create table if not exists shipments (
  id bigint generated always as identity primary key,
  tracking_no text,
  sender_name text,
  receiver_name text,
  receiver_area text,
  region_type text,
  item_name text,
  weight_kg numeric,
  width_cm numeric,
  height_cm numeric,
  depth_cm numeric,
  billed_weight_kg numeric,
  size_grade text,
  price int,
  eta_date date,
  status text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- [2] 원장에 있는데 표에 없던 칸 채우기
--     새 칸에는 not null 을 붙이지 않습니다. 빈 값이 오는 순간
--     저장이 전부 실패합니다. 필수 입력은 화면에서 막습니다.
-- ─────────────────────────────────────────────────────────────
alter table shipments add column if not exists accepted_at      timestamptz;
alter table shipments add column if not exists branch_name      text;
alter table shipments add column if not exists sender_phone     text;
alter table shipments add column if not exists sender_dong      text;
alter table shipments add column if not exists receiver_phone   text;
alter table shipments add column if not exists receiver_dong    text;
alter table shipments add column if not exists category         text;
alter table shipments add column if not exists volume_weight_kg numeric;
alter table shipments add column if not exists pay_type         text;
alter table shipments add column if not exists delivery_note    text;
alter table shipments add column if not exists channel          text;
alter table shipments add column if not exists is_test          boolean;

-- ─────────────────────────────────────────────────────────────
-- [3] 서버에서만 막을 수 있는 것 세 가지
--     화면은 창구마다 따로 돌아서 서로를 모릅니다. 두 창구가 같은
--     순간에 접수하면 같은 번호를 뽑습니다. 여기서만 막힙니다.
-- ─────────────────────────────────────────────────────────────

-- 3-1. 운송장 번호는 한 번만 받습니다
--      정책서에서 찾은 중복 45쌍이 이것 때문에 생겼을 수 있습니다.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shipments_tracking_no_unique'
  ) then
    alter table shipments
      add constraint shipments_tracking_no_unique unique (tracking_no);
  end if;
end $$;

-- 3-2. 접수 시각은 서버 시계로 찍습니다
--      손님 컴퓨터 시계는 바꿀 수 있어서 믿지 않습니다.
alter table shipments alter column accepted_at set default now();

-- 3-3. 접수 직후 상태는 사람이 고르지 않습니다
--      데이터 사전의 7단계 중 첫 단계입니다.
alter table shipments alter column status set default '집화처리';

-- ─────────────────────────────────────────────────────────────
-- [4] 누가 읽고 쓸 수 있는지 (RLS)
--     끄지 않습니다. 끄면 누구나 표를 읽고 쓸 수 있게 됩니다.
-- ─────────────────────────────────────────────────────────────
alter table shipments enable row level security;

drop policy if exists "anon insert" on shipments;
create policy "anon insert" on shipments
  for insert to anon with check (true);

drop policy if exists "anon select" on shipments;
create policy "anon select" on shipments
  for select to anon using (true);

-- ─────────────────────────────────────────────────────────────
-- [5] 샘플 5건 (표가 비어 있을 때만 들어갑니다)
--     260807 고침: 전에는 진주를 '원거리', 거제를 '도서' 로 적고
--     요금도 6000/10000 으로 넣어 두었는데, 규정 2절은 거제·진주가
--     다리·도로로 이어진 '일반' 지역이라고 못 박고 있습니다.
--     그래서 권역과 요금을 규정대로 바로잡았습니다.
--     도착 지역도 시·도 단위로 고쳤습니다 (규정 7절).
-- ─────────────────────────────────────────────────────────────
insert into shipments (tracking_no, branch_name, sender_name, receiver_name,
                       receiver_area, region_type, category, item_name,
                       weight_kg, width_cm, height_cm, depth_cm,
                       volume_weight_kg, billed_weight_kg, size_grade, price,
                       eta_date, pay_type, channel, status, is_test)
select * from (values
  -- 이불: 실제 3kg 인데 부피무게 20kg -> 요금무게 20kg, 세변합 150cm -> 대형, 일반 9000
  ('1100000001', '서울지점', '김하늘', '이준서', '서울', '일반', '가구·침구', '이불',
   3.0, 60, 40, 50, 20.0, 20.0, '대형', 9000, (current_date + 1), '선불', '방문접수', '집화처리', false),
  -- 책: 실제 12kg > 부피무게 2kg -> 요금무게 12kg, 세변합 70cm -> 중형, 일반 6000
  ('1200000001', '용산지점', '박서연', '최민준', '서울', '일반', '도서·문구', '책',
   12.0, 30, 20, 20, 2.0, 12.0, '중형', 6000, (current_date + 1), '선불', '방문접수', '집화처리', false),
  -- 화장품: 요금무게 1.5kg, 세변합 45cm -> 극소형. 경남(진주)은 일반 -> 3500
  ('3100000001', '진주지점', '정예린', '한도윤', '경남', '일반', '화장품·미용', '화장품',
   1.5, 20, 15, 10, 0.5, 1.5, '극소형', 3500, (current_date + 1), '선불', '방문접수', '집화처리', false),
  -- 운동화: 부피무게 2.92kg, 세변합 80cm -> 소형. 경남(거제)은 일반 -> 4000
  ('3200000001', '거제지점', '오시우', '임하린', '경남', '일반', '의류·패션', '운동화',
   2.0, 35, 25, 20, 2.92, 2.92, '소형', 4000, (current_date + 1), '선불', '방문접수', '집화처리', false),
  -- 쌀: 세변합 70cm 는 소형인데 무게 8kg 이라 한 등급 올라 중형, 일반 6000
  ('4100000001', '울산지점', '서지호', '문가은', '울산', '일반', '식품', '쌀',
   8.0, 30, 20, 20, 2.0, 8.0, '중형', 6000, (current_date + 1), '선불', '방문접수', '집화처리', false)
) as sample(tracking_no, branch_name, sender_name, receiver_name,
            receiver_area, region_type, category, item_name,
            weight_kg, width_cm, height_cm, depth_cm,
            volume_weight_kg, billed_weight_kg, size_grade, price,
            eta_date, pay_type, channel, status, is_test)
where not exists (select 1 from shipments);

-- ─────────────────────────────────────────────────────────────
-- [6] 잘 들어갔는지 보기
-- ─────────────────────────────────────────────────────────────
select tracking_no, branch_name, receiver_area, region_type,
       size_grade, price, status, is_test, accepted_at
from shipments
order by id;

-- ─────────────────────────────────────────────────────────────
-- [7] 테스트로 넣은 건 지우기  (테스트가 끝난 뒤에 이 줄만 실행)
--     is_test = true 인 것만 지웁니다. 진짜 접수 건은 건드리지 않습니다.
--     실행 전에 위 [6] 으로 몇 건인지 먼저 세어 보세요.
-- ─────────────────────────────────────────────────────────────
-- delete from shipments where is_test = true;
