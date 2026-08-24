// 게스트 플로우 E2E: 수동 입력(예산 6,000만원) → 비품 예산 스케일 → 인력 자동선택 → 5단계 렌더
// (문서 업로드·AI 파싱은 로그인 전용이라 게스트 E2E에서는 수동 입력으로 대체.
//  예산==견적 '정확 금액'은 quote-test.mjs 수치 검증으로 확인됨: 오차 <0.1%)
import { chromium } from 'playwright';

const BASE = 'http://localhost:5177';
const SHOT = (n) => `/private/tmp/claude-502/-Users-jeonhyuncheol-development--------------innowave-platform/48a88b1b-95ae-4034-a1d5-dd27bce4bf32/scratchpad/e2e-${n}.png`;
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

// ── 1단계: 수동 입력 (예산 6,000만원) ──
await page.goto(`${BASE}/step1`);
await page.waitForLoadState('networkidle');
await page.locator('input[placeholder*="해커톤"]').first().fill('2026 아산 스타트업 벤처포럼');
await page.locator('select').first().selectOption({ label: '포럼·컨퍼런스' });
await page.locator('input[placeholder*="300명"]').fill('150명');
await page.locator('input[placeholder*="6,000"]').fill('6,000만 원');
const kpiRows = await page.locator('input[placeholder*="지표명"]').count();
check('1단계: KPI 기본값 미리 입력', kpiRows >= 3, `${kpiRows}개 지표`);
await page.screenshot({ path: SHOT('step1') });
await page.getByRole('button', { name: /다음 단계로/ }).click();
await page.waitForURL('**/step2', { timeout: 10000 });
await page.waitForTimeout(1000);

// ── 2단계: 일차 칩 ──
const dayChips = await page.getByText(/^[0-9]일차$/).count();
check('2단계: 일차(1·2일차) 칩 표시', dayChips > 0, `${dayChips}개`);
await page.screenshot({ path: SHOT('step2') });
await page.getByRole('button', { name: /다음 단계로/ }).click();
await page.waitForURL('**/step3', { timeout: 10000 });
await page.waitForTimeout(1200);

// ── 3단계: 비품이 예산에 맞게 자동 구성 ──
const gaugeText = (await page.locator('text=/예산 한도 대비/').textContent().catch(() => '')) || '';
const pct = Number((gaugeText.match(/([0-9]+)%/) || [])[1] || 0);
check('3단계: 예산 게이지 표시', !!gaugeText, gaugeText.trim().slice(0, 40));
check('3단계: 비품 공급가가 예산 60~100% (마진·부가세 제외 기준)', pct >= 60 && pct <= 100, `${pct}%`);
await page.screenshot({ path: SHOT('step3') });
await page.getByRole('button', { name: /다음 단계로/ }).click();
await page.waitForURL('**/step4', { timeout: 10000 });
await page.waitForTimeout(1500);

// ── 4단계: 지상철 최상단 + 자동선택 ──
const jisang = await page.locator('text=지상철').count();
check('4단계: 지상철 교수 카드 노출', jisang > 0);
const fit100 = await page.locator('text=/적합도.*100/').count();
check('4단계: 적합도 100점 표시', fit100 > 0);
await page.screenshot({ path: SHOT('step4') });
await page.getByRole('button', { name: /다음 단계로/ }).click();
await page.waitForURL('**/step5', { timeout: 10000 });
await page.waitForTimeout(1500);

// ── 5단계: 최종 견적 렌더 ──
const finalQuote = await page.locator('text=/최종 견적/').count();
check('5단계: 최종 견적 렌더', finalQuote > 0, '(게스트 금액 블러 — 정확 금액은 quote-test.mjs로 검증)');
await page.screenshot({ path: SHOT('step5'), fullPage: true });

await browser.close();
const fails = results.filter((r) => !r.ok);
console.log(`\n=== ${fails.length === 0 ? 'E2E ALL PASS ✅' : `E2E ${fails.length}/${results.length} FAIL ❌`} ===`);
process.exit(fails.length === 0 ? 0 : 1);
