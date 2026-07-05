import { useState } from 'react';
import { CARD_SHADOW, GROTESK, INPUT_STYLE, LABEL_STYLE, Logo, Notice } from '../components.js';
import { EVENT_TYPES, PROCESS_CARDS } from '../data.js';
import { errMessage, submitInquiry } from '../hooks.js';
import { useIw } from '../state.js';

const BUDGET_RANGES = ['미정', '3,000만 원 미만', '3,000만~6,000만 원', '6,000만~1억 원', '1억 원 이상'];

interface InquiryForm {
  name: string;
  contact: string;
  organization: string;
  eventType: string;
  budgetRange: string;
  message: string;
}

const EMPTY_INQUIRY: InquiryForm = {
  name: '', contact: '', organization: '', eventType: '', budgetRange: '미정', message: '',
};

function ContactSection() {
  const [form, setForm] = useState<InquiryForm>(EMPTY_INQUIRY);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const patch = (p: Partial<InquiryForm>) => setForm((f) => ({ ...f, ...p }));

  const submit = async () => {
    if (!form.name.trim() || form.contact.trim().length < 5 || !form.message.trim()) {
      setInvalid(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitInquiry({
        name: form.name.trim().slice(0, 50),
        contact: form.contact.trim().slice(0, 120),
        organization: form.organization.trim().slice(0, 100),
        eventType: form.eventType,
        budgetRange: form.budgetRange,
        message: form.message.trim().slice(0, 2000),
      });
      setSubmitted(true);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="contact" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 32px 76px' }}>
      <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '44px clamp(24px,6vw,40px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: '40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <div style={{ color: '#1463F3', fontWeight: 700, fontSize: '13px', letterSpacing: '0.08em', marginBottom: '10px' }}>CONTACT</div>
            <h2 style={{ margin: '0 0 12px', fontSize: 'clamp(22px,2.4vw,30px)', fontWeight: 800, color: '#071A3E', letterSpacing: '-0.01em', textWrap: 'pretty' }}>행사 기획, 어디서부터<br />시작할지 막막하신가요?</h2>
            <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.65, color: '#5A6478', textWrap: 'pretty' }}>
              행사 개요만 남겨 주시면 담당 PM이 <strong style={{ color: '#0D3B8F' }}>1영업일 내</strong>에 연락드립니다.
              레이트카드 기반 예산 가늠부터 운영 방식 상담까지, 부담 없이 문의하세요.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: 'auto' }}>
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

        {submitted ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', textAlign: 'center', padding: '24px 0' }}>
            <div style={{ width: '54px', height: '54px', borderRadius: '999px', background: '#E6F7EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1B8A4B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#071A3E' }}>문의가 접수되었습니다</div>
            <p style={{ margin: 0, fontSize: '14px', color: '#5A6478', lineHeight: 1.6 }}>1영업일 내에 남겨주신 연락처로 연락드릴게요.</p>
            <button onClick={() => { setForm(EMPTY_INQUIRY); setSubmitted(false); setInvalid(false); }} style={{ background: 'transparent', color: '#9AA3B8', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>새 문의 작성</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,140px),1fr))', gap: '14px' }}>
              <div>
                <label style={LABEL_STYLE}>이름 <span style={{ color: '#E5484D' }}>*</span></label>
                <input type="text" value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="담당자 성함" className="iw-input" style={INPUT_STYLE} />
              </div>
              <div>
                <label style={LABEL_STYLE}>연락처 <span style={{ color: '#E5484D' }}>*</span></label>
                <input type="text" value={form.contact} onChange={(e) => patch({ contact: e.target.value })} placeholder="이메일 또는 전화번호" className="iw-input" style={INPUT_STYLE} />
              </div>
            </div>
            <div>
              <label style={LABEL_STYLE}>소속</label>
              <input type="text" value={form.organization} onChange={(e) => patch({ organization: e.target.value })} placeholder="기관·회사명 (선택)" className="iw-input" style={INPUT_STYLE} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,140px),1fr))', gap: '14px' }}>
              <div>
                <label style={LABEL_STYLE}>행사 유형</label>
                <select value={form.eventType} onChange={(e) => patch({ eventType: e.target.value })} style={{ ...INPUT_STYLE, cursor: 'pointer' }}>
                  <option value="">선택 안 함</option>
                  {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>예산 규모</label>
                <select value={form.budgetRange} onChange={(e) => patch({ budgetRange: e.target.value })} style={{ ...INPUT_STYLE, cursor: 'pointer' }}>
                  {BUDGET_RANGES.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={LABEL_STYLE}>문의 내용 <span style={{ color: '#E5484D' }}>*</span></label>
              <textarea rows={4} value={form.message} onChange={(e) => patch({ message: e.target.value })} placeholder="행사 개요, 예상 시기, 궁금한 점을 자유롭게 남겨 주세요" className="iw-input" style={{ ...INPUT_STYLE, resize: 'vertical', lineHeight: 1.55 }} />
            </div>
            {invalid && <span style={{ fontSize: '13px', color: '#E5484D', fontWeight: 700 }}>이름, 연락처(5자 이상), 문의 내용을 입력해 주세요.</span>}
            {error && <Notice tone="error">{error}</Notice>}
            <button onClick={submit} disabled={busy} className="iw-btn-primary" style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '14px 0', fontSize: '15px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 18px rgba(20,99,243,0.3)', opacity: busy ? 0.7 : 1 }}>{busy ? '접수 중…' : '문의 보내기'}</button>
            <span style={{ fontSize: '12.5px', color: '#9AA3B8', textAlign: 'center' }}>제출하신 정보는 상담 목적으로만 사용됩니다.</span>
          </div>
        )}
      </div>
    </section>
  );
}

export function LandingScreen() {
  const { go } = useIw();
  return (
    <div style={{ minHeight: '100vh', background: '#F6F9FF', paddingBottom: '80px' }}>
      <header style={{ background: '#071A3E' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px clamp(16px,5vw,32px)', display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
          <Logo />
          <nav style={{ display: 'flex', gap: '28px', flex: 1, fontSize: '14.5px' }}>
            <a href="#" className="iw-navlink">서비스 소개</a>
            <a href="#" className="iw-navlink">워크플로우</a>
            <a href="#" className="iw-navlink">운영 사례</a>
          </nav>
          <button onClick={() => go('auth')} className="iw-btn-glass" style={{ background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.28)', borderRadius: '999px', padding: '9px 22px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>로그인</button>
        </div>
      </header>

      <section style={{ background: '#071A3E', position: 'relative' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '84px clamp(16px,5vw,32px) 110px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(79,216,235,0.12)', border: '1px solid rgba(79,216,235,0.3)', color: '#4FD8EB', borderRadius: '999px', padding: '7px 16px', fontSize: '13px', fontWeight: 600, marginBottom: '28px' }}>
            MICE·공공 행사 기획을 위한 AI 자동화 플랫폼
          </div>
          <h1 style={{ margin: '0 0 20px', color: '#FFFFFF', fontSize: 'clamp(32px,4.6vw,56px)', fontWeight: 800, lineHeight: 1.22, letterSpacing: '-0.02em', textWrap: 'pretty' }}>
            수십 시간 걸리던 행사 기획,<br />입력 한 번에 견적까지
          </h1>
          <p style={{ margin: '0 auto 40px', maxWidth: '560px', color: 'rgba(255,255,255,0.68)', fontSize: 'clamp(15px,1.4vw,18px)', lineHeight: 1.6, textWrap: 'pretty' }}>
            행사 정보를 입력하거나 과업지시서를 업로드하세요.<br />AI가 기획안과 3가지 예산 견적 옵션을 자동으로 만들어 드립니다.
          </p>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => go('step1')} className="iw-btn-primary" style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '15px 34px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(20,99,243,0.4)' }}>무료로 기획 시작</button>
            <button className="iw-btn-hero-ghost" style={{ background: 'transparent', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.32)', borderRadius: '999px', padding: '15px 34px', fontSize: '16px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>운영 사례 보기</button>
          </div>
        </div>
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '96px' }}>
          <defs>
            <linearGradient id="iwWave" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#4FD8EB" /><stop offset="0.5" stopColor="#1463F3" /><stop offset="1" stopColor="#0D3B8F" />
            </linearGradient>
          </defs>
          <path d="M0,70 C240,116 480,16 720,50 C960,84 1200,32 1440,64 L1440,120 L0,120 Z" fill="#F6F9FF" />
          <path d="M0,64 C240,110 480,10 720,44 C960,78 1200,26 1440,58" fill="none" stroke="url(#iwWave)" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </section>

      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '68px clamp(16px,5vw,32px) 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '42px' }}>
          <div style={{ color: '#1463F3', fontWeight: 700, fontSize: '13px', letterSpacing: '0.08em', marginBottom: '10px' }}>HOW IT WORKS</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px,2.6vw,34px)', fontWeight: 800, color: '#071A3E', letterSpacing: '-0.01em' }}>네 단계면 기획안이 완성됩니다</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: '20px' }}>
          {PROCESS_CARDS.map((pc) => (
            <div key={pc.num} style={{ background: '#FFFFFF', borderRadius: '20px', padding: '28px', boxShadow: CARD_SHADOW }}>
              <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '15px', color: '#4FD8EB', marginBottom: '14px' }}>{pc.num}</div>
              <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#071A3E' }}>{pc.title}</h3>
              <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.6, color: '#5A6478' }}>{pc.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '52px clamp(16px,5vw,32px) 76px' }}>
        <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '44px clamp(16px,5vw,32px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '32px', textAlign: 'center' }}>
          <div>
            <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: 'clamp(36px,3.4vw,46px)', color: '#1463F3', letterSpacing: '-0.02em' }}>130<span style={{ color: '#4FD8EB' }}>+</span></div>
            <div style={{ fontSize: '14.5px', color: '#5A6478', marginTop: '6px' }}>레이트카드 표준 단가 항목</div>
          </div>
          <div>
            <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: 'clamp(36px,3.4vw,46px)', color: '#1463F3', letterSpacing: '-0.02em' }}>500<span style={{ color: '#4FD8EB' }}>+</span></div>
            <div style={{ fontSize: '14.5px', color: '#5A6478', marginTop: '6px' }}>검증된 전문가·운영 인력풀</div>
          </div>
          <div>
            <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: 'clamp(36px,3.4vw,46px)', color: '#1463F3', letterSpacing: '-0.02em' }}>80<span style={{ fontSize: '0.55em', color: '#071A3E' }}>건</span></div>
            <div style={{ fontSize: '14.5px', color: '#5A6478', marginTop: '6px' }}>누적 행사 운영 케이스 데이터</div>
          </div>
        </div>
      </section>

      <ContactSection />

      <footer style={{ background: '#071A3E' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '36px clamp(16px,5vw,32px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <Logo size={17} />
          <div style={{ display: 'flex', gap: '24px', fontSize: '13px' }}>
            <a href="#" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>이용약관</a>
            <a href="#" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>개인정보처리방침</a>
            <a href="#contact" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>문의하기</a>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>© 2026 INNOWAVE. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
