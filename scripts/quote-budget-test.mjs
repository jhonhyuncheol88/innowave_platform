// 견적 로직 재현: 비품(인력 제외) + 인력비, 비품이 (예산−인력비)를 채우도록 스케일 → 총액 ≈ 예산
// Quote 수식은 src/models/Quote.ts 와 동일하게 맞춤.
const VAT = 0.1;
const amount = (it) => it.unitPrice * it.qty * (1 + (it.marginRate || 0));
function q(items) {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const marginTotal = items.reduce((s, i) => s + amount(i), 0) - subtotal;
  const vat = Math.round((subtotal + marginTotal) * VAT);
  return { items, subtotal, marginTotal, vat, total: subtotal + marginTotal + vat };
}
function scaleToBudget(items, budgetLimit) {
  const current = q(items).total;
  if (current <= 0 || budgetLimit <= 0) return items;
  const ratio = budgetLimit / current;
  let scaled = items.map((i) => ({ ...i, qty: Math.max(1, Math.floor(i.qty * ratio)) }));
  const perUnit = (i) => i.unitPrice * (1 + (i.marginRate || 0)) * (1 + VAT);
  let idx = 0;
  for (let i = 1; i < scaled.length; i++) if (perUnit(scaled[i]) < perUnit(scaled[idx])) idx = i;
  const step = perUnit(scaled[idx]);
  if (step <= 0) return scaled;
  const delta = Math.floor((budgetLimit - q(scaled).total) / step);
  scaled = scaled.map((it, i) => (i === idx ? { ...it, qty: Math.max(1, it.qty + delta) } : it));
  let bestUnder = null, minOver = null;
  for (let d = -3; d <= 3; d++) {
    const cand = scaled.map((it, i) => (i === idx ? { ...it, qty: Math.max(1, it.qty + d) } : it));
    const t = q(cand).total;
    if (t <= budgetLimit) { if (!bestUnder || t > q(bestUnder).total) bestUnder = cand; }
    else if (!minOver || t < q(minOver).total) minOver = cand;
  }
  return bestUnder ?? minOver ?? scaled;
}
function finalQuote(supplies, personnel, budget) {
  const personnelTotal = q(personnel).total;
  const supplyTarget = budget - personnelTotal;
  const scaledSupply = supplyTarget > 0 ? scaleToBudget(supplies, supplyTarget) : supplies.map((i) => ({ ...i, qty: 1 }));
  return q([...scaledSupply, ...personnel]);
}
const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

// 시나리오: 레이트카드형 비품(인력 제외) + 인력(지상철 300만 + 운영 2명)
const scenarios = [
  {
    name: '예산 2,370만원 (스크린샷 유형)', budget: 23_700_000,
    supplies: [
      { name: '세미나실', unitPrice: 1_500_000, qty: 2, marginRate: 0.1 },
      { name: '음향', unitPrice: 1_000_000, qty: 1, marginRate: 0.1 },
      { name: '케이터링', unitPrice: 20_000, qty: 100, marginRate: 0.1 },
      { name: '현수막', unitPrice: 120_000, qty: 6, marginRate: 0.1 },
      { name: '기념품', unitPrice: 20_000, qty: 100, marginRate: 0.1 },
      { name: '스케치영상', unitPrice: 1_500_000, qty: 1, marginRate: 0.1 },
      { name: '온라인생중계', unitPrice: 1_000_000, qty: 1, marginRate: 0.1 },
      { name: '여행자보험', unitPrice: 18_000, qty: 100, marginRate: 0.1 },
      { name: '버스임차', unitPrice: 867_318, qty: 1, marginRate: 0.1 },
    ],
    personnel: [
      { name: '인건비·강사(지상철)', unitPrice: 3_000_000, qty: 1, marginRate: 0 },
      { name: '인건비·강사', unitPrice: 800_000, qty: 1, marginRate: 0 },
    ],
  },
  {
    name: '예산 1억 (프로젝트1 아산 CEO)', budget: 100_000_000,
    supplies: [
      { name: '대관', unitPrice: 3_000_000, qty: 2, marginRate: 0.12 },
      { name: '무대·음향', unitPrice: 8_000_000, qty: 1, marginRate: 0.12 },
      { name: '케이터링', unitPrice: 35_000, qty: 200, marginRate: 0.1 },
      { name: '인쇄물', unitPrice: 150_000, qty: 20, marginRate: 0.1 },
      { name: '영상제작', unitPrice: 5_000_000, qty: 1, marginRate: 0.15 },
      { name: '기념품', unitPrice: 30_000, qty: 200, marginRate: 0.1 },
    ],
    personnel: [
      { name: '인건비·강사(지상철)', unitPrice: 3_000_000, qty: 1, marginRate: 0 },
      { name: '인건비·멘토', unitPrice: 1_200_000, qty: 1, marginRate: 0 },
      { name: '인건비·운영', unitPrice: 180_000, qty: 1, marginRate: 0 },
    ],
  },
  {
    name: '인력 없음 (비품만 = 예산)', budget: 50_000_000,
    supplies: [
      { name: '대관', unitPrice: 2_000_000, qty: 3, marginRate: 0.1 },
      { name: '케이터링', unitPrice: 25_000, qty: 150, marginRate: 0.1 },
      { name: '영상', unitPrice: 4_000_000, qty: 1, marginRate: 0.12 },
    ],
    personnel: [],
  },
];

let allPass = true;
for (const sc of scenarios) {
  const res = finalQuote(sc.supplies, sc.personnel, sc.budget);
  const diff = res.total - sc.budget;
  const pct = (Math.abs(diff) / sc.budget) * 100;
  const pass = diff <= 0 && pct < 3; // 예산 이하(초과 금지) + 3% 이내
  if (!pass) allPass = false;
  const personnelTotal = q(sc.personnel).total;
  console.log(`\n■ ${sc.name}`);
  console.log(`  예산            ₩${fmt(sc.budget)}`);
  console.log(`  인력비(부가세포함) ₩${fmt(personnelTotal)}`);
  console.log(`  견적 총액        ₩${fmt(res.total)}  (공급가 ${fmt(res.subtotal)} + 마진 ${fmt(res.marginTotal)} + 부가세 ${fmt(res.vat)})`);
  console.log(`  예산 대비 차이    ${diff >= 0 ? '+' : ''}${fmt(diff)}원 (${pct.toFixed(2)}%)  → ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  인력 라인: ${sc.personnel.map((p) => p.name + ' ₩' + fmt(p.unitPrice)).join(', ') || '(없음)'}`);
}
console.log(`\n=== ${allPass ? 'ALL PASS ✅ — 총액(부가세 포함) ≤ 예산, 오차 3% 이내' : 'SOME FAIL ❌'} ===`);
process.exit(allPass ? 0 : 1);
