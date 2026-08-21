/**
 * 5단계 산출 문서 — 운영사업 제안서 · 과업지시서
 * 서술 섹션은 AI(generateDocument)가 작성하고, 프로그램·예산·인력 표는 워크플로우 실데이터를 배치한다.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CARD_SHADOW, GROTESK, Notice } from '../components.js';
import {
  errMessage, generateWorkflowDocument, loadWorkflowDocument, pendingDocumentGeneration, saveWorkflowDocument,
  useMatches, usePrograms, useSupplies,
  type DocRow, type ProposalDocContent, type WorkflowDocType, type WorkorderDocContent,
} from '../hooks.js';
import { downloadElementAsPdf } from '../pdf.js';
import { fmt } from '../state.js';
import type { Event } from '../../../models/Event.js';
import type { Quote } from '../../../models/Quote.js';

const H1: React.CSSProperties = { margin: '26px 0 10px', fontSize: '17px', fontWeight: 800, color: '#071A3E', borderBottom: '2px solid #0D3B8F', paddingBottom: '6px' };
const H2: React.CSSProperties = { margin: '16px 0 8px', fontSize: '14px', fontWeight: 800, color: '#0D3B8F' };
const P: React.CSSProperties = { margin: '0 0 8px', fontSize: '13px', lineHeight: 1.7, color: '#1B2437' };
const TH: React.CSSProperties = { border: '1px solid rgba(13,59,143,0.25)', background: '#EEF3FC', padding: '7px 10px', fontSize: '12px', fontWeight: 700, color: '#0D3B8F', textAlign: 'left' };
const TD: React.CSSProperties = { border: '1px solid rgba(13,59,143,0.18)', padding: '7px 10px', fontSize: '12.5px', color: '#1B2437', lineHeight: 1.55 };
const TABLE: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', margin: '6px 0 12px' };

function Bullets({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <ul style={{ margin: '0 0 10px', paddingLeft: '18px' }}>
      {items.map((t) => <li key={t} style={{ fontSize: '13px', lineHeight: 1.7, color: '#1B2437' }}>{t}</li>)}
    </ul>
  );
}

function RowsTable({ rows }: { rows?: DocRow[] }) {
  if (!rows?.length) return null;
  return (
    <table style={TABLE}><tbody>
      {rows.map((r) => (
        <tr key={r.label}>
          <td style={{ ...TH, width: '140px' }}>{r.label}</td>
          <td style={TD}>{r.value}</td>
        </tr>
      ))}
    </tbody></table>
  );
}

export interface SavedProgramRow { title: string; startTime: string; durationMin: number }

function durText(min: number): string {
  return (min >= 60 ? `${Math.floor(min / 60)}시간 ` : '') + (min % 60 ? `${min % 60}분` : '');
}

function ProgramTable({ programs }: { programs: SavedProgramRow[] }) {
  if (!programs.length) return null;
  return (
    <table style={TABLE}>
      <thead><tr><th style={{ ...TH, width: '80px' }}>시간</th><th style={TH}>프로그램</th><th style={{ ...TH, width: '90px' }}>소요</th></tr></thead>
      <tbody>
        {programs.map((p, i) => (
          <tr key={`${p.title}-${i}`}>
            <td style={{ ...TD, fontFamily: GROTESK }}>{p.startTime}</td>
            <td style={TD}>{p.title}</td>
            <td style={TD}>{durText(p.durationMin)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function WorkflowDocsSection({ eventId, event, quote, planName, instruction }: {
  eventId: string;
  event: Event;
  quote: Quote;
  planName: string;
  instruction: string;
}) {
  const { programs } = usePrograms(eventId);
  const { supplies } = useSupplies(eventId);
  const { matches } = useMatches(eventId);

  const [docs, setDocs] = useState<{ proposal: ProposalDocContent | null; workorder: WorkorderDocContent | null }>({ proposal: null, workorder: null });
  const [busy, setBusy] = useState<WorkflowDocType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<WorkflowDocType | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);
  const loadedFor = useRef<string | null>(null);

  // 저장본 복원 + 4단계에서 시작된 사전 생성 대기
  const [pregenWaiting, setPregenWaiting] = useState(false);
  useEffect(() => {
    if (loadedFor.current === eventId) return;
    loadedFor.current = eventId;
    const loadDocs = () => Promise.all([
      loadWorkflowDocument<ProposalDocContent>(eventId, 'proposal'),
      loadWorkflowDocument<WorkorderDocContent>(eventId, 'workorder'),
    ]).then(([proposal, workorder]) => setDocs({ proposal, workorder })).catch(() => {});
    const pending = pendingDocumentGeneration(eventId);
    if (pending) {
      setPregenWaiting(true);
      void pending.then(loadDocs).finally(() => setPregenWaiting(false));
    } else {
      void loadDocs();
    }
  }, [eventId]);

  const roleCounts = matches.reduce<Record<string, number>>((a, m) => ({ ...a, [m.role]: (a[m.role] || 0) + 1 }), {});

  const generate = async (docType: WorkflowDocType) => {
    if (busy) return;
    setBusy(docType);
    setError(null);
    try {
      const context = {
        eventInfo: event.basicInfo,
        programs: programs.map((p) => ({ time: p.startTime, name: p.title, dur: p.durationMin })),
        supplies: supplies.map((it) => ({ name: it.name, cat: it.cat, qty: it.qty, unit: it.unit })),
        personnel: Object.entries(roleCounts).map(([role, count]) => ({ role, count })),
        quote: {
          plan: planName,
          supply: quote.subtotal,
          margin: quote.marginTotal,
          vat: quote.vat,
          total: quote.total,
          items: quote.items.map((i) => ({ name: i.itemName, qty: i.qty, unit: i.unit })),
        },
        instruction: instruction || null,
      };
      const content = docType === 'proposal'
        ? await generateWorkflowDocument<ProposalDocContent>('proposal', context)
        : await generateWorkflowDocument<WorkorderDocContent>('workorder', context);
      await saveWorkflowDocument(eventId, docType, content);
      setDocs((d) => ({ ...d, [docType]: content }));
      setPreview(docType);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async () => {
    if (!docRef.current || pdfBusy || !preview) return;
    setPdfBusy(true);
    try {
      const label = preview === 'proposal' ? '운영사업제안서' : '과업지시서';
      const name = (event.basicInfo.name || '행사').replace(/[\\/:*?"<>|\s]+/g, '_');
      await downloadElementAsPdf(docRef.current, `${label}_${name}.pdf`);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setPdfBusy(false);
    }
  };

  const b = event.basicInfo;

  const cardDefs: { type: WorkflowDocType; title: string; desc: string }[] = [
    { type: 'proposal', title: '운영사업 제안서', desc: '사업 개요부터 소요예산까지 11개 섹션 — 발주처 제출용 제안서를 AI가 작성합니다.' },
    { type: 'workorder', title: '과업지시서', desc: '사업범위(사전·진행·종료 후)와 과업내용 — 발주처용 RFP 초안을 AI가 작성합니다.' },
  ];

  return (
    <div style={{ marginTop: '24px', background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '26px clamp(16px,5vw,32px)' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 800, color: '#071A3E' }}>산출 문서</h2>
      <p style={{ margin: '0 0 18px', fontSize: '12.5px', color: '#9AA3B8' }}>
        1~4단계 데이터와 선택한 {planName} 견적을 바탕으로 AI가 문서를 작성합니다. 예산안은 위 견적이 별첨으로 연결됩니다.
      </p>
      {pregenWaiting && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#E5F0FF', borderRadius: '14px', padding: '13px 18px', marginBottom: '14px' }}>
          <span style={{ width: '18px', height: '18px', borderRadius: '999px', border: '3px solid #FFFFFF', borderTopColor: '#1463F3', animation: 'iwSpin .8s linear infinite', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#0D3B8F' }}>4단계 완료와 함께 AI가 제안서·과업지시서를 작성하고 있어요… (최대 1분)</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: '14px' }}>
        {cardDefs.map(({ type, title, desc }) => {
          const has = !!docs[type];
          const loading = busy === type;
          return (
            <div key={type} style={{ border: '1px solid rgba(112,115,124,0.18)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <span style={{ width: '34px', height: '34px', borderRadius: '11px', background: type === 'proposal' ? '#E5F0FF' : '#DCF3F8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={type === 'proposal' ? '#1463F3' : '#0C7A93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                </span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#071A3E' }}>{title}</span>
                {has && <span style={{ background: '#F0FBF4', color: '#1B8A4B', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}>생성됨</span>}
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.6, color: '#5A6478', flex: 1 }}>{desc}</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {has && (
                  <button onClick={() => setPreview(type)} className="iw-btn-outline-blue" style={{ flex: 1, border: '1px solid rgba(20,99,243,0.4)', background: '#FFFFFF', color: '#1463F3', borderRadius: '999px', padding: '10px 0', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>문서 보기</button>
                )}
                <button
                  onClick={() => void generate(type)}
                  disabled={loading || busy !== null || pregenWaiting}
                  className="iw-btn-primary"
                  style={{ flex: 1, background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '10px 0', fontSize: '13px', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: (busy !== null && !loading) || pregenWaiting ? 0.5 : loading ? 0.75 : 1 }}
                >{loading || pregenWaiting ? 'AI 작성 중… (최대 1분)' : has ? '다시 생성' : 'AI로 생성'}</button>
              </div>
            </div>
          );
        })}
      </div>
      {error && <div style={{ marginTop: '12px' }}><Notice tone="error">{error}</Notice></div>}

      {/* 문서 미리보기 모달 */}
      {preview && docs[preview] && (
        <div
          onClick={() => setPreview(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(7,26,62,0.55)', backdropFilter: 'blur(4px)', zIndex: 1200, overflowY: 'auto', padding: '28px 14px' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '880px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '12px' }}>
              <button onClick={() => void downloadPdf()} disabled={pdfBusy} className="iw-btn-primary" style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '10px 22px', fontSize: '13.5px', fontWeight: 700, cursor: pdfBusy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: pdfBusy ? 0.7 : 1 }}>
                {pdfBusy ? 'PDF 생성 중…' : 'PDF 다운로드'}
              </button>
              <button onClick={() => setPreview(null)} style={{ background: '#FFFFFF', color: '#071A3E', border: 'none', borderRadius: '999px', padding: '10px 22px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>닫기</button>
            </div>
            <div ref={docRef} style={{ background: '#FFFFFF', borderRadius: '14px', padding: 'clamp(24px,5vw,48px)' }}>
              {preview === 'proposal'
                ? <ProposalDocView doc={docs.proposal!} b={b} programs={programs} quote={quote} planName={planName} roleCounts={roleCounts} />
                : <WorkorderDocView doc={docs.workorder!} b={b} programs={programs} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProposalDocView({ doc, b, programs, quote, planName, roleCounts }: {
  doc: ProposalDocContent;
  b: Event['basicInfo'];
  programs: SavedProgramRow[];
  quote: Quote;
  planName: string;
  roleCounts: Record<string, number>;
}) {
  return (
    <div>
      <div style={{ textAlign: 'center', padding: '30px 0 26px', borderBottom: '3px solid #0D3B8F', marginBottom: '10px' }}>
        <div style={{ fontSize: '12.5px', color: '#5A6478', marginBottom: '10px' }}>{b.organizer} 귀중</div>
        <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 800, color: '#071A3E' }}>{b.name}</h1>
        <div style={{ fontSize: '19px', fontWeight: 700, color: '#0D3B8F', letterSpacing: '0.35em', marginBottom: '14px' }}>운 영 사 업 제 안 서</div>
        <div style={{ fontSize: '12.5px', color: '#5A6478' }}>주관기관 · 주식회사 이노웨이브</div>
      </div>

      <h2 style={H1}>Ⅰ. 사업 개요</h2>
      <RowsTable rows={doc.overviewRows} />

      <h2 style={H1}>Ⅱ. 추진 배경 및 필요성</h2>
      <div style={H2}>■ 정책적 배경</div>
      {doc.backgroundPolicy?.map((t) => <p key={t} style={P}>{t}</p>)}
      <div style={H2}>■ 환경적 배경</div>
      {doc.backgroundEnvironment?.map((t) => <p key={t} style={P}>{t}</p>)}
      <div style={H2}>■ 사업의 필요성</div>
      <Bullets items={doc.necessity} />

      <h2 style={H1}>Ⅲ. 사업 목표 및 기대효과</h2>
      <div style={H2}>■ 사업 목표</div>
      <Bullets items={doc.goals} />
      <div style={H2}>■ 기대 효과</div>
      <Bullets items={doc.effects} />

      <h2 style={H1}>Ⅳ. 프로그램 구성</h2>
      <Bullets items={doc.programDirection} />
      <div style={H2}>■ 표준 타임테이블</div>
      <ProgramTable programs={programs} />

      <h2 style={H1}>Ⅴ. 차별성</h2>
      <Bullets items={doc.differentiation} />

      <h2 style={H1}>Ⅵ. 참가자 모집 및 홍보 계획</h2>
      <div style={H2}>■ 참가자 모집</div>
      <Bullets items={doc.recruitment} />
      <div style={H2}>■ 홍보 계획</div>
      <Bullets items={doc.promotion} />

      <h2 style={H1}>Ⅶ. 사후관리 및 콘텐츠 자산화</h2>
      <div style={H2}>■ 사후관리 운영 방안</div>
      <Bullets items={doc.aftercare} />
      <div style={H2}>■ 콘텐츠 자산화</div>
      <Bullets items={doc.contentAssets} />

      <h2 style={H1}>Ⅷ. 정량성과지표(KPI)</h2>
      <table style={TABLE}>
        <thead><tr><th style={TH}>지표</th><th style={{ ...TH, width: '120px' }}>목표</th><th style={TH}>비고</th></tr></thead>
        <tbody>
          {doc.kpi?.map((k) => (
            <tr key={k.name}><td style={TD}>{k.name}</td><td style={TD}>{k.target}</td><td style={TD}>{k.note}</td></tr>
          ))}
        </tbody>
      </table>

      <h2 style={H1}>Ⅸ. 추진일정</h2>
      <table style={TABLE}>
        <thead><tr><th style={{ ...TH, width: '160px' }}>시기</th><th style={TH}>주요 활동</th></tr></thead>
        <tbody>
          {doc.schedule?.map((sc) => (
            <tr key={`${sc.period}-${sc.activity}`}><td style={TD}>{sc.period}</td><td style={TD}>{sc.activity}</td></tr>
          ))}
        </tbody>
      </table>

      <h2 style={H1}>Ⅹ. 수행체계 및 위험관리</h2>
      <div style={H2}>■ 수행체계</div>
      <Bullets items={doc.team} />
      {Object.keys(roleCounts).length > 0 && (
        <table style={TABLE}>
          <thead><tr><th style={TH}>역할</th><th style={{ ...TH, width: '100px' }}>인원</th></tr></thead>
          <tbody>
            {Object.entries(roleCounts).map(([role, count]) => (
              <tr key={role}><td style={TD}>{role}</td><td style={{ ...TD, fontFamily: GROTESK }}>{count}명</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={H2}>■ 위험관리</div>
      <table style={TABLE}>
        <thead><tr><th style={TH}>위험 요인</th><th style={TH}>대응 방안</th></tr></thead>
        <tbody>
          {doc.risks?.map((r) => (
            <tr key={r.risk}><td style={TD}>{r.risk}</td><td style={TD}>{r.mitigation}</td></tr>
          ))}
        </tbody>
      </table>

      <h2 style={H1}>Ⅺ. 소요예산 *별첨</h2>
      <p style={P}>{doc.budgetSummary}</p>
      <table style={TABLE}>
        <thead><tr><th style={TH}>항목</th><th style={{ ...TH, width: '90px', textAlign: 'right' }}>수량</th><th style={{ ...TH, width: '140px', textAlign: 'right' }}>금액(원)</th></tr></thead>
        <tbody>
          {quote.items.map((i) => (
            <tr key={i.rateCardId + i.itemName}>
              <td style={TD}>{i.itemName}</td>
              <td style={{ ...TD, textAlign: 'right', fontFamily: GROTESK }}>{i.qty}{i.unit}</td>
              <td style={{ ...TD, textAlign: 'right', fontFamily: GROTESK }}>{fmt(i.qty * i.unitPrice)}</td>
            </tr>
          ))}
          <tr><td style={{ ...TH }} colSpan={2}>공급가 합계 ({planName})</td><td style={{ ...TD, textAlign: 'right', fontFamily: GROTESK }}>{fmt(quote.subtotal)}</td></tr>
          <tr><td style={{ ...TH }} colSpan={2}>일반관리비(마진)</td><td style={{ ...TD, textAlign: 'right', fontFamily: GROTESK }}>{fmt(quote.marginTotal)}</td></tr>
          <tr><td style={{ ...TH }} colSpan={2}>부가가치세</td><td style={{ ...TD, textAlign: 'right', fontFamily: GROTESK }}>{fmt(quote.vat)}</td></tr>
          <tr><td style={{ ...TH }} colSpan={2}>총 사업비 (VAT 포함)</td><td style={{ ...TD, textAlign: 'right', fontFamily: GROTESK, fontWeight: 700, color: '#0D3B8F' }}>{fmt(quote.total)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export function WorkorderDocView({ doc, b, programs }: {
  doc: WorkorderDocContent;
  b: Event['basicInfo'];
  programs: SavedProgramRow[];
}) {
  return (
    <div>
      <div style={{ textAlign: 'center', padding: '30px 0 26px', borderBottom: '3px solid #0D3B8F', marginBottom: '10px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 800, color: '#071A3E' }}>{b.name}</h1>
        <div style={{ fontSize: '19px', fontWeight: 700, color: '#0D3B8F', letterSpacing: '0.35em', marginBottom: '14px' }}>과 업 지 시 서</div>
        <div style={{ fontSize: '12.5px', color: '#5A6478' }}>발주기관 · {b.organizer || '(발주기관명)'}</div>
      </div>

      <h2 style={H1}>Ⅰ. 사업개요</h2>
      <RowsTable rows={doc.overviewRows} />
      <div style={H2}>■ 사업 목적</div>
      <Bullets items={doc.purpose} />
      <div style={H2}>■ 사업범위 — 가. 프로그램 시작 전 (사전 기획 및 준비)</div>
      <Bullets items={doc.scopePre} />
      <div style={H2}>■ 사업범위 — 나. 프로그램 진행 (운영 및 관리)</div>
      <Bullets items={doc.scopeRun} />
      <div style={H2}>■ 사업범위 — 다. 프로그램 종료 후 (성과 분석 및 결과보고)</div>
      <Bullets items={doc.scopePost} />

      <h2 style={H1}>Ⅱ. 과업내용</h2>
      <RowsTable rows={doc.taskRows} />
      <div style={H2}>■ 운영 방향</div>
      <Bullets items={doc.direction} />
      <div style={H2}>■ 프로그램 개요</div>
      <ProgramTable programs={programs} />

      <h2 style={H1}>Ⅲ. 협의 및 확인 사항</h2>
      <Bullets items={doc.notes} />

      <h2 style={H1}>Ⅳ. 운영 일정</h2>
      <Bullets items={doc.schedule} />
    </div>
  );
}
