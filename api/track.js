// 두두택배 - 운송장 번호로 한 건 찾기
// 조회 화면(track.html)이 부른다.

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;

// 표의 칸 이름(receiver_name)을 화면 이름(receiverName)으로 바꾼다.
// 260807 이걸 빼먹어서 조회 화면에 이름·주소가 전부 '-' 로 나왔다.
// 표와 화면이 같은 이름을 쓰는 칸(price, status, category)만 우연히 보였다.
const TO_APP = {
  tracking_no: 'trackingNo', accepted_at: 'acceptedAt', branch_name: 'branchName',
  sender_name: 'senderName', sender_phone: 'senderPhone',
  receiver_name: 'receiverName', receiver_phone: 'receiverPhone',
  receiver_area: 'receiverArea', receiver_dong: 'receiverDong',
  region_type: 'regionType', item_name: 'itemName',
  weight_kg: 'weightKg', width_cm: 'widthCm', height_cm: 'heightCm', depth_cm: 'depthCm',
  volume_weight_kg: 'volumeWeightKg', billed_weight_kg: 'billedWeightKg',
  size_grade: 'sizeGrade', eta_date: 'etaDate',
  pay_type: 'payType', pay_method: 'payMethod', postal_code: 'postalCode',
  delivery_note: 'deliveryNote', is_test: 'isTest',
};
function toApp(row) {
  const out = {};
  for (const k in row) out[TO_APP[k] || k] = row[k];
  return out;
}

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
    return res.status(200).json({ row: toApp(body[0]) });
  } catch (e) {
    return res.status(500).json({ error: '서버에서 문제가 생겼습니다', detail: String(e && e.message) });
  }
};
