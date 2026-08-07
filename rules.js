// 두두택배 - 접수 규정 보기 창
// =================================================
// 손님이 규정을 못 보는 채로 요금만 받아 들면 억울하다. 그래서 어느 화면에서든
// 규정 전문을 열어 볼 수 있게 했다.
//
// 규정 표를 손으로 다시 적지 않는다. calc.js 의 요금표·지역표·금지품목을
// 그대로 그린다 - 화면과 규정이 어긋날 자리를 아예 만들지 않기 위해서다.
// 요금표를 고치면 이 창도 저절로 따라 바뀐다.
//
// 접수한 건을 넘겨주면(Rules.open(내역)) 그 건에 해당하는 칸에 노란 표시를
// 해서 "내 요금이 어디서 나왔는지"를 짚어 준다.

const Rules = {
  built: false,

  // 어려운 말을 쉬운 말로. '1영업일' 대신 '다음 날 (토·일 빼고)'
  dayWords(days) {
    return ({ 1: '다음 날', 2: '이틀 뒤', 3: '사흘 뒤' })[days] || (days + '일 뒤');
  },

  build() {
    if (this.built) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.id = 'rulesModal';
    wrap.innerHTML =
      '<div class="modal" role="dialog" aria-label="접수 규정">' +
        '<div class="modal-head">' +
          '<div><div class="modal-title">두두택배 접수 규정</div>' +
          '<div class="modal-sub">요금과 도착일이 어떻게 정해지는지 전부 적어 두었습니다</div></div>' +
          '<button type="button" class="modal-x" aria-label="닫기">✕</button>' +
        '</div>' +
        '<div class="modal-body" id="rulesBody"></div>' +
        '<div class="modal-foot"><button type="button" class="btn-main modal-close">확인</button></div>' +
      '</div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', e => {
      if (e.target === wrap || e.target.closest('.modal-x, .modal-close')) this.close();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });
    this.built = true;
  },

  // rec: 접수 내역 (없으면 그냥 규정만 보여 준다)
  open(rec) {
    this.build();
    document.getElementById('rulesBody').innerHTML = this.render(rec || null);
    document.getElementById('rulesModal').classList.add('on');
    document.body.style.overflow = 'hidden';
  },
  close() {
    const m = document.getElementById('rulesModal');
    if (m) m.classList.remove('on');
    document.body.style.overflow = '';
  },

  sec(no, title, body, note) {
    return '<section class="rsec"><h3><span class="rno">' + no + '</span>' + title + '</h3>' +
      body + (note ? '<p class="rnote">' + note + '</p>' : '') + '</section>';
  },

  render(rec) {
    const hit = rec || {};
    const on = (cond) => cond ? ' class="hl"' : '';
    let out = '';

    if (rec) {
      out += '<div class="rmine">' +
        '<div class="rmine-t">이 접수 건에 쓰인 규정을 <b>노란색</b>으로 표시했습니다</div>' +
        '<div class="rmine-s">' + [rec.branchName, rec.receiverArea, rec.sizeGrade, rec.regionType]
          .filter(Boolean).join(' · ') + '</div></div>';
    }

    // 1 지점
    out += this.sec(1, '접수 지점',
      '<table class="rtab"><tr><th>지점</th><th>소재지</th><th>허브</th><th>운송장 앞자리</th></tr>' +
      BRANCHES.map(b => '<tr' + on(hit.branchName === b.name) + '><td>' + b.name + '</td><td>' + b.at +
        '</td><td>' + b.hub + '</td><td>' + b.code + '</td></tr>').join('') + '</table>',
      '여섯 지점에서 접수하고, 배송은 전국으로 나갑니다.');

    // 2 권역
    const byRegion = { '일반': [], '제주': [], '도서산간': [] };
    AREA_LIST.forEach(a => byRegion[a.region].push(a.area));
    out += this.sec(2, '배송 권역',
      '<table class="rtab"><tr><th>권역</th><th>해당 지역</th></tr>' +
      Object.keys(byRegion).map(r => '<tr' + on(hit.regionType === r) + '><td><b>' + r +
        '</b></td><td>' + (r === '일반' ? '제주와 섬을 뺀 전국' : byRegion[r].join(', ')) +
        '</td></tr>').join('') + '</table>',
      '거제와 진주는 다리·도로로 이어져 있어 섬이 아니라 <b>일반</b> 지역입니다.');

    // 3 요금표
    out += this.sec(3, '요금표',
      '<table class="rtab"><tr><th>크기</th><th>세 변의 합</th><th>무게</th>' +
      '<th>일반</th><th>제주</th><th>도서산간</th></tr>' +
      RATE_TABLE.map(t => {
        const gh = hit.sizeGrade === t.grade;
        const cell = r => '<td' + (gh && hit.regionType === r ? ' class="hl2"' : '') + '>' +
          t.price[r].toLocaleString('ko-KR') + '원</td>';
        return '<tr' + on(gh) + '><td><b>' + t.grade + '</b></td><td>' + t.maxSum +
          'cm 이하</td><td>' + t.maxWeight + 'kg 이하</td>' +
          cell('일반') + cell('제주') + cell('도서산간') + '</tr>';
      }).join('') + '</table>',
      '세 변의 합은 <b>가로＋세로＋높이</b>입니다. 크기와 무게 중 <b>하나라도 넘으면 한 단계 위 요금</b>을 받습니다. ' +
      '대형까지도 넘으면 접수할 수 없습니다.');

    // 4 요금 무게
    out += this.sec(4, '요금에 쓰는 무게',
      '<div class="rbox">저울에 올린 무게와 <b>부피 무게</b> 중 <b>더 큰 값</b>으로 요금을 매깁니다.<br><br>' +
      '부피 무게 = 가로 × 세로 × 높이 ÷ 6000</div>',
      '가볍지만 부피가 큰 물건이 비싼 이유입니다. 이불처럼요.');

    // 5 금지 품목
    const cats = {};
    BANNED_RULES.forEach(r => (cats[r.category] = cats[r.category] || []).push(r));
    out += this.sec(5, '보낼 수 없는 물건',
      '<table class="rtab"><tr><th>분류</th><th>품목</th></tr>' +
      Object.keys(cats).map(c => '<tr><td><b>' + c + '</b></td><td>' +
        cats[c].map(r => r.ask ? r.keyword + ' <span class="rask">(직원 확인)</span>' : r.keyword).join(', ') +
        '</td></tr>').join('') + '</table>',
      '목록에 없는 물건은 보낼 수 있습니다. <b>직원 확인</b>이 붙은 것은 물건에 따라 달라서, ' +
      '직원이 보고 정합니다. (예: <b>냉장고</b>는 보낼 수 있지만 <b>냉장이 필요한 식품</b>은 안 됩니다.)');

    // 6 도착일
    out += this.sec(6, '언제 도착하나요',
      '<table class="rtab"><tr><th>권역</th><th>도착</th></tr>' +
      Object.keys(ETA_BUSINESS_DAYS).map(r => '<tr' + on(hit.regionType === r) + '><td><b>' + r +
        '</b></td><td>접수한 <b>' + this.dayWords(ETA_BUSINESS_DAYS[r]) + '</b></td></tr>').join('') +
      '</table>',
      '<b>토요일·일요일은 날짜에 넣지 않습니다.</b> 금요일에 접수하시면 다음 날은 월요일이 됩니다.');

    // 7 받는 정보
    out += this.sec(7, '접수할 때 여쭤보는 것',
      '<div class="rbox">보내는 분 이름 · 받는 분 이름 · 받는 분 전화 · 도착 지역 · ' +
      '물품명 · 무게 · 가로세로높이</div>',
      '이만큼이면 요금과 도착일이 정해집니다.');

    // 8 계산 순서
    out += this.sec(8, '요금을 정하는 순서',
      '<ol class="rlist">' +
      '<li>보낼 수 없는 물건인지 먼저 봅니다. 해당하면 여기서 멈춥니다</li>' +
      '<li>부피 무게를 셉니다 (가로 × 세로 × 높이 ÷ 6000)</li>' +
      '<li>저울 무게와 부피 무게 중 <b>큰 값</b>을 고릅니다</li>' +
      '<li>세 변의 합과 그 무게로 크기를 정합니다 (하나라도 넘으면 한 단계 위)</li>' +
      '<li>대형까지 넘으면 접수할 수 없습니다</li>' +
      '<li>도착 지역으로 권역을 정하고, 요금표에서 금액을 찾습니다</li>' +
      '<li>권역에 따라 도착일을 셉니다 (주말 제외)</li></ol>');

    // 9 운송장
    out += this.sec(9, '운송장 번호',
      '<div class="rbox">숫자 <b>10자리</b>입니다. 앞 <b>2자리</b>는 접수한 지점, 뒤 <b>8자리</b>는 순번입니다.' +
      (rec && rec.trackingNo
        ? '<br><br><span class="rtno">' + rec.trackingNo.slice(0, 2) + '</span>' +
          '<span class="rtno2">' + rec.trackingNo.slice(2) + '</span><br>' +
          '<span class="rnote2">' + rec.trackingNo.slice(0, 2) + ' = ' + (rec.branchName || '') +
          ' · 뒤 8자리 = 접수 순번</span>'
        : '') + '</div>',
      '번호는 <b>겹치지 않습니다.</b> 겹치면 두 물건이 같은 번호로 조회되어 어느 쪽이 어디 있는지 알 수 없게 됩니다.');

    return out;
  },
};
