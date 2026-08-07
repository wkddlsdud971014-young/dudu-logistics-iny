// 두두택배 - 계산 정본 (02_접수규정.md §1-9)
// 네 화면(접수・완료・목록・조회)이 이 파일 하나를 같이 쓴다. 요금표・지역표・
// 등급 판정・금지품목이 여기 한 군데에만 있어야 화면끼리 어긋나지 않는다.
// 화면(DOM)을 건드리는 코드는 이 파일에 넣지 않는다.

// ============================================================
  // 계산 정본 - 02_접수규정.md §1-9를 그대로 옮겼다. 이 블록만 떼어
  // setup.sql 샘플 5건과 대조하면 규정과 일치하는지 검산할 수 있다.
  // ============================================================
  // 규정 §1 - 여섯 지점. 소재지·허브까지 담아 화면이 스스로 안내하게 한다.
  const BRANCHES = [
    { code: '11', name: '서울지점', at: '서울',      hub: '수도권HUB' },
    { code: '12', name: '용산지점', at: '서울 용산',  hub: '수도권HUB' },
    { code: '21', name: '대전지점', at: '대전',      hub: '중부HUB' },
    { code: '31', name: '진주지점', at: '경남 진주',  hub: '영남HUB' },
    { code: '32', name: '거제지점', at: '경남 거제',  hub: '영남HUB' },
    { code: '41', name: '울산지점', at: '울산',      hub: '영남HUB' },
  ];

  const RATE_TABLE = [
    { grade: '극소형', maxSum: 60,  maxWeight: 2,  price: { 일반: 3500, 제주: 6500,  도서산간: 8500 } },
    { grade: '소형',   maxSum: 80,  maxWeight: 5,  price: { 일반: 4000, 제주: 7000,  도서산간: 9000 } },
    { grade: '중형',   maxSum: 120, maxWeight: 15, price: { 일반: 6000, 제주: 9000,  도서산간: 11000 } },
    { grade: '대형',   maxSum: 160, maxWeight: 25, price: { 일반: 9000, 제주: 12000, 도서산간: 14000 } },
  ];
  const ETA_BUSINESS_DAYS = { 일반: 1, 제주: 2, 도서산간: 3 };

  // 규정 §2 - 제주 전역만 '제주', 지정된 5개 도서만 '도서산간', 나머지는
  // 전부 '일반'이다. 거제・진주는 다리・도로로 연결된 일반 지역이라
  // (§2 "주의: 거제, 진주는 일반 지역입니다" 그대로) 이 두 판정 목록
  // 어디에도 없다 - 기본값 '일반'로 자연히 떨어지는 것 자체가 그 규정을
  // 지키는 방식이다. '원거리'・'도서' 같은 규정에 없는 이름은 이 파일
  // 어디서도 쓰지 않는다.
  // 260807 도착 지역 정본 목록. 자유 입력을 없애고 이 표에서만 고르게 한다.
  // 정책서 receiver_area 예외1(표기 갈림 245칸)·예외2(지역 칸에 권역 이름
  // 혼입 19건)을 화면에서 원천 봉쇄하는 자리다 - 목록에 없는 값은 애초에
  // 들어갈 수 없으므로 '제주도'・'재주'・'SEOUL' 같은 변형이 생기지 않는다.
  // 거제・진주는 시・도 단위라 '경남'에 들어가고, 경남이 일반이므로 규정 §2
  // "주의: 거제, 진주는 일반 지역입니다"가 목록 구조만으로 지켜진다.
  const AREA_LIST = [
    { area: '서울', region: '일반' }, { area: '부산', region: '일반' },
    { area: '대구', region: '일반' }, { area: '인천', region: '일반' },
    { area: '광주', region: '일반' }, { area: '대전', region: '일반' },
    { area: '울산', region: '일반' }, { area: '세종', region: '일반' },
    { area: '경기', region: '일반' }, { area: '강원', region: '일반' },
    { area: '충북', region: '일반' }, { area: '충남', region: '일반' },
    { area: '전북', region: '일반' }, { area: '전남', region: '일반' },
    { area: '경북', region: '일반' }, { area: '경남', region: '일반' },
    { area: '제주', region: '제주' },
    { area: '울릉도', region: '도서산간' }, { area: '백령도', region: '도서산간' },
    { area: '흑산도', region: '도서산간' }, { area: '거문도', region: '도서산간' },
    { area: '추자도', region: '도서산간' },
  ];
  const AREA_REGION = new Map(AREA_LIST.map(a => [a.area, a.region]));

  // 등록 안 된 지점이면 null을 돌려준다. 고치기 전에는 '00'을 내보내서
  // 0000000001 같은 운송장이 발급됐다 - 규정 §9는 앞 2자리가 접수 지점
  // 코드여야 한다고 못 박고 있으므로 '00'은 유효한 번호가 아니다.
  function branchCodeOf(name) {
    const hit = BRANCHES.find(b => b.name === name);
    return hit ? hit.code : null;
  }
  // 모르는 지역은 '일반'으로 떨어뜨리지 않고 null을 돌려준다. 고치기 전에는
  // 목록에 없는 값이 전부 조용히 일반 요금으로 나갔다 - '제주도' 3,500원,
  // '재주'(오타) 3,500원. 제주는 6,500원이라 한 건에 3,000원씩 덜 받으면서
  // 덜 받는 줄도 몰랐다. 조용히 틀리느니 계산을 멈추는 쪽이 낫다.
  function determineRegion(area) {
    return AREA_REGION.has(area) ? AREA_REGION.get(area) : null;
  }

  // "하나라도 넘으면 다음 등급"(§3) - 순서대로 검사해 처음 맞는 등급을
  // 쓴다. 넷 다 불합격이면 null(= 접수 불가, §3 "대형을 넘으면 접수
  // 불가").
  function determineGrade(sumCm, billedWeightKg) {
    for (const tier of RATE_TABLE) {
      if (sumCm <= tier.maxSum && billedWeightKg <= tier.maxWeight) return tier.grade;
    }
    return null;
  }
  function gradeTrace(sumCm, billedWeightKg) {
    let matched = null;
    const lines = RATE_TABLE.map(tier => {
      const sumOk = sumCm <= tier.maxSum;
      const wtOk = billedWeightKg <= tier.maxWeight;
      const pass = sumOk && wtOk && !matched;
      if (pass) matched = tier.grade;
      return Object.assign({}, tier, { sumOk, wtOk, pass });
    });
    return { lines, matched };
  }

  function addBusinessDaysTrace(fromDate, days) {
    const d = new Date(fromDate);
    let added = 0;
    const trace = [];
    while (added < days) {
      d.setDate(d.getDate() + 1);
      const dow = d.getDay();
      const isWeekend = (dow === 0 || dow === 6);
      if (!isWeekend) added++;
      trace.push({ date: new Date(d), dow, isWeekend, countedAt: isWeekend ? null : added });
    }
    return { finalDate: new Date(d), trace };
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function formatDateISO(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
  const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

  // 규정 §5 7개 분류 21개 키워드를 부분 문자열 일치(포함 여부)로 검사한다.
  // "시계"만 "50만원 초과" 조건이 있는데 이 화면엔 물품 가액 입력 칸이
  // 없다(오늘 6대 필수 입력에 가격이 없다 - PRD 7절 미해결 1번과 같은
  // 공백). 가액을 모르는 채로 그냥 통과시키면 §5 마지막 줄 "애매하면
  // 확인 불가로 답하고 사람에게 넘깁니다"를 어기게 되므로, 시계는 자동
  // 통과가 아니라 직원 확인 체크박스를 요구하는 소프트 차단으로 나머지
  // 하드 차단 목록과 분리했다.
  // 260807 오차단을 고쳤다. 전에는 22개 낱말을 전부 하드 차단해서
  // '냉장고'가 "냉장"에, '동물인형'이 "동물"에, '은박지'가 "은"에 걸려
  // 접수가 막혔다. 규정 §5 원문은 "냉장・냉동이 필요한 식품", "살아있는
  // 동물", "살아있는 식물"이라 가전・인형・조화는 접수 가능한 물건이다.
  // 그래서 두 갈래로 나눴다 -
  //   하드: 낱말 자체가 금지 품목을 특정하는 것 (계산 전에 거절)
  //   소프트: 규정에 조건이 붙어 있거나, 낱말만으로는 금지품인지 알 수
  //           없는 것. §5 마지막 줄 "애매하면 확인 불가로 답하고 사람에게
  //           넘깁니다"에 따라 자동 통과도 자동 차단도 하지 않고 직원
  //           확인을 받는다.
  const BANNED_RULES = [
    // --- 하드 차단 ---
    { category: '금전',   keyword: '현금' },
    { category: '금전',   keyword: '상품권' },
    { category: '금전',   keyword: '유가증권' },
    { category: '귀중품', keyword: '보석' },
    { category: '인화성', keyword: '라이터' },
    { category: '인화성', keyword: '부탄가스' },
    { category: '인화성', keyword: '페인트' },
    { category: '인화성', keyword: '신나' },
    { category: '인화성', keyword: '알코올 스프레이' },
    { category: '배터리', keyword: '보조배터리' },
    { category: '배터리', keyword: '리튬배터리' },
    { category: '기타',   keyword: '주류' },
    { category: '기타',   keyword: '의약품' },
    { category: '기타',   keyword: '총포' },
    { category: '기타',   keyword: '도검' },
    // --- 소프트 확인 (직원이 보고 판단) ---
    { category: '귀중품', keyword: '시계',   ask: '50만원을 넘지 않는지' },
    { category: '귀중품', keyword: '금',     ask: '귀금속 금이 아닌지 (예: 황금향・금붕어는 접수 가능)' },
    { category: '귀중품', keyword: '은',     ask: '귀금속 은이 아닌지 (예: 은박지・은행은 접수 가능)' },
    { category: '인화성', keyword: '알코올', ask: '스프레이 형태가 아닌지' },
    { category: '생물',   keyword: '동물',   ask: '살아있는 동물이 아닌지 (예: 동물인형은 접수 가능)' },
    { category: '생물',   keyword: '식물',   ask: '살아있는 식물이 아닌지 (예: 조화는 접수 가능)' },
    { category: '온도',   keyword: '냉장',   ask: '냉장이 필요한 식품이 아닌지 (예: 냉장고는 접수 가능)' },
    { category: '온도',   keyword: '냉동',   ask: '냉동이 필요한 식품이 아닌지' },
  ];
  function checkBanned(name) {
    const s = (name || '').trim();
    if (!s) return { hardHits: [], softHits: [] };
    const hits = BANNED_RULES.filter(r => s.includes(r.keyword));
    const hardHits = hits.filter(h => !h.ask);
    // 하드에 걸렸으면 소프트 확인은 의미가 없다 ('현금'은 '금'도 물고
    // 들어오고, '알코올 스프레이'는 '알코올'도 문다).
    return { hardHits, softHits: hardHits.length ? [] : hits.filter(h => h.ask) };
  }

  // 운송장 번호 발급은 store.js 로 옮겼다 - 페이지가 나뉘면서
  // 순번을 화면 밖(sessionStorage)에 둬야 이어지기 때문이다.

  function formatWon(n) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return n.toLocaleString('ko-KR') + '원';
  }

  // ============================================================
  // 260807 전화번호 · 입력 범위
  // 정책서 receiver_phone 예외1(하이픈 누락 345건)·예외2(빈칸 265건),
  // 무게·치수 예외2(이상값 104건)를 화면에서 막기 위한 정본.
  // result.md 검산에서 전화번호가 79.3%로 제일 낮았던 칸이다 -
  // "형식 복원은 안전한 수정이었는데 보류했더니 그대로 감점됐다".
  // ============================================================

  // 숫자만 남기고 010-1234-5678 모양으로 맞춘다. 서울 02는 자릿수가 달라
  // 따로 센다. 사람이 하이픈을 치지 않아도 화면이 넣어 준다.
  function formatPhone(raw) {
    const d = String(raw || '').replace(/\D/g, '').slice(0, 11);
    if (d.startsWith('02')) {
      if (d.length <= 2) return d;
      if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
      if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
      return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
    }
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  }
  function phoneDigits(raw) { return String(raw || '').replace(/\D/g, ''); }
  // 자릿수 검사. 휴대전화는 11자리, 지역번호는 10자리, 서울(02) 옛 국번은
  // 9자리도 실재한다(02-123-4567). 그 밖이면 저장하지 않는다.
  function isValidPhone(raw) {
    const d = phoneDigits(raw);
    if (d.startsWith('02')) return d.length === 9 || d.length === 10;
    return d.length === 10 || d.length === 11;
  }

  // 무게·치수 상한. 상한이 없으면 '9999cm' 같은 자릿수 오타가 그대로 들어간다
  // (result.md: height_cm 에 3700 = 37의 자릿수 오타가 실재했다).
  const LIMITS = {
    weightKg: { min: 0.1, max: 100, label: '실제 무게', unit: 'kg' },
    widthCm:  { min: 1,   max: 300, label: '가로',      unit: 'cm' },
    heightCm: { min: 1,   max: 300, label: '세로',      unit: 'cm' },
    depthCm:  { min: 1,   max: 300, label: '높이',      unit: 'cm' },
  };
  // 값 하나를 재서 { n, err } 로 돌려준다. 범위를 벗어나면 n 은 null 이다.
  function checkNumber(key, raw) {
    const L = LIMITS[key];
    const s = String(raw ?? '').trim();
    if (s === '') return { n: null, err: `${L.label}: 입력해 주세요.` };
    const n = Number(s);
    if (!isFinite(n)) return { n: null, err: `${L.label}: 숫자만 입력합니다.` };
    if (n < L.min || n > L.max) {
      return { n: null, err: `${L.label}: ${L.min}~${L.max}${L.unit}만 접수합니다 (입력값 ${s}${L.unit})` };
    }
    return { n, err: null };
  }

  // ============================================================
  // 260807 빈 값·없는 값을 그대로 품는 표시 규칙
  // 정책서의 원본 보존 원칙과 같은 자리다 - 값이 비었다고 0으로 채우거나
  // 지어내지 않는다. 화면은 "없다"는 것을 "없다"고 보여주고 멈추지 않는다.
  // (DB에서 읽어 온 옛 기록에는 전화·부피무게처럼 비어 있는 칸이 실제로
  //  있다. null 을 그냥 이어 붙이면 "nullkg" 같은 글자가 손님에게 보인다.)
  // ============================================================
  function show(v, suffix) {
    if (v === null || v === undefined) return '-';
    if (typeof v === 'number' && !isFinite(v)) return '-';
    const s = String(v).trim();
    if (s === '') return '-';
    return s + (suffix || '');
  }

  // ============================================================
  // 260807 지역 찾기
  // "목록에 없어요 → 상담원 연결"은 실제 서비스에서 쓸 문구가 아니다.
  // 손님은 '화성시'로 보내는데 목록엔 '경기'만 있으니 못 찾는 것뿐이다.
  // 그래서 시·군·구 이름으로도 찾아지게 별칭을 붙였다. 화면이 사람을
  // 부르는 대신 스스로 안내한다.
  // ============================================================
  const AREA_SEARCH = {
    '서울': ['서울특별시', '서울시', 'seoul', '강남', '강북', '종로', '마포', '송파', '영등포', '용산', '노원'],
    '부산': ['부산광역시', '부산시', 'busan', '해운대', '사상', '기장', '동래', '남포'],
    '대구': ['대구광역시', '대구시', 'daegu', '수성', '달서', '달성'],
    '인천': ['인천광역시', '인천시', 'incheon', '부평', '송도', '강화', '연수', '검단'],
    '광주': ['광주광역시', '광주시', 'gwangju', '광산', '북구'],
    '대전': ['대전광역시', '대전시', 'daejeon', '유성', '둔산', '대덕'],
    '울산': ['울산광역시', '울산시', 'ulsan', '남구', '온산', '언양'],
    '세종': ['세종특별자치시', '세종시', 'sejong', '조치원'],
    '경기': ['경기도', 'gyeonggi', '수원', '성남', '화성', '용인', '고양', '부천', '안산', '안양',
             '평택', '시흥', '김포', '광명', '군포', '하남', '오산', '이천', '양주', '구리', '파주', '남양주', '의정부'],
    '강원': ['강원도', '강원특별자치도', 'gangwon', '춘천', '원주', '강릉', '속초', '동해', '삼척', '평창', '홍천'],
    '충북': ['충청북도', '충북도', 'chungbuk', '청주', '충주', '제천', '음성', '진천', '옥천'],
    '충남': ['충청남도', '충남도', 'chungnam', '천안', '아산', '서산', '당진', '공주', '보령', '논산', '홍성'],
    '전북': ['전라북도', '전북특별자치도', 'jeonbuk', '전주', '익산', '군산', '정읍', '남원', '김제'],
    '전남': ['전라남도', 'jeonnam', '여수', '순천', '목포', '광양', '나주', '담양', '해남', '완도', '진도'],
    '경북': ['경상북도', 'gyeongbuk', '포항', '구미', '경주', '안동', '경산', '김천', '영주', '상주'],
    '경남': ['경상남도', 'gyeongnam', '창원', '김해', '진주', '거제', '양산', '통영', '사천', '밀양', '마산', '진해'],
    '제주': ['제주도', '제주특별자치도', '제주시', 'jeju', '서귀포', '서귀포시', '한림', '성산', '애월', '표선'],
    '울릉도': ['울릉', '울릉군', '독도', '저동', '도동'],
    '백령도': ['백령', '백령면', '대청도', '소청도'],
    '흑산도': ['흑산', '흑산면', '홍도'],
    '거문도': ['거문', '거문리', '삼산면'],
    '추자도': ['추자', '추자면', '상추자', '하추자'],
  };
  // 띄어쓰기·대소문자를 지우고 견준다. 빈 검색어면 전부 보여 준다.
  function searchAreas(q) {
    const k = String(q || '').replace(/\s/g, '').toLowerCase();
    if (!k) return AREA_LIST.map(a => a.area);
    return AREA_LIST.filter(a =>
      a.area.includes(k) ||
      a.region.replace(/\s/g, '').includes(k) ||
      (AREA_SEARCH[a.area] || []).some(w => w.toLowerCase().includes(k))
    ).map(a => a.area);
  }
  // 무게처럼 소수 한 자리로 보여 주는 것이 자연스러운 값. 3 → 3.0
  function toOneDecimal(raw) {
    const s = String(raw ?? '').trim();
    if (s === '') return '';
    const n = Number(s);
    return isFinite(n) ? n.toFixed(1) : s;
  }
