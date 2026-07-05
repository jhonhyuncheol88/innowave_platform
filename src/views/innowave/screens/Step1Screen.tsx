import { useEffect, useRef, useState } from 'react';
import { CARD_SHADOW, INPUT_STYLE, LABEL_STYLE, Loading, Notice, Stepper } from '../components.js';
import { EVENT_TYPES, EXTRACTED_FIELDS, OP_MODES, UPLOADED_FORM } from '../data.js';
import {
  DOC_ACCEPT, errMessage, invalidateEvent, saveWorkflowStep, startDocParse, subscribeDocParse, useEvent,
  type DocParse, type ParsedFields,
} from '../hooks.js';
import { useIw } from '../state.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { eventRepository } from '../../../repositories/EventRepository.js';
import { Event } from '../../../models/Event.js';

interface FormState {
  name: string;
  org: string;
  type: string;
  start: string;
  end: string;
  region: string;
  scale: string;
  budget: string;
  purpose: string;
  opMode: string;
}

const EMPTY_FORM: FormState = {
  name: '', org: '', type: '', start: '', end: '', region: '',
  scale: '', budget: '', purpose: '', opMode: '오프라인',
};

const FILLED_FORM: FormState = {
  name: UPLOADED_FORM.name,
  org: UPLOADED_FORM.org,
  type: UPLOADED_FORM.type,
  start: UPLOADED_FORM.start,
  end: UPLOADED_FORM.end,
  region: UPLOADED_FORM.region,
  scale: UPLOADED_FORM.scale,
  budget: UPLOADED_FORM.budget,
  purpose: UPLOADED_FORM.purpose,
  opMode: '오프라인',
};

/** 숫자만 추출 — '6,000만 원' → 6000, '300명' → 300 */
function parseDigits(text: string): number {
  return Number(text.replace(/[^\d]/g, '')) || 0;
}

/** 예산 텍스트 → 원 단위 (백만 미만 숫자는 만원 단위로 간주) */
function parseBudgetWon(text: string): number {
  const n = parseDigits(text);
  if (n === 0) return 0;
  return n < 1000000 ? n * 10000 : n;
}

/** AI 추출 결과 → 폼 값 매핑 (value가 비어 있는 필드는 건드리지 않는다) */
function fieldsToForm(f: ParsedFields): Partial<FormState> {
  const str = (v: string | number | null) => (v == null ? '' : String(v).trim());
  const num = (v: string | number | null) => (typeof v === 'number' ? v : parseDigits(str(v)));
  const patch: Partial<FormState> = {};
  if (str(f.name.value)) patch.name = str(f.name.value);
  if (str(f.organizer.value)) patch.org = str(f.organizer.value);
  if (EVENT_TYPES.includes(str(f.eventType.value))) patch.type = str(f.eventType.value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str(f.periodStart.value))) patch.start = str(f.periodStart.value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str(f.periodEnd.value))) patch.end = str(f.periodEnd.value);
  if (str(f.region.value)) patch.region = str(f.region.value);
  if (['오프라인', '온라인', '하이브리드'].includes(str(f.operationType.value))) patch.opMode = str(f.operationType.value);
  if (num(f.participantScale.value) > 0) patch.scale = `${num(f.participantScale.value)}명`;
  if (num(f.budgetLimit.value) > 0) patch.budget = `${Math.round(num(f.budgetLimit.value) / 10000).toLocaleString('ko-KR')}만 원`;
  if (str(f.purpose.value)) patch.purpose = str(f.purpose.value);
  return patch;
}

/** AI 추출 결과 → 우측 패널 표시 항목 */
function fieldsToPanel(f: ParsedFields): { label: string; value: string; confidence: number }[] {
  const str = (v: string | number | null) => (v == null ? '' : String(v).trim());
  const items: { label: string; value: string; confidence: number }[] = [];
  const push = (label: string, value: string, confidence: number) => {
    if (value) items.push({ label, value, confidence });
  };
  push('행사명', str(f.name.value), f.name.confidence);
  push('주관기관', str(f.organizer.value), f.organizer.confidence);
  push('행사 유형', str(f.eventType.value), f.eventType.confidence);
  const period = [str(f.periodStart.value), str(f.periodEnd.value)].filter(Boolean).join(' ~ ');
  push('기간', period, Math.min(f.periodStart.confidence, f.periodEnd.confidence));
  push('지역 · 운영 형태', [str(f.region.value), str(f.operationType.value)].filter(Boolean).join(' · '),
    Math.min(f.region.confidence || 1, f.operationType.confidence || 1));
  const scale = typeof f.participantScale.value === 'number' && f.participantScale.value > 0 ? `${f.participantScale.value}명` : '';
  push('참가 규모', scale, f.participantScale.confidence);
  const budget = typeof f.budgetLimit.value === 'number' && f.budgetLimit.value > 0
    ? `${Math.round(f.budgetLimit.value / 10000).toLocaleString('ko-KR')}만 원` : '';
  push('예산 한도', budget, f.budgetLimit.confidence);
  return items;
}

function Step1Inner() {
  const { s, set, go } = useIw();
  const { user, role, approval } = useAuth();
  const canOperate = role === 'admin' || approval === 'approved';
  const { event, loading: eventLoading } = useEvent(s.currentEventId);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const up = s.uploaded;
  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  // ── 실제 문서 분석 (로그인 사용자, Vertex AI 파이프라인) ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const [parse, setParse] = useState<DocParse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => () => { unsubRef.current?.(); }, []);

  const onFilePicked = async (file: File) => {
    if (!user) return;
    setUploadError(null);
    unsubRef.current?.();
    setParse({ id: '', fileName: file.name, status: 'pending', fields: null, error: null });
    try {
      const docId = await startDocParse(user.uid, file);
      unsubRef.current = subscribeDocParse(docId, (p) => {
        setParse(p);
        if (p.status === 'done' && p.fields) {
          setForm((f) => ({ ...f, ...fieldsToForm(p.fields!) }));
          set({ uploaded: true });
          setInvalid(false);
        }
      });
    } catch (e) {
      setParse(null);
      setUploadError(errMessage(e));
    }
  };

  const parsing = parse?.status === 'pending' || parse?.status === 'processing';

  // 게스트가 다시 돌아왔을 때 입력값 복원
  useEffect(() => {
    if (event || !s.guestInfo) return;
    const b = s.guestInfo;
    setForm({
      name: b.name,
      org: b.organizer,
      type: b.eventType,
      start: b.periodStart ?? '',
      end: b.periodEnd ?? '',
      region: b.region,
      scale: b.participantScale ? `${b.participantScale}명` : '',
      budget: b.budgetLimit ? `${Math.round(b.budgetLimit / 10000).toLocaleString('ko-KR')}만 원` : '',
      purpose: b.purpose,
      opMode: b.operationType || '오프라인',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 기존 이벤트(currentEventId)를 이어서 수정할 때 프리필
  useEffect(() => {
    if (!event) return;
    const b = event.basicInfo;
    setForm({
      name: b.name,
      org: b.organizer,
      type: b.eventType,
      start: b.periodStart ?? '',
      end: b.periodEnd ?? '',
      region: b.region,
      scale: b.participantScale ? `${b.participantScale}명` : '',
      budget: b.budgetLimit ? `${Math.round(b.budgetLimit / 10000).toLocaleString('ko-KR')}만 원` : '',
      purpose: b.purpose,
      opMode: b.operationType || '오프라인',
    });
  }, [event]);

  const toggleUpload = () => {
    const next = !up;
    set({ uploaded: next });
    setForm(next ? FILLED_FORM : EMPTY_FORM);
    setInvalid(false);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.type) {
      setInvalid(true);
      return;
    }
    const basicInfo = {
      name: form.name.trim(),
      organizer: form.org.trim(),
      eventType: form.type,
      periodStart: form.start || null,
      periodEnd: form.end || null,
      region: form.region.trim(),
      operationType: form.opMode,
      participantScale: parseDigits(form.scale),
      budgetLimit: parseBudgetWon(form.budget),
      purpose: form.purpose.trim(),
    };
    // 비로그인 게스트 또는 승인 대기 계정: Firestore 저장 없이 로컬 상태로 진행
    // (게스트는 견적 확인 시점에 로그인 유도, 미승인 계정은 관리자 승인 후 저장 가능)
    if (!user || !canOperate) {
      set({ guestInfo: basicInfo });
      go('step2');
      return;
    }
    setBusy(true);
    setSaveError(null);
    try {
      if (s.currentEventId) {
        // 상태·currentStep은 앞으로만 — 진행 중 프로젝트 수정 시 회귀 방지
        await saveWorkflowStep(s.currentEventId, 'composing', 2, { basicInfo, parsedFromDoc: up });
      } else {
        const created = await eventRepository.create(new Event({
          ownerUid: user.uid, basicInfo, parsedFromDoc: up, status: 'composing', currentStep: 2,
        }));
        set({ currentEventId: created.id });
        invalidateEvent(created.id);
      }
      go('step2');
    } catch (e) {
      setSaveError(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F6F9FF', paddingBottom: '100px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px clamp(16px,5vw,32px) 0' }}>
        <Stepper current={1} />

        <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 800, color: '#071A3E', letterSpacing: '-0.01em' }}>행사 기본 정보를 알려주세요</h1>
        <p style={{ margin: '0 0 26px', fontSize: '15px', color: '#5A6478' }}>과업지시서를 올리면 아래 항목을 AI가 자동으로 채워 드립니다.</p>

        {user && !canOperate && (
          <Notice tone="info">관리자 승인 대기 중이라 입력 내용이 프로젝트로 저장되지는 않습니다. 견적 확인까지는 자유롭게 이용하실 수 있어요.</Notice>
        )}

        {s.currentEventId && eventLoading ? (
          <Loading label="행사 정보를 불러오는 중…" />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: '24px', alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={DOC_ACCEPT}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onFilePicked(f);
                    e.target.value = '';
                  }}
                />
                <div
                  onClick={() => {
                    if (parsing) return;
                    if (user) fileInputRef.current?.click();
                    else toggleUpload();
                  }}
                  className="iw-dropzone"
                  style={{
                    background: (user ? parse?.status === 'done' : up) ? '#F0FBF4' : parse?.status === 'failed' ? '#FFF7F7' : '#FFFFFF',
                    border: `2px dashed ${(user ? parse?.status === 'done' : up) ? '#2BB673' : parse?.status === 'failed' ? 'rgba(229,72,77,0.5)' : 'rgba(20,99,243,0.35)'}`,
                    borderRadius: '20px', padding: '26px 24px', textAlign: 'center',
                    cursor: parsing ? 'progress' : 'pointer', transition: 'all .18s',
                  }}
                >
                  {user && parsing ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '999px', border: '3px solid #E5F0FF', borderTopColor: '#1463F3', animation: 'iwSpin .8s linear infinite', display: 'inline-block', flexShrink: 0 }} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#071A3E' }}>{parse?.fileName}</div>
                        <div style={{ fontSize: '13px', color: '#1463F3', fontWeight: 600 }}>AI가 문서를 분석하고 있어요… (약 10~30초)</div>
                      </div>
                    </div>
                  ) : user && parse?.status === 'done' ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#DCF3F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0C7A93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#071A3E' }}>{parse.fileName}</div>
                        <div style={{ fontSize: '13px', color: '#0C7A93', fontWeight: 600 }}>
                          분석 완료 — {parse.fields ? fieldsToPanel(parse.fields).length : 0}개 항목을 자동으로 채웠습니다 · 클릭해 다른 문서 업로드
                        </div>
                      </div>
                    </div>
                  ) : user && parse?.status === 'failed' ? (
                    <>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#B3261E', marginBottom: '5px' }}>문서를 읽지 못했습니다</div>
                      <div style={{ fontSize: '13px', color: '#5A6478' }}>{parse.error ?? 'PDF·DOCX·PPTX·HWPX 형식인지 확인해 주세요'} — 클릭해 다시 업로드</div>
                    </>
                  ) : (user ? true : !up) ? (
                    <>
                      <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: '#E5F0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1463F3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                      </div>
                      <div style={{ fontSize: '15.5px', fontWeight: 700, color: '#071A3E', marginBottom: '5px' }}>과업지시서·제안요청서 업로드</div>
                      <div style={{ fontSize: '13.5px', color: '#5A6478' }}>
                        {user ? '클릭해 파일을 선택하세요 · PDF, DOCX, PPTX, HWPX 지원' : '클릭해서 데모 문서를 넣어 보세요 (로그인하면 실제 AI 분석)'}
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#DCF3F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0C7A93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#071A3E' }}>과업지시서_청년창업해커톤.pdf (데모)</div>
                        <div style={{ fontSize: '13px', color: '#0C7A93', fontWeight: 600 }}>분석 완료 — 9개 항목을 자동으로 채웠습니다</div>
                      </div>
                    </div>
                  )}
                </div>
                {uploadError && <Notice tone="error">{uploadError}</Notice>}

                <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '26px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: '16px' }}>
                    <div>
                      <label style={LABEL_STYLE}>행사명</label>
                      <input type="text" value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="예: 2026 청년 창업 해커톤" className="iw-input" style={INPUT_STYLE} />
                    </div>
                    <div>
                      <label style={LABEL_STYLE}>주관기관</label>
                      <input type="text" value={form.org} onChange={(e) => patch({ org: e.target.value })} placeholder="예: 창업진흥원" className="iw-input" style={INPUT_STYLE} />
                    </div>
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>행사 유형</label>
                    <select value={form.type} onChange={(e) => patch({ type: e.target.value })} style={{ ...INPUT_STYLE, cursor: 'pointer' }}>
                      <option value="">선택해 주세요</option>
                      {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,150px),1fr))', gap: '16px' }}>
                    <div>
                      <label style={LABEL_STYLE}>시작일</label>
                      <input type="date" value={form.start} onChange={(e) => patch({ start: e.target.value })} className="iw-input" style={{ ...INPUT_STYLE, padding: '11px 14px', fontSize: '14px' }} />
                    </div>
                    <div>
                      <label style={LABEL_STYLE}>종료일</label>
                      <input type="date" value={form.end} onChange={(e) => patch({ end: e.target.value })} className="iw-input" style={{ ...INPUT_STYLE, padding: '11px 14px', fontSize: '14px' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,150px),1fr))', gap: '16px' }}>
                    <div>
                      <label style={LABEL_STYLE}>지역</label>
                      <input type="text" value={form.region} onChange={(e) => patch({ region: e.target.value })} placeholder="예: 서울" className="iw-input" style={INPUT_STYLE} />
                    </div>
                    <div>
                      <label style={LABEL_STYLE}>참가 규모</label>
                      <input type="text" value={form.scale} onChange={(e) => patch({ scale: e.target.value })} placeholder="예: 300명" className="iw-input" style={INPUT_STYLE} />
                    </div>
                    <div>
                      <label style={LABEL_STYLE}>예산 한도</label>
                      <input type="text" value={form.budget} onChange={(e) => patch({ budget: e.target.value })} placeholder="예: 6,000만 원" className="iw-input" style={INPUT_STYLE} />
                    </div>
                  </div>
                  <div>
                    <label style={{ ...LABEL_STYLE, marginBottom: '8px' }}>운영 형태</label>
                    <div style={{ display: 'inline-flex', gap: '4px', background: '#EEF1F6', borderRadius: '999px', padding: '4px' }}>
                      {OP_MODES.map((m) => (
                        <button key={m} onClick={() => patch({ opMode: m })} style={{ border: 'none', cursor: 'pointer', borderRadius: '999px', padding: '9px 20px', fontSize: '13.5px', fontWeight: 600, fontFamily: 'inherit', transition: 'all .16s', background: form.opMode === m ? '#FFFFFF' : 'transparent', color: form.opMode === m ? '#1463F3' : '#5A6478' }}>{m}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>행사 목적</label>
                    <textarea rows={3} value={form.purpose} onChange={(e) => patch({ purpose: e.target.value })} placeholder="행사를 통해 이루고 싶은 목표를 적어 주세요" className="iw-input" style={{ ...INPUT_STYLE, resize: 'vertical', lineHeight: 1.55 }} />
                  </div>
                </div>
              </div>

              <div className="iw-sticky-panel" style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '26px', position: 'sticky', top: '86px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '11px', background: 'linear-gradient(135deg,#4FD8EB,#1463F3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" /></svg>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#071A3E' }}>AI 자동 추출 결과</div>
                </div>
                {user && parsing ? (
                  <Loading label="문서에서 항목을 추출하는 중…" />
                ) : user && parse?.status === 'done' && parse.fields ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {fieldsToPanel(parse.fields).map((ex) => {
                      const sure = ex.confidence >= 0.7;
                      return (
                        <div key={ex.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: sure ? '#F6FBFE' : '#FFFBF2', border: `1px solid ${sure ? 'rgba(79,216,235,0.4)' : 'rgba(245,166,35,0.4)'}`, borderRadius: '12px', padding: '11px 14px' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12px', color: '#5A6478', marginBottom: '2px' }}>{ex.label}</div>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#071A3E' }}>{ex.value}</div>
                          </div>
                          <span style={{ flexShrink: 0, background: sure ? '#DCF3F8' : '#FFF0D6', color: sure ? '#0C7A93' : '#B26A00', borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700 }}>
                            {sure ? 'AI 자동 입력' : '검토 필요'}
                          </span>
                        </div>
                      );
                    })}
                    <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: '#9AA3B8', lineHeight: 1.6 }}>노란 배지는 확신이 낮은 항목입니다 — 왼쪽 입력란에서 확인해 주세요.</p>
                  </div>
                ) : !user && up ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {EXTRACTED_FIELDS.map((ex) => (
                      <div key={ex.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: '#F6FBFE', border: '1px solid rgba(79,216,235,0.4)', borderRadius: '12px', padding: '11px 14px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '12px', color: '#5A6478', marginBottom: '2px' }}>{ex.label}</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#071A3E' }}>{ex.value}</div>
                        </div>
                        <span style={{ flexShrink: 0, background: '#DCF3F8', color: '#0C7A93', borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700 }}>AI 자동 입력</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div style={{ border: '1px solid rgba(112,115,124,0.22)', borderRadius: '14px', padding: '28px 20px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 6px', fontSize: '14.5px', fontWeight: 600, color: '#3A4358' }}>문서를 업로드하면 AI가 자동으로 채웁니다</p>
                      <p style={{ margin: 0, fontSize: '13px', color: '#9AA3B8', lineHeight: 1.6 }}>행사명, 기간, 규모, 예산 등 핵심 항목을 추출해<br />왼쪽 입력란에 반영해 드립니다.</p>
                    </div>
                    <p style={{ margin: '16px 0 0', fontSize: '12.5px', color: '#9AA3B8', lineHeight: 1.6 }}>문서를 읽지 못하면 "문서를 읽지 못했습니다. PDF·DOCX·PPTX·HWPX 형식인지 확인해 주세요"라고 안내해 드립니다.</p>
                  </>
                )}
              </div>
            </div>

            {saveError && <div style={{ marginTop: '18px' }}><Notice tone="error">{saveError}</Notice></div>}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginTop: '30px', flexWrap: 'wrap' }}>
              <button onClick={() => go('landing')} className="iw-btn-outline-navy" style={{ background: 'transparent', color: '#0D3B8F', border: '1px solid rgba(13,59,143,0.25)', borderRadius: '999px', padding: '13px 30px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>이전</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', color: invalid ? '#E5484D' : '#9AA3B8', fontWeight: invalid ? 700 : 400 }}>행사명과 행사 유형은 꼭 입력해 주세요</span>
                <button onClick={submit} disabled={busy} className="iw-btn-primary" style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '13px clamp(16px,5vw,32px)', fontSize: '15px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 18px rgba(20,99,243,0.3)', opacity: busy ? 0.7 : 1 }}>{busy ? '저장 중…' : '다음 단계로'}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function Step1Screen() {
  return <Step1Inner />;
}
