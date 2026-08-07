// 두두택배 - 저장·조회 창구
// 네 화면(접수·운송장·목록·조회)이 데이터를 주고받는 유일한 통로다.
// 화면 코드 어디에도 sessionStorage 나 supabase 라는 낱말이 나오지 않는다.
//
// 260807 서버(Supabase)로 갈아끼웠다.
//   1순위: api/shipments.js 를 거쳐 표에 넣고 읽는다
//   2순위: 서버가 없거나 답이 없으면 이 브라우저 안에만 담는다
// 2순위를 남겨 둔 이유 - 열쇠를 넣기 전에도 화면이 돌아야 하고, 창구에서
// 인터넷이 끊겼을 때 접수 자체가 막히면 안 되기 때문이다.

const Store = {
  KEY: 'dudu.shipments',
  SEQ: 'dudu.seq',
  DRAFT: 'dudu.draft',
  LAST: 'dudu.last',

  // 260807 오후 - 연습 건을 다 지우고 여기서부터는 진짜 접수로 본다.
  // 연습이 아니라고 적어 두어야 나중에 지우는 명령에 휩쓸리지 않는다.
  // (지우는 명령: delete from shipments where is_test is distinct from false)
  IS_TEST: false,

  // 지금 어디에 담기고 있는지. 화면이 손님에게 알려 줄 때 쓴다.
  where: '확인 중',

  // ── 브라우저 임시 보관 (서버가 안 될 때만) ──────────────
  _local() {
    try { return JSON.parse(sessionStorage.getItem(this.KEY)) || []; }
    catch (e) { return []; }
  },
  _pushLocal(record) {
    const rows = this._local();
    rows.push(record);
    sessionStorage.setItem(this.KEY, JSON.stringify(rows));
  },

  // ── 접수 저장 ───────────────────────────────────────────
  // 성공하면 { ok:true, row, where } 를 돌려준다.
  // 운송장 번호가 겹치면 { ok:false, duplicate:true } 다 - 다른 창구가
  // 같은 번호를 먼저 가져간 것이라, 화면이 번호를 다시 뽑아 재시도한다.
  async save(record) {
    const body = Object.assign({}, record, { isTest: this.IS_TEST });
    try {
      const r = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));

      if (r.status === 409 || data.reason === 'duplicate_tracking_no') {
        return { ok: false, duplicate: true, error: data.error || '이미 있는 운송장 번호입니다' };
      }
      if (r.ok && data.row) {
        this.where = '서버';
        sessionStorage.setItem(this.LAST, JSON.stringify(data.row));
        return { ok: true, row: data.row, where: '서버' };
      }
      throw new Error(data.error || ('서버가 ' + r.status + ' 로 답했습니다'));
    } catch (e) {
      // 260807 전에는 여기서 ok:true 를 돌려줬다. 표에 아무것도 안 들어갔는데
      // 화면은 "접수 완료" 라고 말했다. 손님은 저장이 안 된 줄 모르고 갔다.
      // 적은 내용은 잃지 않게 이 브라우저에 담아 두되, 완료라고는 하지 않는다.
      this.where = '이 브라우저';
      this._pushLocal(body);
      sessionStorage.setItem(this.LAST, JSON.stringify(body));
      return { ok: false, row: body, where: '이 브라우저', offline: true,
               error: String(e && e.message) };
    }
  },

  // ── 목록 ────────────────────────────────────────────────
  async list() {
    try {
      const r = await fetch('/api/shipments');
      const data = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(data.rows)) {
        this.where = '서버';
        return { rows: data.rows, where: '서버' };
      }
      throw new Error(data.error || ('서버가 ' + r.status + ' 로 답했습니다'));
    } catch (e) {
      this.where = '이 브라우저';
      return { rows: this._local().slice().reverse(), where: '이 브라우저',
               offline: true, error: String(e && e.message) };
    }
  },

  // ── 관리자 목록 ─────────────────────────────────────────
  // 비밀번호는 서버가 검사한다. 여기서는 들고 갈 뿐이다.
  async adminList(pass) {
    try {
      const r = await fetch('/api/shipments', { headers: { 'x-admin-pass': pass || '' } });
      const data = await r.json().catch(() => ({}));
      if (r.status === 401) return { denied: true, error: data.error || '비밀번호가 다릅니다' };
      if (r.ok && Array.isArray(data.rows)) return { rows: data.rows, where: '서버' };
      throw new Error(data.error || ('서버가 ' + r.status + ' 로 답했습니다'));
    } catch (e) {
      return { rows: this._local().slice().reverse(), where: '이 브라우저',
               offline: true, error: String(e && e.message) };
    }
  },

  PASS: 'dudu.adminpass',
  savePass(p) { sessionStorage.setItem(this.PASS, p); },
  getPass() { return sessionStorage.getItem(this.PASS) || ''; },
  forgetPass() { sessionStorage.removeItem(this.PASS); },

  // ── 운송장 번호로 한 건 찾기 ────────────────────────────
  async find(trackingNo) {
    const no = String(trackingNo || '').replace(/\D/g, '');
    try {
      const r = await fetch('/api/track?no=' + encodeURIComponent(no));
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.row) return { row: data.row, where: '서버' };
      if (r.status === 404) return { row: null, where: '서버' };
      throw new Error(data.error || ('서버가 ' + r.status + ' 로 답했습니다'));
    } catch (e) {
      const hit = this._local().find(x => String(x.trackingNo) === no) || null;
      return { row: hit, where: '이 브라우저', offline: true };
    }
  },

  // ── 방금 접수한 건 (운송장 화면이 쓴다) ─────────────────
  last() {
    try { return JSON.parse(sessionStorage.getItem(this.LAST)) || null; }
    catch (e) { return null; }
  },

  clear() {
    [this.KEY, this.SEQ, this.LAST, this.DRAFT].forEach(k => sessionStorage.removeItem(k));
  },

  // ── 쓰다 만 접수서 ──────────────────────────────────────
  getDraft() {
    try { return JSON.parse(sessionStorage.getItem(this.DRAFT)) || {}; }
    catch (e) { return {}; }
  },
  setDraft(obj) { sessionStorage.setItem(this.DRAFT, JSON.stringify(obj || {})); },
  clearDraft() { sessionStorage.removeItem(this.DRAFT); },

  // ── 운송장 번호 ─────────────────────────────────────────
  // 규정 9 (지점코드 2자리 + 접수순번 8자리).
  // 여기서 뽑은 번호가 겹칠 수 있다. 창구끼리 서로를 모르기 때문이다.
  // 진짜로 막는 것은 표의 unique 이고, 겹치면 save() 가 알려 준다.
  nextTrackingNo(branchCode) {
    let seq = {};
    try { seq = JSON.parse(sessionStorage.getItem(this.SEQ)) || {}; }
    catch (e) { seq = {}; }
    const issued = new Set(this._local().map(r => r.trackingNo));
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

  // 표가 번호가 겹친다고 돌려보냈을 때 다음 번호를 뽑는다
  bumpTrackingNo(branchCode) {
    let seq = {};
    try { seq = JSON.parse(sessionStorage.getItem(this.SEQ)) || {}; }
    catch (e) { seq = {}; }
    seq[branchCode] = (seq[branchCode] || 0) + 1;
    sessionStorage.setItem(this.SEQ, JSON.stringify(seq));
    return this.nextTrackingNo(branchCode);
  },
};
