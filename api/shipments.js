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
  payType: 'pay_type', deliveryNote: 'delivery_note', channel: 'channel',
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
      const row = toDb(typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {});
      if (!row.tracking_no) return res.status(400).json({ error: '운송장 번호가 없습니다' });

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
