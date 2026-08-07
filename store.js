// 두두택배 - 저장·조회 창구
// 네 화면(접수·완료·목록·조회)이 데이터를 주고받는 유일한 통로다.
//
// 지금은 브라우저(sessionStorage)에 담는다. 13:40에 Supabase로 갈아끼울 때
// **이 파일만** 고치면 되도록, 화면 코드는 Store.* 만 부르게 했다.
// 화면 코드 어디에도 sessionStorage 라는 낱말이 나오지 않는다.

const Store = {
  KEY: 'dudu.shipments',
  SEQ: 'dudu.seq',

  list() {
    try { return JSON.parse(sessionStorage.getItem(this.KEY)) || []; }
    catch (e) { return []; }
  },

  save(record) {
    const rows = this.list();
    rows.push(record);
    sessionStorage.setItem(this.KEY, JSON.stringify(rows));
    sessionStorage.setItem('dudu.last', record.trackingNo);
    return record;
  },

  // 방금 접수한 건. done.html이 이걸로 영수증을 그린다.
  last() {
    const no = sessionStorage.getItem('dudu.last');
    return this.list().find(r => r.trackingNo === no) || null;
  },

  find(trackingNo) {
    return this.list().find(r => r.trackingNo === trackingNo) || null;
  },

  clear() {
    [this.KEY, this.SEQ, 'dudu.last'].forEach(k => sessionStorage.removeItem(k));
  },

  // 운송장 번호 - 규정 §9 (지점코드 2자리 + 접수순번 8자리).
  // 순번을 sessionStorage에 둔다. 페이지가 나뉘면서 calc.js가 화면마다 다시
  // 읽히는데, 메모리 변수에 두면 접수할 때마다 1100000001로 되감긴다.
  //
  // ⚠️ 이건 임시 자리다. 창구 두 곳에서 동시에 접수하면 여기서는 여전히
  // 겹친다 - 각 브라우저가 서로를 모르기 때문이다. 진짜로 막는 것은 DB의
  // unique 제약뿐이다 (화면_서버_대조표.md 1번 "서버에서만 막을 수 있는 것").
  nextTrackingNo(branchCode) {
    let seq = {};
    try { seq = JSON.parse(sessionStorage.getItem(this.SEQ)) || {}; }
    catch (e) { seq = {}; }
    const issued = new Set(this.list().map(r => r.trackingNo));
    let n = (seq[branchCode] || 0) + 1;
    let no = branchCode + String(n).padStart(8, '0');
    while (issued.has(no)) {
      n += 1;
      no = branchCode + String(n).padStart(8, '0');
    }
    seq[branchCode] = n;
    sessionStorage.setItem(this.SEQ, JSON.stringify(seq));
    return no;
  },
};
