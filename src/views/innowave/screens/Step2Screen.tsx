import { useState } from 'react';
import { CARD_SHADOW, GROTESK, INPUT_STYLE, LABEL_STYLE, Notice, Stepper } from '../components.js';
import { errMessage, invalidateEvent, savePrograms } from '../hooks.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { useIw } from '../state.js';
import { eventRepository } from '../../../repositories/EventRepository.js';

function durText(dur: number): string {
  return (dur >= 60 ? `${Math.floor(dur / 60)}시간 ` : '') + (dur % 60 ? `${dur % 60}분` : '');
}

export function Step2Screen() {
  const { s, set, go } = useIw();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const totalMin = s.programs.reduce((a, p) => a + p.dur, 0);

  const editSave = () => {
    if (s.editIdx === null) return;
    const next = s.programs.map((p, j) => j === s.editIdx
      ? { ...p, time: s.editTime, name: s.editName, dur: Math.max(5, s.editDur || 30), ai: false }
      : p);
    set({ programs: next, editIdx: null });
  };

  const goNext = async () => {
    // 프로젝트가 없거나 로그아웃 상태(이전 세션의 프로젝트 ID가 남은 경우)면 저장 없이 게스트로 진행
    if (!s.currentEventId || !user) {
      go('step3');
      return;
    }
    setBusy(true);
    setSaveError(null);
    try {
      await savePrograms(s.currentEventId, s.programs);
      await eventRepository.patch(s.currentEventId, { status: 'matching', currentStep: 3 });
      invalidateEvent(s.currentEventId);
      go('step3');
    } catch (e) {
      setSaveError(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F6F9FF', paddingBottom: '100px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '32px clamp(16px,5vw,32px) 0' }}>
        <Stepper current={2} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap', marginBottom: '22px' }}>
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 800, color: '#071A3E', letterSpacing: '-0.01em' }}>프로그램 구성을 확인하세요</h1>
            <p style={{ margin: 0, fontSize: '15px', color: '#5A6478' }}>AI가 해커톤 유형에 맞춰 제안한 구성입니다. 순서를 바꾸거나 자유롭게 수정하세요.</p>
            {s.currentEventId && (
              <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: '#9AA3B8' }}>다음 단계로 이동하면 events/{s.currentEventId}/programs 서브컬렉션에 저장됩니다.</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '20px', background: '#FFFFFF', borderRadius: '16px', boxShadow: CARD_SHADOW, padding: '13px 22px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#5A6478' }}>총 프로그램</div>
              <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '20px', color: '#071A3E' }}>
                {s.programs.length}
                <span style={{ fontSize: '13px', fontFamily: "'Pretendard Variable',Pretendard,sans-serif", fontWeight: 600, color: '#5A6478' }}> 개</span>
              </div>
            </div>
            <div style={{ width: '1px', background: 'rgba(112,115,124,0.22)' }} />
            <div>
              <div style={{ fontSize: '12px', color: '#5A6478' }}>총 소요 시간</div>
              <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '20px', color: '#1463F3' }}>
                {Math.floor(totalMin / 60)}h {totalMin % 60 ? `${totalMin % 60}m` : ''}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {s.programs.map((pg, i) => (
            <div key={`${pg.name}-${i}`} className="iw-program-row" style={{ display: 'flex', alignItems: 'center', gap: '14px', background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '15px 20px', flexWrap: 'wrap' }}>
              <div style={{ color: '#C3CBDA', cursor: 'grab', flexShrink: 0 }} title="드래그하여 순서 변경">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.7" /><circle cx="15" cy="6" r="1.7" /><circle cx="9" cy="12" r="1.7" /><circle cx="15" cy="12" r="1.7" /><circle cx="9" cy="18" r="1.7" /><circle cx="15" cy="18" r="1.7" /></svg>
              </div>
              <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: '15px', color: '#0D3B8F', width: '52px', flexShrink: 0 }}>{pg.time}</div>
              <div style={{ flex: 1, minWidth: '160px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '15.5px', fontWeight: 700, color: '#071A3E' }}>{pg.name}</span>
                <span style={{ background: pg.ai ? '#E5F0FF' : '#EEF1F6', color: pg.ai ? '#1463F3' : '#5A6478', borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700 }}>{pg.ai ? 'AI 제안' : '직접 수정'}</span>
              </div>
              <div style={{ fontSize: '13.5px', color: '#5A6478', flexShrink: 0 }}>{durText(pg.dur)}</div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button
                  onClick={() => set({ editIdx: i, editTime: pg.time, editName: pg.name, editDur: pg.dur })}
                  title="수정" className="iw-icon-edit"
                  style={{ width: '32px', height: '32px', borderRadius: '10px', border: '1px solid rgba(112,115,124,0.22)', background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A6478' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
                </button>
                <button
                  onClick={() => set({ programs: s.programs.filter((_, j) => j !== i) })}
                  title="삭제" className="iw-icon-delete"
                  style={{ width: '32px', height: '32px', borderRadius: '10px', border: '1px solid rgba(112,115,124,0.22)', background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A6478' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => set({ programs: [...s.programs, { time: '19:30', name: '새 프로그램', dur: 30, ai: false }] })}
            className="iw-btn-dashed"
            style={{ border: '2px dashed rgba(20,99,243,0.35)', background: 'transparent', borderRadius: '20px', padding: '16px', fontSize: '14.5px', fontWeight: 700, color: '#1463F3', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all .16s' }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>＋</span> 프로그램 추가
          </button>
        </div>

        {saveError && <div style={{ marginTop: '18px' }}><Notice tone="error">{saveError}</Notice></div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginTop: '30px', flexWrap: 'wrap' }}>
          <button onClick={() => go('step1')} className="iw-btn-outline-navy" style={{ background: 'transparent', color: '#0D3B8F', border: '1px solid rgba(13,59,143,0.25)', borderRadius: '999px', padding: '13px 30px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>이전</button>
          <button onClick={goNext} disabled={busy} className="iw-btn-primary" style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '13px clamp(16px,5vw,32px)', fontSize: '15px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 18px rgba(20,99,243,0.3)', opacity: busy ? 0.7 : 1 }}>{busy ? '저장 중…' : '다음 단계로'}</button>
        </div>
      </div>

      {/* 프로그램 편집 다이얼로그 */}
      {s.editIdx !== null && (
        <div
          onClick={() => set({ editIdx: null })}
          style={{ position: 'fixed', inset: 0, background: 'rgba(7,26,62,0.45)', backdropFilter: 'blur(4px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '440px', background: '#FFFFFF', borderRadius: '20px', boxShadow: '0 24px 64px rgba(7,26,62,0.35)', padding: '30px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: '#071A3E' }}>프로그램 수정</h2>
              <button onClick={() => set({ editIdx: null })} title="닫기" className="iw-btn-close" style={{ width: '32px', height: '32px', borderRadius: '999px', border: 'none', background: '#EEF1F6', color: '#5A6478', cursor: 'pointer', fontSize: '14px', lineHeight: 1, fontFamily: 'inherit' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={LABEL_STYLE}>프로그램명</label>
                <input type="text" value={s.editName} onChange={(e) => set({ editName: e.target.value })} placeholder="예: 오프닝 키노트" className="iw-input" style={INPUT_STYLE} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={LABEL_STYLE}>시작 시간</label>
                  <input type="time" value={s.editTime} onChange={(e) => set({ editTime: e.target.value })} className="iw-input" style={{ ...INPUT_STYLE, padding: '11px 14px' }} />
                </div>
                <div>
                  <label style={LABEL_STYLE}>소요 시간 (분)</label>
                  <input type="number" min={5} step={5} value={s.editDur} onChange={(e) => set({ editDur: Number(e.target.value) })} className="iw-input" style={{ ...INPUT_STYLE, padding: '11px 14px', fontFamily: GROTESK }} />
                </div>
              </div>
              <div style={{ background: '#F0F7FF', border: '1px solid rgba(20,99,243,0.16)', borderRadius: '12px', padding: '11px 14px', fontSize: '12.5px', lineHeight: 1.55, color: '#3A4358' }}>
                저장하면 이 항목은 <strong style={{ color: '#0D3B8F' }}>직접 수정</strong> 배지로 표시됩니다.
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
              <button onClick={() => set({ editIdx: null })} className="iw-btn-soft" style={{ background: 'transparent', color: '#5A6478', border: '1px solid rgba(112,115,124,0.28)', borderRadius: '999px', padding: '11px 24px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
              <button onClick={editSave} className="iw-btn-primary" style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '11px 28px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 18px rgba(20,99,243,0.3)' }}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
