import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CARD_SHADOW, GROTESK, Loading, Logo, Notice } from '../components.js';
import {
  buildOptionQuote, buildQuoteItems, errMessage, loadWorkflowDocument, tsLabel, useEvent, usePrograms, useQuoteParams, useRateCards, useSupplies,
  type ProposalDocContent, type WorkorderDocContent,
} from '../hooks.js';
import { ProposalDocView, WorkorderDocView } from './WorkflowDocs.js';
import { downloadElementAsPdf } from '../pdf.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { fmt, selectionSummary, useIw } from '../state.js';
import { QuoteItem, type QuoteOptionValue } from '../../../models/Quote.js';

const PLAN_NAMES = { basic: 'Basic', standard: 'Standard', premium: 'Premium' } as const;

function ProposalBody() {
  const { s } = useIw();
  const [searchParams] = useSearchParams();
  // 공유 링크(?event=...)로 열리면 그 프로젝트를, 아니면 현재 작업 중인 프로젝트를 보여준다
  const eventId = searchParams.get('event') ?? s.currentEventId;

  const { event } = useEvent(eventId);
  const { user } = useAuth();
  // 익명 열람 시 rateCards는 조회하지 않는다 (rules상 로그인 필요) — supplies 스냅샷으로 견적 구성
  const { cards, loading: cardsLoading } = useRateCards(!!user);
  const { supplies: savedSupplies } = useSupplies(eventId);
  const { params } = useQuoteParams();
  const { programs: savedPrograms } = usePrograms(eventId);
  const docRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'proposal' | 'workorder'>('proposal');
  const [sharedDocs, setSharedDocs] = useState<{ proposal: ProposalDocContent | null; workorder: WorkorderDocContent | null }>({ proposal: null, workorder: null });

  // 5단계에서 생성된 제안서·과업지시서를 공유 화면에도 함께 노출
  useEffect(() => {
    if (!eventId) return;
    void Promise.all([
      loadWorkflowDocument<ProposalDocContent>(eventId, 'proposal'),
      loadWorkflowDocument<WorkorderDocContent>(eventId, 'workorder'),
    ]).then(([proposal, workorder]) => setSharedDocs({ proposal, workorder })).catch(() => {});
  }, [eventId]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const items = useMemo(() => {
    if (savedSupplies.length > 0) {
      return savedSupplies.filter((it) => it.qty > 0).map((it) => new QuoteItem({
        rateCardId: it.rateCardId, itemName: it.name, unit: it.unit,
        qty: it.qty, unitPrice: it.unitPrice, marginRate: it.marginRate,
      }));
    }
    return buildQuoteItems(cards, event);
  }, [savedSupplies, cards, event]);
  const mult = s.plan === 'basic' ? params.multBasic : s.plan === 'premium' ? params.multPremium : 1.0;
  const quote = useMemo(
    () => buildOptionQuote(items, s.plan as QuoteOptionValue, mult, s.budget * 10000),
    [items, s.plan, mult, s.budget],
  );

  const selSummary = selectionSummary(s.selected);

  // 저장된 프로그램(서브컬렉션)이 있으면 우선, 없으면 로컬 구성 표시
  const programRows = savedPrograms.length > 0
    ? savedPrograms.map((p) => ({ time: p.startTime, name: p.title, dur: p.durationMin }))
    : s.programs.map((p) => ({ time: p.time, name: p.name, dur: p.dur }));

  const b = event?.basicInfo;
  const title = b?.name ?? '2026 청년 창업 해커톤';
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
      const label = tab === 'proposal' ? '운영사업제안서' : '과업지시서';
      await downloadElementAsPdf(docRef.current, `${label}_${title.replace(/[\\/:*?"<>|\s]+/g, '_')}.pdf`);
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
              {pdfBusy ? 'PDF 생성 중…' : tab === 'proposal' ? '제안서 PDF 다운로드' : '과업지시서 PDF 다운로드'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '32px clamp(16px,5vw,32px) 0' }}>
        {pdfError && <Notice tone="error">{pdfError}</Notice>}

        {/* 문서 탭 — 기획안·견적 / 운영사업 제안서 / 과업지시서 */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {([['proposal', '운영사업 제안서'], ['workorder', '과업지시서']] as const).map(([id, label]) => {
            const disabled = !sharedDocs[id];
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => { if (!disabled) setTab(id); }}
                disabled={disabled}
                title={disabled ? '아직 생성되지 않은 문서입니다 (5단계에서 생성)' : undefined}
                style={{ border: `1px solid ${active ? '#1463F3' : 'rgba(112,115,124,0.28)'}`, background: active ? '#1463F3' : '#FFFFFF', color: active ? '#FFFFFF' : disabled ? '#B9C6E4' : '#3A4358', borderRadius: '999px', padding: '10px 20px', fontSize: '13.5px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all .16s' }}
              >{label}</button>
            );
          })}
        </div>

        {/* PDF로 내보내는 문서 영역 — 캡처 시 카드가 콘텐츠 박스 가장자리에 붙지 않게 안쪽 여백 유지 */}
        <div ref={docRef} style={{ background: '#F6F9FF', padding: '14px 12px' }}>
          {tab === 'proposal' && sharedDocs.proposal && b && (
            <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: 'clamp(24px,5vw,48px)' }}>
              <ProposalDocView
                doc={sharedDocs.proposal}
                b={b}
                programs={programRows.map((p) => ({ title: p.name, startTime: p.time, durationMin: p.dur }))}
                quote={quote}
                planName="최종"
                roleCounts={Object.fromEntries(selSummary.map((x) => [x.role, x.count]))}
              />
            </div>
          )}
          {tab === 'workorder' && sharedDocs.workorder && b && (
            <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: 'clamp(24px,5vw,48px)' }}>
              <WorkorderDocView
                doc={sharedDocs.workorder}
                b={b}
                programs={programRows.map((p) => ({ title: p.name, startTime: p.time, durationMin: p.dur }))}
              />
            </div>
          )}
          {!sharedDocs[tab] && (
            <Notice tone="info">아직 생성된 문서가 없습니다. 워크플로우 5단계에서 제안서·과업지시서를 생성하면 이곳에 표시됩니다.</Notice>
          )}
        </div>
      </div>
    </>
  );
}

export function ProposalScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#F6F9FF', paddingBottom: '100px' }}>
      <ProposalBody />
    </div>
  );
}
