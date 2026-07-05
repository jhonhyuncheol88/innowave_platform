import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CARD_SHADOW, GROTESK, Loading, Logo, Notice, RequireAuth } from '../components.js';
import { PR_STAFF_DEFAULT } from '../data.js';
import {
  buildOptionQuote, buildQuoteItems, errMessage, tsLabel, useEvent, usePrograms, useQuoteParams, useRateCards, wonLabel,
} from '../hooks.js';
import { downloadElementAsPdf } from '../pdf.js';
import { fmt, selectionSummary, useIw } from '../state.js';
import type { QuoteOptionValue } from '../../../models/Quote.js';

const PLAN_NAMES = { basic: 'Basic', standard: 'Standard', premium: 'Premium' } as const;

function durText(dur: number): string {
  return (dur >= 60 ? `${Math.floor(dur / 60)}시간 ` : '') + (dur % 60 ? `${dur % 60}분` : '');
}

/** '2026-09-12' → '2026. 9. 12.' */
function dateLabel(iso: string | null | undefined): string {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${y}. ${m}. ${d}.`;
}

function ProposalBody() {
  const { s } = useIw();
  const [searchParams] = useSearchParams();
  // 공유 링크(?event=...)로 열리면 그 프로젝트를, 아니면 현재 작업 중인 프로젝트를 보여준다
  const eventId = searchParams.get('event') ?? s.currentEventId;

  const { event } = useEvent(eventId);
  const { cards, loading: cardsLoading } = useRateCards();
  const { params } = useQuoteParams();
  const { programs: savedPrograms } = usePrograms(eventId);
  const docRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const items = useMemo(() => buildQuoteItems(cards, event), [cards, event]);
  const mult = s.plan === 'basic' ? params.multBasic : s.plan === 'premium' ? params.multPremium : 1.0;
  const quote = useMemo(
    () => buildOptionQuote(items, s.plan as QuoteOptionValue, mult, s.budget * 10000),
    [items, s.plan, mult, s.budget],
  );

  const selSummary = selectionSummary(s.selected);
  const staff = selSummary.length > 0
    ? selSummary.map((x) => [x.role, x.count] as [string, number])
    : PR_STAFF_DEFAULT;

  // 저장된 프로그램(서브컬렉션)이 있으면 우선, 없으면 로컬 구성 표시
  const programRows = savedPrograms.length > 0
    ? savedPrograms.map((p) => ({ time: p.startTime, name: p.title, dur: p.durationMin }))
    : s.programs.map((p) => ({ time: p.time, name: p.name, dur: p.dur }));

  const b = event?.basicInfo;
  const title = b?.name ?? '2026 청년 창업 해커톤';
  const organizer = b?.organizer || '창업진흥원';
  const period = b ? `${dateLabel(b.periodStart)} – ${dateLabel(b.periodEnd)}` : '2026. 9. 12. – 13.';
  const place = b ? `${b.region || '-'} · ${b.operationType || '-'}` : '서울 · 오프라인';
  const scaleLabel = b ? `${(b.participantScale || 0).toLocaleString('ko-KR')}` : '300';
  const budgetText = b ? wonLabel(b.budgetLimit) : '6,000만 원';
  const sharedDate = event ? tsLabel(event.updatedAt) : '-';

  const copyLink = () => {
    if (!eventId) return;
    const url = `${window.location.origin}/proposal?event=${eventId}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    });
  };

  const downloadPdf = async () => {
    if (!docRef.current || pdfBusy) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      await downloadElementAsPdf(docRef.current, `견적서_${title.replace(/[\\/:*?"<>|\s]+/g, '_')}.pdf`);
    } catch (e) {
      setPdfError(errMessage(e));
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <>
      {/* 상단 바 */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(112,115,124,0.22)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', padding: '14px clamp(16px,5vw,32px)', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <Logo dark size={17} />
          <span style={{ background: '#E5F0FF', color: '#0D3B8F', borderRadius: '999px', padding: '5px 14px', fontSize: '12px', fontWeight: 700 }}>발주처 공유 문서 · 조회 전용</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12.5px', color: '#9AA3B8' }}>공유일 <span style={{ fontFamily: GROTESK }}>{sharedDate}</span></span>
            {eventId && (
              <button onClick={copyLink} className="iw-btn-outline-navy" style={{ background: 'transparent', color: '#0D3B8F', border: '1px solid rgba(13,59,143,0.25)', borderRadius: '999px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                {copied ? '링크 복사됨 ✓' : '공유 링크 복사'}
              </button>
            )}
            <button onClick={() => void downloadPdf()} disabled={pdfBusy} className="iw-btn-primary" style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: pdfBusy ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '7px', opacity: pdfBusy ? 0.7 : 1 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              {pdfBusy ? 'PDF 생성 중…' : '견적서 PDF 다운로드'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '32px clamp(16px,5vw,32px) 0' }}>
        {pdfError && <Notice tone="error">{pdfError}</Notice>}

        {/* PDF로 내보내는 문서 영역 — 캡처 시 카드가 콘텐츠 박스 가장자리에 붙지 않게 안쪽 여백 유지 */}
        <div ref={docRef} style={{ background: '#F6F9FF', padding: '14px 12px' }}>

          {/* 문서 헤더 */}
          <div style={{ background: '#071A3E', borderRadius: '20px', padding: '36px', marginBottom: '20px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#4FD8EB', letterSpacing: '0.08em', marginBottom: '10px' }}>통합 기획안 · 견적서</div>
            <h1 style={{ margin: '0 0 6px', color: '#FFFFFF', fontSize: 'clamp(24px,3vw,32px)', fontWeight: 800, letterSpacing: '-0.01em' }}>{title}</h1>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '14px' }}>주관 {organizer} · 수행 (주)이노웨이브 파트너스</div>
            <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', marginTop: '24px' }}>
              <div><div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '3px' }}>기간</div><div style={{ fontSize: '14.5px', fontWeight: 700, color: '#FFFFFF', fontFamily: GROTESK }}>{period}</div></div>
              <div><div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '3px' }}>장소</div><div style={{ fontSize: '14.5px', fontWeight: 700, color: '#FFFFFF' }}>{place}</div></div>
              <div><div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '3px' }}>참가 규모</div><div style={{ fontSize: '14.5px', fontWeight: 700, color: '#FFFFFF' }}><span style={{ fontFamily: GROTESK }}>{scaleLabel}</span>명</div></div>
              <div><div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '3px' }}>예산 한도</div><div style={{ fontSize: '14.5px', fontWeight: 700, color: '#4FD8EB' }}>{budgetText}</div></div>
            </div>
          </div>

          {/* 행사 개요 */}
          <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '30px clamp(16px,5vw,32px)', marginBottom: '20px' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '17px', fontWeight: 800, color: '#071A3E' }}>행사 개요</h2>
            <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.7, color: '#3A4358', textWrap: 'pretty' }}>
              {b?.purpose || '청년 예비 창업가의 아이디어 발굴과 초기 팀 빌딩을 지원하고, 우수 팀에 후속 사업화 기회를 연계하는 행사입니다.'} 본 기획안은 과업지시서 요구사항과 표준 레이트카드 항목을 기준으로 산출되었습니다.
            </p>
          </div>

          {/* 프로그램 구성 */}
          <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '30px clamp(16px,5vw,32px)', marginBottom: '20px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: 800, color: '#071A3E' }}>
              프로그램 구성 <span style={{ fontSize: '13px', fontWeight: 600, color: '#9AA3B8' }}>1일차 기준</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {programRows.map((pg, i) => (
                <div key={`${pg.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '11px 0', borderBottom: '1px solid rgba(112,115,124,0.12)' }}>
                  <span style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: '14px', color: '#0D3B8F', width: '52px', flexShrink: 0 }}>{pg.time}</span>
                  <span style={{ flex: 1, fontSize: '14.5px', fontWeight: 600, color: '#071A3E' }}>{pg.name}</span>
                  <span style={{ fontSize: '13px', color: '#5A6478', flexShrink: 0 }}>{durText(pg.dur)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 투입 인력 */}
          <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '30px clamp(16px,5vw,32px)', marginBottom: '20px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: 800, color: '#071A3E' }}>투입 인력</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,150px),1fr))', gap: '14px' }}>
              {staff.map(([role, count]) => (
                <div key={role} style={{ background: '#F7FAFF', border: '1px solid rgba(112,115,124,0.14)', borderRadius: '14px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '26px', color: '#1463F3' }}>{count}<span style={{ fontSize: '0.55em', color: '#5A6478' }}>명</span></div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#3A4358', marginTop: '2px' }}>{role}</div>
                </div>
              ))}
            </div>
            <p style={{ margin: '14px 0 0', fontSize: '12.5px', color: '#9AA3B8' }}>전원 INNOWAVE 인력풀 검증 완료 · 상세 프로필은 담당 PM에게 요청해 주세요.</p>
          </div>

          {/* 견적 요약 */}
          <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '30px clamp(16px,5vw,32px)', marginBottom: '20px' }}>
            {cardsLoading ? (
              <Loading label="견적을 계산하는 중…" />
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#071A3E', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    견적 요약 <span style={{ background: '#E5F0FF', color: '#1463F3', borderRadius: '999px', padding: '3px 12px', fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>{PLAN_NAMES[s.plan]} 옵션</span>
                  </h2>
                  <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '30px', letterSpacing: '-0.02em', color: '#1463F3' }}>₩{fmt(quote.total)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', borderTop: '1px solid rgba(112,115,124,0.22)', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5A6478' }}>공급가</span><span style={{ fontFamily: GROTESK, fontWeight: 600, color: '#3A4358' }}>₩{fmt(quote.subtotal)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5A6478' }}>마진</span><span style={{ fontFamily: GROTESK, fontWeight: 600, color: '#3A4358' }}>₩{fmt(quote.marginTotal)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5A6478' }}>부가세 (10%)</span><span style={{ fontFamily: GROTESK, fontWeight: 600, color: '#3A4358' }}>₩{fmt(quote.vat)}</span></div>
                </div>

                {/* 항목별 상세 — 견적서 PDF에 포함 */}
                <div style={{ marginTop: '18px', borderTop: '1px solid rgba(112,115,124,0.22)', paddingTop: '14px' }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#071A3E', marginBottom: '8px' }}>항목별 내역</div>
                  {quote.items.map((it) => (
                    <div key={it.rateCardId || it.itemName} style={{ display: 'flex', alignItems: 'baseline', gap: '10px', padding: '6px 0', borderBottom: '1px solid rgba(112,115,124,0.1)', fontSize: '13px' }}>
                      <span style={{ flex: 1, color: '#3A4358', fontWeight: 600 }}>{it.itemName}</span>
                      <span style={{ color: '#9AA3B8', fontFamily: GROTESK }}>{it.qty.toLocaleString('ko-KR')} {it.unit}</span>
                      <span style={{ width: '110px', textAlign: 'right', color: '#071A3E', fontWeight: 700, fontFamily: GROTESK }}>₩{fmt(it.amount)}</span>
                    </div>
                  ))}
                </div>
                <p style={{ margin: '14px 0 0', fontSize: '12.5px', color: '#9AA3B8' }}>AI 결과의 최종 확인 책임은 이용자에게 있습니다. 본 견적은 발행 시점 표준 레이트카드 기준이며 계약 시 확정됩니다.</p>
              </>
            )}
          </div>

          {/* 담당자 */}
          <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '26px clamp(16px,5vw,32px)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '999px', background: '#0D3B8F', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '17px', flexShrink: 0 }}>윤</div>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '15.5px', fontWeight: 700, color: '#071A3E' }}>윤소희</span>
                <span style={{ background: '#EEF1F6', color: '#5A6478', borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>담당 PM · (주)이노웨이브 파트너스</span>
              </div>
              <div style={{ fontSize: '13px', color: '#5A6478', marginTop: '4px' }}>기획안·견적 관련 문의는 담당 PM에게 바로 연락하실 수 있습니다.</div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a href="tel:02-6203-1140" className="iw-btn-outline-navy" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', border: '1px solid rgba(13,59,143,0.25)', borderRadius: '999px', padding: '10px 18px', fontSize: '13.5px', fontWeight: 700, color: '#0D3B8F', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                <span style={{ fontFamily: GROTESK }}>02-6203-1140</span>
              </a>
              <a href="mailto:sohee.yoon@innowave.kr" className="iw-btn-outline-navy" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', border: '1px solid rgba(13,59,143,0.25)', borderRadius: '999px', padding: '10px 18px', fontSize: '13.5px', fontWeight: 700, color: '#0D3B8F', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="22,6 12,13 2,6" /></svg>
                sohee.yoon@innowave.kr
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function ProposalScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#F6F9FF', paddingBottom: '100px' }}>
      <RequireAuth>
        <ProposalBody />
      </RequireAuth>
    </div>
  );
}
