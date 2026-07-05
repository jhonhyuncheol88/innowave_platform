import { useEffect, useState, type CSSProperties } from 'react';
import { ADMIN_INPUT_STYLE, ADMIN_LABEL_STYLE, GROTESK, Loading, Logo, Notice, RequireAuth } from '../components.js';
import { ADMIN_MENU, RATE_CATEGORIES } from '../data.js';
import { useIw } from '../state.js';
import {
  deleteInquiry,
  errMessage,
  saveQuoteParams,
  tsLabel,
  updateInquiry,
  updateUserAdmin,
  useCaseData,
  useInquiriesAdmin,
  useMyEvents,
  usePersonnelAdmin,
  useQuoteParams,
  useRateCards,
  useUsersAdmin,
  wonLabel,
  type AdminUserRow,
  type InquiryStatus,
  type UserApproval,
} from '../hooks.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { rateCardRepository } from '../../../repositories/RateCardRepository.js';
import { personnelRepository } from '../../../repositories/PersonnelRepository.js';
import { RateCard } from '../../../models/RateCard.js';

const TH: CSSProperties = {
  background: '#F7F9FC', textAlign: 'left', padding: '11px 16px', fontSize: '12px',
  fontWeight: 700, color: '#5A6478', borderBottom: '1px solid rgba(112,115,124,0.22)',
};
const TH_STICKY: CSSProperties = { ...TH, position: 'sticky', top: 0, zIndex: 2 };
const TD_BORDER = '1px solid rgba(112,115,124,0.12)';
const PAGE_SIZE = 15;

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: '38px', height: '22px', borderRadius: '999px', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background .16s', background: on ? '#1463F3' : '#D5DAE4', padding: 0 }}>
      <span style={{ position: 'absolute', top: '3px', left: on ? '19px' : '3px', width: '16px', height: '16px', borderRadius: '999px', background: '#FFFFFF', transition: 'left .16s', boxShadow: '0 1px 2px rgba(23,23,23,0.2)' }} />
    </button>
  );
}

interface PanelState {
  open: boolean;
  editId: string | null;
  name: string;
  cat: string;
  unit: string;
  price: string;
  margin: string;
  saving: boolean;
  error: string | null;
}

const PANEL_CLOSED: PanelState = {
  open: false, editId: null, name: '', cat: '장소·공간', unit: '', price: '', margin: '10', saving: false, error: null,
};

export function AdminScreen() {
  return (
    <RequireAuth>
      <AdminInner />
    </RequireAuth>
  );
}

const APPROVAL_BADGE: Record<UserApproval, { label: string; bg: string; color: string }> = {
  pending: { label: '승인 대기', bg: '#FFF6E8', color: '#B26A00' },
  approved: { label: '사용 중', bg: '#E6F7EC', color: '#1B8A4B' },
  rejected: { label: '이용 제한', bg: '#FFF1F1', color: '#B3261E' },
};

const INQUIRY_OPTS: [InquiryStatus, string, string][] = [
  ['new', '신규', '#B26A00'],
  ['in_progress', '확인 중', '#1463F3'],
  ['done', '회신 완료', '#1B8A4B'],
];

const INQUIRY_BADGE: Record<InquiryStatus, { label: string; bg: string; color: string }> = {
  new: { label: '신규', bg: '#FFF6E8', color: '#B26A00' },
  in_progress: { label: '확인 중', bg: '#E5F0FF', color: '#1463F3' },
  done: { label: '회신 완료', bg: '#E6F7EC', color: '#1B8A4B' },
};

/** 연락처 문자열을 mailto:/tel: 링크로 감싼다 (이메일/전화 형식이 아니면 텍스트) */
function ContactLink({ contact }: { contact: string }) {
  const style = { color: '#1463F3', textDecoration: 'none', fontWeight: 700 } as const;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return <a href={`mailto:${contact}`} style={style}>{contact}</a>;
  if (/^[\d\s\-+()]{7,}$/.test(contact)) return <a href={`tel:${contact.replace(/[^\d+]/g, '')}`} style={{ ...style, fontFamily: GROTESK }}>{contact}</a>;
  return <span style={{ color: '#3A4358', fontWeight: 600 }}>{contact}</span>;
}

function AdminInner() {
  const { s, set, go } = useIw();
  const { user, role } = useAuth();

  /* ── 사용자 관리 ── */
  const usersAdmin = useUsersAdmin();
  const pendingCount = usersAdmin.users.filter((u) => u.approvalStatus === 'pending').length;
  const [userMutError, setUserMutError] = useState<string | null>(null);
  const [orgDrafts, setOrgDrafts] = useState<Record<string, string>>({});

  const patchUser = async (uid: string, patch: Parameters<typeof updateUserAdmin>[1]) => {
    try {
      await updateUserAdmin(uid, patch);
      setUserMutError(null);
      usersAdmin.reload();
    } catch (e) {
      setUserMutError(errMessage(e));
    }
  };

  /* ── 고객문의 ── */
  const inquiriesAdmin = useInquiriesAdmin();
  const newInquiryCount = inquiriesAdmin.inquiries.filter((i) => i.status === 'new').length;
  const [inquiryMutError, setInquiryMutError] = useState<string | null>(null);
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({});

  const patchInquiry = async (id: string, patch: Parameters<typeof updateInquiry>[1]) => {
    try {
      await updateInquiry(id, patch);
      setInquiryMutError(null);
      inquiriesAdmin.reload();
    } catch (e) {
      setInquiryMutError(errMessage(e));
    }
  };

  const removeInquiry = async (id: string) => {
    try {
      await deleteInquiry(id);
      setInquiryMutError(null);
      inquiriesAdmin.reload();
    } catch (e) {
      setInquiryMutError(errMessage(e));
    }
  };

  /* ── 레이트카드 ── */
  const rate = useRateCards();
  const [page, setPage] = useState(1);
  const [panel, setPanel] = useState<PanelState>(PANEL_CLOSED);
  const [rateMutError, setRateMutError] = useState<string | null>(null);

  useEffect(() => { setPage(1); }, [s.adminQuery, s.adminCat]);

  const categories = rate.cards.length
    ? Array.from(new Set(rate.cards.map((c) => c.category))).sort((a, b) => a.localeCompare(b, 'ko'))
    : [...RATE_CATEGORIES];

  const q = s.adminQuery.trim().toLowerCase();
  const filtered = rate.cards.filter((c) =>
    (s.adminCat === '전체 카테고리' || c.category === s.adminCat)
    && (!q || c.itemName.toLowerCase().includes(q)));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const pageStart = Math.max(1, Math.min(curPage - 2, pageCount - 4));
  const pageNums = Array.from({ length: Math.min(5, pageCount) }, (_, i) => pageStart + i).filter((n) => n <= pageCount);

  const panelValid = !!(panel.name.trim() && panel.unit.trim() && Number(panel.price) > 0);

  const openAdd = () => setPanel({ ...PANEL_CLOSED, open: true, cat: categories[0] ?? '장소·공간' });
  const openEdit = (c: RateCard) => setPanel({
    open: true, editId: c.id, name: c.itemName, cat: c.category, unit: c.unit,
    price: String(c.unitPrice), margin: String(c.marginRate), saving: false, error: null,
  });

  const savePanel = async () => {
    if (!panelValid || panel.saving) return;
    setPanel((p) => ({ ...p, saving: true, error: null }));
    try {
      const fields = {
        itemName: panel.name.trim(),
        category: panel.cat,
        unit: panel.unit.trim(),
        unitPrice: Number(panel.price) || 0,
        marginRate: Number(panel.margin) || 0,
      };
      if (panel.editId) {
        await rateCardRepository.patch(panel.editId, fields);
      } else {
        await rateCardRepository.create(new RateCard({ ...fields, isActive: true }));
      }
      setPanel(PANEL_CLOSED);
      rate.reload();
    } catch (e) {
      setPanel((p) => ({ ...p, saving: false, error: errMessage(e) }));
    }
  };

  const toggleCard = async (c: RateCard) => {
    if (!c.id) return;
    try { await rateCardRepository.patch(c.id, { isActive: !c.isActive }); setRateMutError(null); rate.reload(); }
    catch (e) { setRateMutError(errMessage(e)); }
  };

  const deleteCard = async (c: RateCard) => {
    if (!c.id) return;
    try { await rateCardRepository.remove(c.id); setRateMutError(null); rate.reload(); }
    catch (e) { setRateMutError(errMessage(e)); }
  };

  /* ── 인력풀 ── */
  const pool = usePersonnelAdmin(s.poolRole, 100);
  const [poolMutError, setPoolMutError] = useState<string | null>(null);

  const togglePerson = async (id: string | null, isActive: boolean) => {
    if (!id) return;
    try { await personnelRepository.patch(id, { isActive: !isActive }); setPoolMutError(null); pool.reload(); }
    catch (e) { setPoolMutError(errMessage(e)); }
  };

  /* ── 케이스 데이터 ── */
  const caseData = useCaseData();

  /* ── 진행현황 관리 ── */
  const myEvents = useMyEvents();
  const opsEvents = myEvents.events.filter((e) => e.progressSummary != null);

  /* ── 견적 파라미터 ── */
  const { params, available: qpAvailable, loading: qpLoading } = useQuoteParams();
  const [qp, setQp] = useState({ margin: '20', vat: '10', basic: '0.8', premium: '1.3' });
  const [qpSaved, setQpSaved] = useState(false);
  const [qpSaving, setQpSaving] = useState(false);
  const [qpError, setQpError] = useState<string | null>(null);

  useEffect(() => {
    if (!qpLoading && qpAvailable) {
      setQp({
        margin: String(params.marginRate),
        vat: String(params.vatRate),
        basic: String(params.multBasic),
        premium: String(params.multPremium),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qpLoading, qpAvailable]);

  const saveQp = async () => {
    if (!user || qpSaving) return;
    setQpSaving(true);
    setQpError(null);
    try {
      await saveQuoteParams({
        marginRate: Number(qp.margin) || 0,
        vatRate: Number(qp.vat) || 0,
        multBasic: Number(qp.basic) || 0.8,
        multPremium: Number(qp.premium) || 1.3,
      }, user.uid);
      setQpSaved(true);
    } catch (e) {
      setQpError(errMessage(e));
    } finally {
      setQpSaving(false);
    }
  };

  return (
    <div className="iw-admin-layout" style={{ minHeight: '100vh', background: '#F6F9FF', display: 'flex', paddingBottom: '80px' }}>

      {/* 사이드바 */}
      <aside className="iw-admin-side" style={{ width: '224px', flexShrink: 0, background: '#FFFFFF', borderRight: '1px solid rgba(112,115,124,0.22)', minHeight: '100vh', padding: '24px 14px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ padding: '0 10px' }}><Logo dark size={16} suffix="ADMIN" /></div>
        <nav className="iw-admin-nav" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {ADMIN_MENU.map((m) => {
            const active = s.adminTab === m;
            return (
              <div key={m} onClick={() => set({ adminTab: m })} className="iw-admin-menu" style={{ padding: '10px 12px', borderRadius: '10px', fontSize: '14px', fontWeight: active ? 700 : 500, color: active ? '#1463F3' : '#3A4358', background: active ? '#E5F0FF' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                {m}
                {m === '사용자 관리' && pendingCount > 0 && (
                  <span style={{ background: '#E5484D', color: '#FFFFFF', borderRadius: '999px', minWidth: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, padding: '0 6px', fontFamily: GROTESK }}>{pendingCount}</span>
                )}
                {m === '고객문의' && newInquiryCount > 0 && (
                  <span style={{ background: '#E5484D', color: '#FFFFFF', borderRadius: '999px', minWidth: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, padding: '0 6px', fontFamily: GROTESK }}>{newInquiryCount}</span>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* 메인 */}
      <main style={{ flex: 1, minWidth: 0, padding: '28px clamp(14px,4vw,30px)', boxSizing: 'border-box' }}>

        {role !== 'admin' && (
          <Notice tone="info">
            관리자 기능은 admin 권한이 필요합니다. Firestore 콘솔에서 users/{user?.uid ?? '{내 UID}'} 문서의 role을 "admin"으로 변경해 주세요.
          </Notice>
        )}

        {s.adminTab === '사용자 관리' && (
          <>
            <h1 style={{ margin: '0 0 6px', fontSize: '21px', fontWeight: 800, color: '#071A3E' }}>사용자 관리</h1>
            <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: '#5A6478' }}>
              신규 가입자는 <strong style={{ color: '#B26A00' }}>승인 대기</strong> 상태로 시작합니다. 승인해야 프로젝트 생성 등 운영 기능을 사용할 수 있어요. 발주처 역할은 조직 ID를 함께 지정해 주세요.
            </p>

            {userMutError && <Notice tone="error">{userMutError}</Notice>}
            {usersAdmin.loading && <Loading label="사용자 목록을 불러오는 중…" />}
            {usersAdmin.error && <Notice tone="error">{usersAdmin.error}</Notice>}

            {!usersAdmin.loading && !usersAdmin.error && (
              <div style={{ background: '#FFFFFF', border: '1px solid rgba(112,115,124,0.22)', borderRadius: '14px', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', minWidth: '860px' }}>
                    <thead>
                      <tr>
                        <th style={TH}>사용자</th>
                        <th style={TH}>역할</th>
                        <th style={TH}>발주처 조직 ID</th>
                        <th style={TH}>가입일</th>
                        <th style={TH}>최근 로그인</th>
                        <th style={{ ...TH, textAlign: 'center' }}>승인 상태</th>
                        <th style={{ ...TH, textAlign: 'right' }}>액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersAdmin.users.map((u: AdminUserRow) => {
                        const badge = APPROVAL_BADGE[u.approvalStatus];
                        const isSelf = u.uid === user?.uid;
                        return (
                          <tr key={u.uid} className="iw-table-row" style={{ background: u.approvalStatus === 'pending' ? '#FFFDF7' : '#FFFFFF' }}>
                            <td style={{ padding: '10px 16px', borderBottom: TD_BORDER, whiteSpace: 'nowrap' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ width: '30px', height: '30px', borderRadius: '999px', background: '#0D3B8F', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>{(u.displayName || u.email || '?')[0]}</span>
                                <span>
                                  <span style={{ display: 'block', fontWeight: 600, color: '#071A3E' }}>{u.displayName || '(이름 없음)'}{isSelf && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#9AA3B8', fontWeight: 700 }}>나</span>}</span>
                                  <span style={{ display: 'block', fontSize: '12px', color: '#9AA3B8' }}>{u.email}</span>
                                </span>
                              </span>
                            </td>
                            <td style={{ padding: '10px 16px', borderBottom: TD_BORDER }}>
                              <select
                                value={u.role}
                                disabled={isSelf}
                                onChange={(e) => void patchUser(u.uid, { role: e.target.value, ...(e.target.value !== 'client' ? { clientOrgId: null } : {}) })}
                                style={{ padding: '7px 10px', border: '1px solid rgba(112,115,124,0.28)', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', background: '#FFFFFF', color: '#1B2437', outline: 'none', cursor: isSelf ? 'not-allowed' : 'pointer', opacity: isSelf ? 0.55 : 1 }}
                              >
                                <option value="user">일반 이용자</option>
                                <option value="client">발주처</option>
                                <option value="admin">관리자</option>
                              </select>
                            </td>
                            <td style={{ padding: '10px 16px', borderBottom: TD_BORDER }}>
                              {u.role === 'client' ? (
                                <input
                                  type="text"
                                  value={orgDrafts[u.uid] ?? u.clientOrgId ?? ''}
                                  placeholder="예: org-demo-client"
                                  onChange={(e) => setOrgDrafts((d) => ({ ...d, [u.uid]: e.target.value }))}
                                  onBlur={() => {
                                    const v = (orgDrafts[u.uid] ?? '').trim();
                                    if (v && v !== (u.clientOrgId ?? '')) void patchUser(u.uid, { clientOrgId: v });
                                  }}
                                  className="iw-input-admin"
                                  style={{ width: '160px', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid rgba(112,115,124,0.28)', borderRadius: '8px', fontSize: '12.5px', fontFamily: 'inherit', background: '#FFFFFF', color: '#1B2437', outline: 'none' }}
                                />
                              ) : (
                                <span style={{ color: '#C3CBDA' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 16px', color: '#5A6478', borderBottom: TD_BORDER, whiteSpace: 'nowrap' }}>{tsLabel(u.createdAt)}</td>
                            <td style={{ padding: '10px 16px', color: '#5A6478', borderBottom: TD_BORDER, whiteSpace: 'nowrap' }}>{tsLabel(u.lastLoginAt)}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'center', borderBottom: TD_BORDER }}>
                              <span style={{ background: badge.bg, color: badge.color, borderRadius: '999px', padding: '4px 12px', fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>{badge.label}</span>
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', borderBottom: TD_BORDER, whiteSpace: 'nowrap' }}>
                              {isSelf ? (
                                <span style={{ fontSize: '12px', color: '#C3CBDA' }}>본인 계정</span>
                              ) : (
                                <>
                                  {u.approvalStatus !== 'approved' && (
                                    <button onClick={() => void patchUser(u.uid, { approvalStatus: 'approved' })} className="iw-btn-primary" style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '7px 16px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginLeft: '6px' }}>승인</button>
                                  )}
                                  {u.approvalStatus === 'pending' && (
                                    <button onClick={() => void patchUser(u.uid, { approvalStatus: 'rejected' })} className="iw-text-delete" style={{ border: '1px solid rgba(112,115,124,0.28)', background: '#FFFFFF', color: '#5A6478', borderRadius: '999px', padding: '7px 16px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginLeft: '6px' }}>거절</button>
                                  )}
                                  {u.approvalStatus === 'approved' && (
                                    <button onClick={() => void patchUser(u.uid, { approvalStatus: 'rejected' })} className="iw-text-delete" style={{ border: 'none', background: 'transparent', color: '#9AA3B8', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginLeft: '6px' }}>이용 제한</button>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {usersAdmin.users.length === 0 && (
                        <tr><td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', color: '#9AA3B8' }}>가입한 사용자가 없습니다.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {s.adminTab === '고객문의' && (
          <>
            <h1 style={{ margin: '0 0 6px', fontSize: '21px', fontWeight: 800, color: '#071A3E' }}>고객문의</h1>
            <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: '#5A6478' }}>홈페이지로 접수된 상담 문의입니다. 상태를 바꾸면 목록 정렬에 반영됩니다.</p>

            {inquiryMutError && <Notice tone="error">{inquiryMutError}</Notice>}
            {inquiriesAdmin.loading && <Loading label="문의 목록을 불러오는 중…" />}
            {inquiriesAdmin.error && <Notice tone="error">{inquiriesAdmin.error}</Notice>}

            {!inquiriesAdmin.loading && !inquiriesAdmin.error && (
              inquiriesAdmin.inquiries.length === 0 ? (
                <div style={{ background: '#FFFFFF', border: '1px solid rgba(112,115,124,0.22)', borderRadius: '14px', padding: '48px 24px', textAlign: 'center', color: '#9AA3B8', fontSize: '14px' }}>접수된 문의가 없습니다.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {inquiriesAdmin.inquiries.map((iq) => {
                    const badge = INQUIRY_BADGE[iq.status];
                    return (
                      <div key={iq.id} style={{ background: iq.status === 'new' ? '#FFFDF7' : '#FFFFFF', border: '1px solid rgba(112,115,124,0.22)', borderRadius: '14px', padding: '18px 22px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: '#071A3E' }}>{iq.name}</span>
                          {iq.organization && <span style={{ background: '#EEF1F6', color: '#5A6478', borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700 }}>{iq.organization}</span>}
                          {iq.eventType && <span style={{ background: '#E5F0FF', color: '#1463F3', borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700 }}>{iq.eventType}</span>}
                          {iq.budgetRange && iq.budgetRange !== '미정' && <span style={{ background: '#DCF3F8', color: '#0C7A93', borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700 }}>{iq.budgetRange}</span>}
                          <span style={{ marginLeft: 'auto', background: badge.bg, color: badge.color, borderRadius: '999px', padding: '4px 12px', fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>{badge.label}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '13px', marginBottom: '10px' }}>
                          <ContactLink contact={iq.contact} />
                          <span style={{ color: '#9AA3B8' }}>접수일 {tsLabel(iq.createdAt)}</span>
                        </div>
                        <p style={{ margin: '0 0 14px', fontSize: '13.5px', lineHeight: 1.6, color: '#3A4358', whiteSpace: 'pre-wrap' }}>{iq.message}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'inline-flex', gap: '3px', background: '#EEF1F6', borderRadius: '999px', padding: '3px' }}>
                            {INQUIRY_OPTS.map(([id, label, activeBg]) => (
                              <button key={id} onClick={() => void patchInquiry(iq.id, { status: id })} style={{ border: 'none', cursor: 'pointer', borderRadius: '999px', padding: '7px 15px', fontSize: '12.5px', fontWeight: 700, fontFamily: 'inherit', transition: 'all .16s', background: iq.status === id ? activeBg : 'transparent', color: iq.status === id ? '#FFFFFF' : '#5A6478' }}>{label}</button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={memoDrafts[iq.id] ?? iq.memo}
                            placeholder="내부 메모 (고객에게 보이지 않음)"
                            onChange={(e) => setMemoDrafts((d) => ({ ...d, [iq.id]: e.target.value }))}
                            onBlur={() => {
                              const v = memoDrafts[iq.id];
                              if (v !== undefined && v !== iq.memo) void patchInquiry(iq.id, { memo: v });
                            }}
                            className="iw-input-admin"
                            style={{ flex: 1, minWidth: '200px', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid rgba(112,115,124,0.28)', borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', background: '#FFFFFF', color: '#1B2437', outline: 'none' }}
                          />
                          <button onClick={() => void removeInquiry(iq.id)} className="iw-text-delete" style={{ border: 'none', background: 'transparent', color: '#9AA3B8', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 6px' }}>삭제</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </>
        )}

        {s.adminTab === '레이트카드' && (
          <>
            <h1 style={{ margin: '0 0 20px', fontSize: '21px', fontWeight: 800, color: '#071A3E' }}>레이트카드 관리</h1>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '180px', maxWidth: '280px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9AA3B8" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input type="text" placeholder="항목명 검색" value={s.adminQuery} onChange={(e) => set({ adminQuery: e.target.value })} className="iw-input-admin" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 34px', border: '1px solid rgba(112,115,124,0.28)', borderRadius: '10px', fontSize: '13.5px', fontFamily: 'inherit', background: '#FFFFFF', color: '#1B2437', outline: 'none' }} />
              </div>
              <select value={s.adminCat} onChange={(e) => set({ adminCat: e.target.value })} style={{ padding: '9px 12px', border: '1px solid rgba(112,115,124,0.28)', borderRadius: '10px', fontSize: '13.5px', fontFamily: 'inherit', background: '#FFFFFF', color: '#1B2437', outline: 'none', cursor: 'pointer' }}>
                <option>전체 카테고리</option>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
              <button onClick={openAdd} className="iw-btn-primary" style={{ marginLeft: 'auto', background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '10px 22px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>＋ 항목 추가</button>
            </div>

            {rateMutError && <Notice tone="error">{rateMutError}</Notice>}
            {rate.loading && <Loading label="레이트카드를 불러오는 중…" />}
            {rate.error && <Notice tone="error">{rate.error}</Notice>}

            {!rate.loading && !rate.error && (
              <div style={{ background: '#FFFFFF', border: '1px solid rgba(112,115,124,0.22)', borderRadius: '14px', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', maxHeight: '560px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', minWidth: '760px' }}>
                    <thead>
                      <tr>
                        <th style={TH_STICKY}>항목명</th>
                        <th style={TH_STICKY}>카테고리</th>
                        <th style={TH_STICKY}>단위</th>
                        <th style={{ ...TH_STICKY, textAlign: 'right' }}>표준 단가</th>
                        <th style={{ ...TH_STICKY, textAlign: 'right' }}>마진율</th>
                        <th style={{ ...TH_STICKY, textAlign: 'center' }}>활성</th>
                        <th style={{ ...TH_STICKY, textAlign: 'right' }}>액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((r) => (
                        <tr key={r.id ?? r.itemName} className="iw-table-row" style={{ background: '#FFFFFF', opacity: r.isActive ? 1 : 0.5 }}>
                          <td style={{ padding: '11px 16px', fontWeight: 600, color: '#071A3E', borderBottom: TD_BORDER, whiteSpace: 'nowrap' }}>{r.itemName}</td>
                          <td style={{ padding: '11px 16px', borderBottom: TD_BORDER }}><span style={{ background: '#EEF1F6', color: '#5A6478', borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.category}</span></td>
                          <td style={{ padding: '11px 16px', color: '#5A6478', borderBottom: TD_BORDER, whiteSpace: 'nowrap' }}>{r.unit}</td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: GROTESK, fontWeight: 600, color: '#071A3E', borderBottom: TD_BORDER, whiteSpace: 'nowrap' }}>{r.unitPrice.toLocaleString('ko-KR')}원</td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: GROTESK, color: '#3A4358', borderBottom: TD_BORDER }}>{r.marginRate}%</td>
                          <td style={{ padding: '11px 16px', textAlign: 'center', borderBottom: TD_BORDER }}>
                            <Toggle on={r.isActive} onClick={() => { void toggleCard(r); }} />
                          </td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', borderBottom: TD_BORDER, whiteSpace: 'nowrap' }}>
                            <button onClick={() => openEdit(r)} style={{ border: 'none', background: 'transparent', color: '#1463F3', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 6px' }}>수정</button>
                            <button onClick={() => { void deleteCard(r); }} className="iw-text-delete" style={{ border: 'none', background: 'transparent', color: '#9AA3B8', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 6px' }}>삭제</button>
                          </td>
                        </tr>
                      ))}
                      {pageRows.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', color: '#9AA3B8', fontSize: '13.5px' }}>조건에 맞는 항목이 없습니다</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid rgba(112,115,124,0.22)', fontSize: '12.5px', color: '#5A6478', flexWrap: 'wrap', gap: '10px' }}>
                  <span>총 <span style={{ fontFamily: GROTESK, fontWeight: 700, color: '#071A3E' }}>{rate.cards.length}</span>개 항목 중 <span style={{ fontFamily: GROTESK, fontWeight: 700, color: '#071A3E' }}>{filtered.length}</span>개 표시</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => setPage(Math.max(1, curPage - 1))} disabled={curPage <= 1} style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid rgba(112,115,124,0.22)', background: '#FFFFFF', cursor: curPage <= 1 ? 'default' : 'pointer', color: '#9AA3B8', fontFamily: 'inherit', opacity: curPage <= 1 ? 0.5 : 1 }}>‹</button>
                    {pageNums.map((n) => (
                      <button key={n} onClick={() => setPage(n)} style={n === curPage
                        ? { width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: '#1463F3', color: '#FFFFFF', cursor: 'pointer', fontWeight: 700, fontFamily: GROTESK }
                        : { width: '28px', height: '28px', borderRadius: '8px', border: '1px solid rgba(112,115,124,0.22)', background: '#FFFFFF', cursor: 'pointer', color: '#5A6478', fontFamily: GROTESK }}>{n}</button>
                    ))}
                    <button onClick={() => setPage(Math.min(pageCount, curPage + 1))} disabled={curPage >= pageCount} style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid rgba(112,115,124,0.22)', background: '#FFFFFF', cursor: curPage >= pageCount ? 'default' : 'pointer', color: '#5A6478', fontFamily: 'inherit', opacity: curPage >= pageCount ? 0.5 : 1 }}>›</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {s.adminTab === '인력풀' && (
          <>
            <h1 style={{ margin: '0 0 20px', fontSize: '21px', fontWeight: 800, color: '#071A3E' }}>인력풀 관리</h1>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
              <select value={s.poolRole} onChange={(e) => set({ poolRole: e.target.value })} style={{ padding: '9px 12px', border: '1px solid rgba(112,115,124,0.28)', borderRadius: '10px', fontSize: '13.5px', fontFamily: 'inherit', background: '#FFFFFF', color: '#1B2437', outline: 'none', cursor: 'pointer' }}>
                <option>전체 역할</option><option>강사</option><option>멘토</option><option>심사위원</option><option>운영인력</option>
              </select>
              <button className="iw-btn-primary" style={{ marginLeft: 'auto', background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '10px 22px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>＋ 인력 등록</button>
            </div>

            {poolMutError && <Notice tone="error">{poolMutError}</Notice>}
            {pool.loading && <Loading label="인력풀을 불러오는 중…" />}
            {pool.error && <Notice tone="error">{pool.error}</Notice>}

            {!pool.loading && !pool.error && (
              <div style={{ background: '#FFFFFF', border: '1px solid rgba(112,115,124,0.22)', borderRadius: '14px', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', minWidth: '720px' }}>
                    <thead>
                      <tr>
                        <th style={TH}>이름</th>
                        <th style={TH}>역할</th>
                        <th style={TH}>전문 분야</th>
                        <th style={TH}>활동 지역</th>
                        <th style={{ ...TH, textAlign: 'right' }}>평점</th>
                        <th style={{ ...TH, textAlign: 'right' }}>참여 횟수</th>
                        <th style={{ ...TH, textAlign: 'center' }}>활성</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pool.people.map((p) => (
                        <tr key={p.id ?? p.name} className="iw-table-row" style={{ background: '#FFFFFF', opacity: p.isActive ? 1 : 0.5 }}>
                          <td style={{ padding: '10px 16px', borderBottom: TD_BORDER, whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', fontWeight: 600, color: '#071A3E' }}>
                              <span style={{ width: '28px', height: '28px', borderRadius: '999px', background: '#0D3B8F', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>{p.name[0]}</span>
                              {p.name}
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px', borderBottom: TD_BORDER }}><span style={{ background: '#E5F0FF', color: '#1463F3', borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>{p.role}</span></td>
                          <td style={{ padding: '10px 16px', color: '#3A4358', borderBottom: TD_BORDER }}>{p.expertiseField}</td>
                          <td style={{ padding: '10px 16px', color: '#5A6478', borderBottom: TD_BORDER, whiteSpace: 'nowrap' }}>{p.activityRegion}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', borderBottom: TD_BORDER, whiteSpace: 'nowrap' }}>
                            <span style={{ color: '#F5A623', fontWeight: 700 }}>★</span> <span style={{ fontFamily: GROTESK, fontWeight: 600, color: '#071A3E' }}>{p.rating.toFixed(1)}</span>
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: GROTESK, color: '#3A4358', borderBottom: TD_BORDER }}>{p.eventExperienceCount}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'center', borderBottom: TD_BORDER }}>
                            <Toggle on={p.isActive} onClick={() => { void togglePerson(p.id, p.isActive); }} />
                          </td>
                        </tr>
                      ))}
                      {pool.people.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', color: '#9AA3B8', fontSize: '13.5px' }}>등록된 인력이 없습니다</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {s.adminTab === '케이스 데이터' && (
          <>
            <h1 style={{ margin: '0 0 6px', fontSize: '21px', fontWeight: 800, color: '#071A3E' }}>케이스 데이터</h1>
            <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: '#5A6478' }}>AI 기획·견적 추천의 근거가 되는 과거 운영 사례입니다.</p>

            {caseData.loading && <Loading label="케이스 데이터를 불러오는 중…" />}
            {caseData.error && <Notice tone="error">{caseData.error}</Notice>}

            {!caseData.loading && !caseData.error && (
              <div style={{ background: '#FFFFFF', border: '1px solid rgba(112,115,124,0.22)', borderRadius: '14px', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', maxHeight: '640px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', minWidth: '760px' }}>
                    <thead>
                      <tr>
                        <th style={TH_STICKY}>행사명</th>
                        <th style={TH_STICKY}>유형</th>
                        <th style={TH_STICKY}>발주처</th>
                        <th style={{ ...TH_STICKY, textAlign: 'right' }}>규모</th>
                        <th style={{ ...TH_STICKY, textAlign: 'right' }}>총예산</th>
                        <th style={{ ...TH_STICKY, textAlign: 'right' }}>연도</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caseData.cases.map((cw) => (
                        <tr key={cw.id} className="iw-table-row" style={{ background: '#FFFFFF' }}>
                          <td style={{ padding: '11px 16px', fontWeight: 600, color: '#071A3E', borderBottom: TD_BORDER }}>{cw.eventName}</td>
                          <td style={{ padding: '11px 16px', borderBottom: TD_BORDER }}><span style={{ background: '#EEF1F6', color: '#5A6478', borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>{cw.eventType}</span></td>
                          <td style={{ padding: '11px 16px', color: '#3A4358', borderBottom: TD_BORDER, whiteSpace: 'nowrap' }}>{cw.organizer}</td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', color: '#3A4358', borderBottom: TD_BORDER, whiteSpace: 'nowrap' }}>{cw.participantScale.toLocaleString('ko-KR')}명</td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, color: '#071A3E', borderBottom: TD_BORDER, whiteSpace: 'nowrap' }}>{wonLabel(cw.budgetTotal)}</td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: GROTESK, color: '#5A6478', borderBottom: TD_BORDER }}>{cw.periodStart?.slice(0, 4) || '-'}</td>
                        </tr>
                      ))}
                      {caseData.cases.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: '#9AA3B8', fontSize: '13.5px' }}>케이스 데이터가 없습니다</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {s.adminTab === '진행현황 관리' && (
          <>
            <h1 style={{ margin: '0 0 6px', fontSize: '21px', fontWeight: 800, color: '#071A3E' }}>진행현황 관리</h1>
            <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: '#5A6478' }}>수행사가 입력한 진행 상황과 발주처 대시보드 게시 상태를 확인합니다.</p>

            {myEvents.loading && <Loading label="프로젝트 진행현황을 불러오는 중…" />}
            {myEvents.error && <Notice tone="error">{myEvents.error}</Notice>}

            {!myEvents.loading && !myEvents.error && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {opsEvents.map((ev) => (
                  <div key={ev.id} style={{ background: '#FFFFFF', border: '1px solid rgba(112,115,124,0.22)', borderRadius: '14px', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#071A3E' }}>{ev.basicInfo.name}</span>
                        <span style={{ background: '#E6F7EC', color: '#1B8A4B', borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700 }}>게시됨</span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#5A6478', marginTop: '4px' }}>발주처 {ev.basicInfo.organizer} · 최근 업데이트 {tsLabel(ev.updatedAt)}</div>
                    </div>
                    <div style={{ width: '180px', flexShrink: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#5A6478', marginBottom: '4px' }}>
                        <span>진행률</span>
                        <span style={{ fontFamily: GROTESK, fontWeight: 700, color: '#1463F3' }}>{ev.progressSummary?.rate ?? 0}%</span>
                      </div>
                      <div style={{ height: '6px', background: '#EEF1F6', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${ev.progressSummary?.rate ?? 0}%`, height: '100%', borderRadius: '999px', background: '#1463F3' }} />
                      </div>
                    </div>
                    <button onClick={() => { set({ currentEventId: ev.id }); go('dashboard'); }} className="iw-btn-outline-blue" style={{ border: '1px solid rgba(20,99,243,0.4)', background: '#FFFFFF', color: '#1463F3', borderRadius: '999px', padding: '9px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>발주처 화면 보기</button>
                  </div>
                ))}
                {opsEvents.length === 0 && (
                  <Notice tone="info">진행 현황이 입력된 프로젝트가 없습니다.</Notice>
                )}
              </div>
            )}
          </>
        )}

        {s.adminTab === '견적 파라미터' && (
          <>
            <h1 style={{ margin: '0 0 6px', fontSize: '21px', fontWeight: 800, color: '#071A3E' }}>견적 파라미터</h1>
            <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: '#5A6478' }}>모든 신규 견적 산출에 적용되는 전역 계수입니다. 변경 즉시 견적 화면에 반영됩니다.</p>

            {qpLoading && <Loading label="견적 파라미터를 불러오는 중…" />}
            {!qpLoading && !qpAvailable && (
              <Notice tone="info">견적 파라미터는 관리자 전용입니다. admin 권한으로 로그인하면 조회·수정할 수 있어요.</Notice>
            )}

            {!qpLoading && (
              <div style={{ maxWidth: '560px', background: '#FFFFFF', border: '1px solid rgba(112,115,124,0.22)', borderRadius: '14px', padding: '26px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={ADMIN_LABEL_STYLE}>기본 마진율 (%)</label>
                    <input type="number" min={0} max={50} step={0.5} value={qp.margin} onChange={(e) => { setQp((v) => ({ ...v, margin: e.target.value })); setQpSaved(false); }} className="iw-input-admin" style={{ ...ADMIN_INPUT_STYLE, fontFamily: GROTESK }} />
                  </div>
                  <div>
                    <label style={ADMIN_LABEL_STYLE}>부가세율 (%)</label>
                    <input type="number" min={0} max={20} step={0.5} value={qp.vat} onChange={(e) => { setQp((v) => ({ ...v, vat: e.target.value })); setQpSaved(false); }} className="iw-input-admin" style={{ ...ADMIN_INPUT_STYLE, fontFamily: GROTESK }} />
                  </div>
                  <div>
                    <label style={ADMIN_LABEL_STYLE}>Basic 구성 배율</label>
                    <input type="number" min={0.5} max={1} step={0.01} value={qp.basic} onChange={(e) => { setQp((v) => ({ ...v, basic: e.target.value })); setQpSaved(false); }} className="iw-input-admin" style={{ ...ADMIN_INPUT_STYLE, fontFamily: GROTESK }} />
                  </div>
                  <div>
                    <label style={ADMIN_LABEL_STYLE}>Premium 구성 배율</label>
                    <input type="number" min={1} max={2} step={0.01} value={qp.premium} onChange={(e) => { setQp((v) => ({ ...v, premium: e.target.value })); setQpSaved(false); }} className="iw-input-admin" style={{ ...ADMIN_INPUT_STYLE, fontFamily: GROTESK }} />
                  </div>
                </div>
                <div style={{ background: '#F7F9FC', border: '1px solid rgba(112,115,124,0.18)', borderRadius: '10px', padding: '11px 13px', fontSize: '12.5px', lineHeight: 1.55, color: '#5A6478' }}>
                  Standard 배율은 1.00으로 고정됩니다. 배율은 예산 한도 대비 구성 규모를 결정합니다.
                </div>
                {qpError && <Notice tone="error">{qpError}</Notice>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <button onClick={() => { void saveQp(); }} disabled={!qpAvailable || qpSaving} className="iw-btn-primary" style={{ background: qpAvailable ? '#1463F3' : '#B9C6E4', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '11px 28px', fontSize: '14px', fontWeight: 700, cursor: qpAvailable && !qpSaving ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>{qpSaving ? '저장 중…' : '저장'}</button>
                  {qpSaved && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: 700, color: '#1B8A4B' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      저장되었습니다 — 견적 화면에 적용 중
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* 항목 추가/수정 슬라이드 패널 */}
      {panel.open && (
        <>
          <div onClick={() => setPanel(PANEL_CLOSED)} style={{ position: 'fixed', inset: 0, background: 'rgba(7,26,62,0.35)', zIndex: 1100 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(420px,100vw)', background: '#FFFFFF', zIndex: 1101, boxShadow: '-16px 0 48px rgba(7,26,62,0.2)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 26px', borderBottom: '1px solid rgba(112,115,124,0.22)' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#071A3E' }}>{panel.editId ? '항목 수정' : '항목 추가'}</h2>
              <button onClick={() => setPanel(PANEL_CLOSED)} title="닫기" className="iw-btn-close" style={{ width: '32px', height: '32px', borderRadius: '999px', border: 'none', background: '#EEF1F6', color: '#5A6478', cursor: 'pointer', fontSize: '14px', lineHeight: 1, fontFamily: 'inherit' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={ADMIN_LABEL_STYLE}>항목명 <span style={{ color: '#E5484D' }}>*</span></label>
                <input type="text" value={panel.name} onChange={(e) => setPanel((p) => ({ ...p, name: e.target.value }))} placeholder="예: 대관료 (메인홀, 500석)" className="iw-input-admin" style={ADMIN_INPUT_STYLE} />
              </div>
              <div>
                <label style={ADMIN_LABEL_STYLE}>카테고리</label>
                <select value={panel.cat} onChange={(e) => setPanel((p) => ({ ...p, cat: e.target.value }))} style={{ ...ADMIN_INPUT_STYLE, cursor: 'pointer' }}>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={ADMIN_LABEL_STYLE}>단위 <span style={{ color: '#E5484D' }}>*</span></label>
                  <input type="text" value={panel.unit} onChange={(e) => setPanel((p) => ({ ...p, unit: e.target.value }))} placeholder="예: 일, 인, 식" className="iw-input-admin" style={ADMIN_INPUT_STYLE} />
                </div>
                <div>
                  <label style={ADMIN_LABEL_STYLE}>마진율 (%)</label>
                  <input type="number" min={0} max={50} value={panel.margin} onChange={(e) => setPanel((p) => ({ ...p, margin: e.target.value }))} className="iw-input-admin" style={{ ...ADMIN_INPUT_STYLE, fontFamily: GROTESK }} />
                </div>
              </div>
              <div>
                <label style={ADMIN_LABEL_STYLE}>표준 단가 (원) <span style={{ color: '#E5484D' }}>*</span></label>
                <input type="number" min={0} step={100} value={panel.price} onChange={(e) => setPanel((p) => ({ ...p, price: e.target.value }))} placeholder="0" className="iw-input-admin" style={{ ...ADMIN_INPUT_STYLE, fontFamily: GROTESK }} />
              </div>
              <div style={{ background: '#F7F9FC', border: '1px solid rgba(112,115,124,0.18)', borderRadius: '10px', padding: '11px 13px', fontSize: '12.5px', lineHeight: 1.55, color: '#5A6478' }}>
                단가와 마진율은 견적 산출에 즉시 반영됩니다. 진행 중인 프로젝트의 확정 견적에는 영향을 주지 않습니다.
              </div>
              {panel.error && <Notice tone="error">{panel.error}</Notice>}
            </div>
            <div style={{ display: 'flex', gap: '10px', padding: '18px 26px', borderTop: '1px solid rgba(112,115,124,0.22)' }}>
              <button onClick={() => setPanel(PANEL_CLOSED)} className="iw-btn-soft" style={{ flex: 1, background: 'transparent', color: '#5A6478', border: '1px solid rgba(112,115,124,0.28)', borderRadius: '999px', padding: '12px 0', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
              <button onClick={() => { void savePanel(); }} style={{ flex: 2, background: panelValid && !panel.saving ? '#1463F3' : '#B9C6E4', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '12px 0', fontSize: '14px', fontWeight: 700, cursor: panelValid && !panel.saving ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'background .16s' }}>{panel.saving ? '저장 중…' : panel.editId ? '변경 사항 저장' : '항목 추가'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
