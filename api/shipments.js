// 두두택배 - 접수 저장·조회 서버 함수
// =================================================
// 화면(브라우저)은 Supabase 를 직접 부르지 않는다. 이 함수를 거친다.
// 그래야 열쇠가 화면 코드에 박히지 않는다 (CLAUDE.md 32줄 -
// "index.html 에 키를 하드코딩하지 않는다. 이 스택에서 키가 새는 유일한 경로다").
//
// 라이브러리를 설치하지 않는다. Supabase 는 평범한 REST 를 제공하므로
// 기본 fetch 로 부른다 (CLAUDE.md 9줄 "빌드 도구 없음").

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;
// 관리자 비밀번호. 화면 코드에 적지 않는다 - 적으면 소스 보기로 다 보인다.
// 값은 .env 와 Vercel Settings 두 곳에만 둔다.
const ADMIN = process.env.ADMIN_PASSWORD;

// 화면이 쓰는 이름 -> 표의 칸 이름
const TO_DB = {
  trackingNo: 'tracking_no', branchName: 'branch_name',
  senderName: 'sender_name', senderPhone: 'sender_phone', senderDong: 'sender_dong',
  receiverName: 'receiver_name', receiverPhone: 'receiver_phone',
  receiverArea: 'receiver_area', receiverDong: 'receiver_dong',
  regionType: 'region_type', category: 'category', itemName: 'item_name',
  weightKg: 'weight_kg', widthCm: 'width_cm', heightCm: 'height_cm', depthCm: 'depth_cm',
  volumeWeightKg: 'volume_weight_kg', billedWeightKg: 'billed_weight_kg',
  sizeGrade: 'size_grade', price: 'price', etaDate: 'eta_date',
  payType: 'pay_type', payMethod: 'pay_method', postalCode: 'postal_code',
  deliveryNote: 'delivery_note', channel: 'channel',
  isTest: 'is_test',
  // 아래 둘은 서버가 채운다. 화면이 보내지 않는다.
  acceptedAt: 'accepted_at', status: 'status',
};
// 화면이 보내면 안 되는 칸 - 서버가 정한다 (화면_서버_대조표 2·18번)
const SERVER_ONLY = ['accepted_at', 'status'];
const TO_APP = Object.fromEntries(Object.entries(TO_DB).map(([a, b]) => [b, a]));

function toDb(row) {
  const out = {};
  for (const k in row) {
    const col = TO_DB[k];
    if (col && row[k] !== undefined && !SERVER_ONLY.includes(col)) out[col] = row[k];
  }
  return out;
}
function toApp(row) {
  const out = {};
  for (const k in row) out[TO_APP[k] || k] = row[k];
  return out;
}

// 그 지점의 마지막 번호 다음을 준다. 표를 직접 보고 정한다.
async function nextNo(code) {
  const r = await sb('shipments?select=tracking_no' +
    '&tracking_no=like.' + code + '*' +
    '&order=tracking_no.desc&limit=1');
  if (!r.ok) return null;
  const rows = await r.json();
  const last = rows && rows[0] && rows[0].tracking_no;
  const n = last ? Number(String(last).slice(2)) : 0;
  return code + String((isFinite(n) ? n : 0) + 1).padStart(8, '0');
}

async function sb(path, init) {
  return fetch(URL_ + '/rest/v1/' + path, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/json',
      ...(init && init.headers),
    },
  });
}

module.exports = async (req, res) => {
  if (!URL_ || !KEY) {
    return res.status(500).json({
      error: '서버에 환경변수가 없습니다',
      hint: '.env 와 Vercel Settings 두 곳에 SUPABASE_URL / SUPABASE_ANON_KEY 를 넣어 주세요',
    });
  }

  try {
    // ── 목록 보기 (관리자만) ──
    // 접수 목록에는 손님 이름·전화가 들어 있어서 아무나 보면 안 된다.
    // 접수(POST)는 손님이 하는 일이라 막지 않는다.
    if (req.method === 'GET') {
      const pass = req.headers['x-admin-pass'] || '';
      if (!ADMIN) return res.status(500).json({ error: '서버에 관리자 비밀번호가 없습니다' });
      if (pass !== ADMIN) return res.status(401).json({ error: '비밀번호가 다릅니다' });
      const r = await sb('shipments?select=*&order=id.desc&limit=300');
      const body = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: body.message || '조회 실패', detail: body });
      return res.status(200).json({ rows: body.map(toApp) });
    }

    // ── 접수 저장 ──
    if (req.method === 'POST') {
      const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const row = toDb(raw);

      // 260807 운송장 번호는 서버가 뽑는다.
      //
      // 전에는 화면이 뽑았다. 화면은 표에 무엇이 들어 있는지 모른다.
      // 그래서 새 브라우저를 열면 늘 1100000001 부터 다시 시작했고,
      // 그 번호는 표에 이미 있었다. 조회하면 남의 접수 건이 나왔다.
      // 정책서에 적어 둔 "창구 두 곳이 서로를 모른다" 와 같은 자리다.
      // 표를 보고 뽑을 수 있는 것은 표 옆에 있는 이 서버뿐이다.
      const code = String(raw.branchCode || '').trim();
      if (!row.tracking_no) {
        if (!/^\d{2}$/.test(code)) {
          return res.status(400).json({ error: '접수 지점 코드가 없습니다' });
        }
        row.tracking_no = await nextNo(code);
      }
      if (!row.tracking_no) return res.status(400).json({ error: '운송장 번호를 만들지 못했습니다' });
      // 안 적어 보내면 진짜 접수로 본다. 빈 값(NULL)으로 두지 않는다 -
      // 빈 값은 true 도 false 도 아니라서 나중에 걸러지지 않는다.
      if (row.is_test === undefined || row.is_test === null) row.is_test = false;

      const r = await sb('shipments', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(row),
      });
      const body = await r.json();

      // 운송장 번호가 겹치면 표가 막아 준다 (setup.sql 의 unique).
      // 화면으로는 못 막는 것이라, 여기서 걸리면 다른 창구가 같은 번호를
      // 먼저 가져간 것이다. 화면에 다시 뽑으라고 알려 준다.
      if (r.status === 409 || (body && body.code === '23505')) {
        // 화면이 번호를 직접 정해 보낸 경우에만 돌려보낸다.
        // 서버가 뽑은 번호라면 그 사이에 다른 창구가 가져간 것이므로
        // 여기서 다음 번호로 다시 넣는다. 손님은 다시 누를 필요가 없다.
        if (code) {
          for (let i = 0; i < 5; i++) {
            row.tracking_no = await nextNo(code);
            const again = await sb('shipments', {
              method: 'POST',
              headers: { Prefer: 'return=representation' },
              body: JSON.stringify(row),
            });
            const b2 = await again.json();
            if (again.ok) return res.status(200).json({ row: toApp(Array.isArray(b2) ? b2[0] : b2) });
            if (!(again.status === 409 || (b2 && b2.code === '23505'))) {
              return res.status(again.status).json({ error: b2.message || '저장 실패', detail: b2 });
            }
          }
        }
        return res.status(409).json({
          error: '이미 있는 운송장 번호입니다',
          reason: 'duplicate_tracking_no',
        });
      }
      if (!r.ok) return res.status(r.status).json({ error: body.message || '저장 실패', detail: body });
      return res.status(200).json({ row: toApp(Array.isArray(body) ? body[0] : body) });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: '지원하지 않는 방식입니다' });
  } catch (e) {
    return res.status(500).json({ error: '서버에서 문제가 생겼습니다', detail: String(e && e.message) });
  }
};
