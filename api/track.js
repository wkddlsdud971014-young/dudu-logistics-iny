// 두두택배 - 운송장 번호로 한 건 찾기
// 조회 화면(track.html)이 부른다.

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;

module.exports = async (req, res) => {
  if (!URL_ || !KEY) {
    return res.status(500).json({ error: '서버에 환경변수가 없습니다' });
  }
  const no = String((req.query && req.query.no) || '').replace(/\D/g, '');
  if (no.length !== 10) {
    return res.status(400).json({ error: '운송장 번호는 숫자 10자리입니다' });
  }
  try {
    const r = await fetch(
      URL_ + '/rest/v1/shipments?select=*&tracking_no=eq.' + encodeURIComponent(no),
      { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } }
    );
    const body = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: body.message || '조회 실패' });
    if (!body.length) return res.status(404).json({ error: '그런 운송장 번호가 없습니다' });
    return res.status(200).json({ row: body[0] });
  } catch (e) {
    return res.status(500).json({ error: '서버에서 문제가 생겼습니다', detail: String(e && e.message) });
  }
};
