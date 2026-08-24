/**
 * /showcase 시연 전용 — 고정 산출물(과업지시서 · 운영제안서 · 견적서) 렌더링
 * 김유환 교수 시연 시나리오: 메모 → AI 생성 애니메이션 → 아래 두 문서를 그대로 노출한다.
 * 문서 내용은 실제 발주 자료(과업지시서 원문 · 운영계획안 원문 · 견적서 원문)를 그대로 옮긴 고정 상수이며,
 * AI 호출 없이 데모용으로만 사용한다.
 */
import type { CSSProperties, ReactNode } from 'react';
import { GROTESK } from '../components.js';

/* ── 문서 타이포그래피 (WorkflowDocs.tsx 패턴과 동일) ───────── */

export const H1: CSSProperties = { margin: '26px 0 10px', fontSize: '17px', fontWeight: 800, color: '#071A3E', borderBottom: '2px solid #0D3B8F', paddingBottom: '6px' };
export const H2: CSSProperties = { margin: '16px 0 8px', fontSize: '14px', fontWeight: 800, color: '#0D3B8F' };
export const P: CSSProperties = { margin: '0 0 8px', fontSize: '13px', lineHeight: 1.7, color: '#1B2437' };
export const NOTE: CSSProperties = { margin: '0 0 8px', fontSize: '12px', lineHeight: 1.65, color: '#9AA3B8' };
export const TH: CSSProperties = { border: '1px solid rgba(13,59,143,0.25)', background: '#EEF3FC', padding: '7px 10px', fontSize: '12px', fontWeight: 700, color: '#0D3B8F', textAlign: 'left' };
export const TD: CSSProperties = { border: '1px solid rgba(13,59,143,0.18)', padding: '7px 10px', fontSize: '12.5px', color: '#1B2437', lineHeight: 1.55, verticalAlign: 'top' };
export const TABLE: CSSProperties = { width: '100%', borderCollapse: 'collapse', margin: '6px 0 12px' };

export function Bullets({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <ul style={{ margin: '0 0 10px', paddingLeft: '18px' }}>
      {items.map((t) => <li key={t} style={{ fontSize: '13px', lineHeight: 1.7, color: '#1B2437' }}>{t}</li>)}
    </ul>
  );
}

/** 표 셀 안에 줄바꿈된 여러 문장을 쌓아 보여준다 (본문 서식과 동일한 원문 문장 유지) */
export function Lines({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {items.map((t) => <span key={t}>{t}</span>)}
    </div>
  );
}

export function DocTable({ cols, widths, rows }: { cols: string[]; widths?: (string | undefined)[]; rows: ReactNode[][] }) {
  return (
    <table style={TABLE}>
      <thead>
        <tr>
          {cols.map((c, i) => <th key={c} style={{ ...TH, ...(widths?.[i] ? { width: widths[i] } : {}) }}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => <td key={j} style={TD}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 라벨 : 값 형태의 단락 (예: "1. 과업명 : 2026 SNU-SH DEMO DAY 운영 용역") */
function LabelLine({ n, label, value }: { n: string; label: string; value?: string }) {
  return (
    <p style={P}><b style={{ color: '#071A3E' }}>{n}. {label}</b>{value ? ` : ${value}` : ''}</p>
  );
}

function DocBadge({ children, tone }: { children: ReactNode; tone: 'memo' | 'ai' }) {
  const palette = tone === 'memo'
    ? { bg: '#F0F2F6', color: '#5A6478' }
    : { bg: '#E5F0FF', color: '#0D3B8F' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: palette.bg, color: palette.color, borderRadius: '999px', padding: '5px 13px', fontSize: '11.5px', fontWeight: 700 }}>
      {tone === 'ai' && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={palette.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" /></svg>
      )}
      {children}
    </span>
  );
}

/* ── 과업지시서 ────────────────────────────────────────────── */

export function SowDocument() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}><DocBadge tone="ai">AI 생성 문서</DocBadge></div>
      <div style={{ textAlign: 'center', padding: '30px 0 26px', borderBottom: '3px solid #0D3B8F', marginBottom: '10px' }}>
        <div style={{ fontSize: '12.5px', color: '#5A6478', marginBottom: '10px' }}>2026년 예비창업패키지 투자 프로그램 · 2026 SNU-SH DEMO DAY 운영 용역</div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0D3B8F', letterSpacing: '0.35em', marginBottom: '14px' }}>과 업 지 시 서</div>
        <div style={{ fontSize: '12.5px', color: '#5A6478' }}>2026. 8. · 서울대학교 시흥캠퍼스본부 (예비창업패키지 주관기관)</div>
      </div>

      <h2 style={H1}>Ⅰ. 과업 개요</h2>
      <LabelLine n="1" label="과 업 명" value="2026 SNU-SH DEMO DAY 운영 용역 (2026년 예비창업패키지 투자 프로그램)" />
      <div style={H2}>2. 과업목적</div>
      <Bullets items={[
        '❍  예비창업패키지 선정기업의 투자유치 역량을 단계적으로 제고하고, 투자자 관점의 IR 커뮤니케이션 체계를 내재화하고자 함',
        '❍  기업별 IR 피치덱을 투자심사 기준에 부합하는 수준으로 고도화하여 사업 종료 이후에도 활용 가능한 투자유치 자산을 확보하고자 함',
        '❍  데모데이 실전 피칭을 통해 투자심사역과의 직접 접점을 마련하고, 후속 투자검토 및 지속적 네트워크 형성의 기반을 조성하고자 함',
      ]} />
      <LabelLine n="3" label="과업기간" value="계약체결일로부터 ~ 2026. 12. 31. (결과보고 및 정산 기간 포함)" />
      <p style={NOTE}>※ 상기 일정은 예비창업패키지 사업 일정 및 주관기관 사정에 따라 조정 가능</p>
      <LabelLine n="4" label="과업대상" value="2026년 예비창업패키지 선정기업 6개사" />
      <p style={NOTE}>※ 선정기업 수는 주관기관 최종 선정 결과에 따라 변동될 수 있으며, 변동 시 상호 협의하여 과업범위를 조정한다.</p>
      <LabelLine n="5" label="과업예산" value="금 23,800,000원 (금이천삼백팔십만원정) [VAT 포함]" />
      <p style={NOTE}>※ 교육 강사비는 주관기관이 전문가활용비로 직접 집행하며, 본 과업예산에서 제외한다.</p>
      <p style={NOTE}>※ 교육 프로그램 운영 시 다과는 주관기관이 직접 준비하며, 데모데이 당일 케이터링은 본 과업에 포함한다.</p>
      <LabelLine n="6" label="계약방법" value="수의계약 (여성기업 우대)" />
      <p style={NOTE}>※ 「중소기업제품 구매촉진 및 판로지원에 관한 법률」 및 본교 계약 규정에 따르며, 계약 시 여성기업 확인서를 제출하여야 한다.</p>
      <LabelLine n="7" label="대금지급" value="과업 완료 및 결과보고서 검수 완료 후 잔금 100% 지급" />
      <p style={NOTE}>※ 필요 시 상호 협의하여 선금 지급이 가능하며, 이 경우 관련 규정에 따른 보증서를 제출하여야 한다.</p>
      <div style={H2}>8. 과업내용 총괄표</div>
      <DocTable
        cols={['구분', '내용']}
        widths={['140px']}
        rows={[
          ['사전 역량강화', <Lines key="a" items={['투자유치 기초교육 2회차 운영 지원', 'IR 피치덱 제작 지원 (6개사, 기업별 개별 지원)']} />],
          ['데모데이 운영', <Lines key="b" items={['SNU-SH DEMO DAY 기획·운영 총괄', '투자심사역 심사단 구성, 무대·음향·홍보물 등 현장 운영 일체']} />],
          ['과업 보고', <Lines key="c" items={['착수계(과업수행계획서) 및 결과보고서 제출', '운영 증빙자료(사진·서명부·만족도조사 결과 등) 일체 제출']} />],
        ]}
      />

      <h2 style={H1}>Ⅱ. 과업 내용</h2>
      <div style={H2}>1. 과업범위</div>
      <Bullets items={[
        '❍  투자유치 기초교육 운영 지원 (교육 기획·운영·참여관리)',
        '❍  선정기업 6개사 IR 피치덱 제작 지원 (기업별 개별 지원)',
        '❍  SNU-SH DEMO DAY 기획·운영 및 현장 연출 일체',
        '❍  투자심사역 심사단 섭외·운영 및 후속 투자검토 연계 지원',
        '❍  홍보물 디자인·제작·설치 및 행사 운영 인력 배치',
        '❍  과업 결과보고 및 정산 증빙 제출',
      ]} />
      <p style={NOTE}>※ 본 과업지시서는 발주처가 요구하는 최소 수준을 규정한 것으로, 세부 실행방안(커리큘럼 구성, 제작 프로세스, 현장 연출 방식 등)은 계약상대자의 제안 및 운영계획(안)에 따르되 발주처와 협의하여 확정한다.</p>

      <div style={H2}>2. 세부 과업내용</div>
      <p style={{ ...P, fontWeight: 700, color: '#071A3E' }}>❍ (1단계) 투자유치 기초교육</p>
      <DocTable
        cols={['구분', '요구사항']}
        widths={['120px']}
        rows={[
          ['운영 규모', '총 2회차, 회차당 3시간 내외 / 선정기업 6개사 전원 필수 참여'],
          ['운영 방식', '온라인 운영을 원칙으로 하며, 발주처 협의 시 집합교육으로 변경 가능'],
          ['교육 내용', <Lines key="a" items={['투자 생태계 및 투자자 관점의 커뮤니케이션에 관한 사항', '표준 IR Deck 구성 논리 및 피칭 전략에 관한 사항', '※ 세부 커리큘럼은 기업 진단 결과를 반영하여 발주처와 협의 후 확정']} />],
          ['강사 기준', <Lines key="b" items={['투자업계(VC·AC 등) 선임심사역급 이상 또는 이에 준하는 전문성 보유자', '※ 강사비는 주관기관이 전문가활용비로 직접 집행 (본 과업예산 제외)']} />],
          ['운영 지원', <Lines key="c" items={['교육 일정 안내·참여 독려, 출결 및 참여현황 관리, 교육자료 배포', '교육 만족도 조사 실시 및 결과 제출']} />],
        ]}
      />
      <p style={{ ...P, fontWeight: 700, color: '#071A3E' }}>❍ (2단계) IR 피치덱 제작 지원</p>
      <DocTable
        cols={['구분', '요구사항']}
        widths={['120px']}
        rows={[
          ['지원 규모', '선정기업 6개사 (기업당 1건)'],
          ['제작 범위', <Lines key="a" items={['기업별 IR 스토리라인 및 자료 구조·배치 설계', '인포그래픽·도식화 등 디자인 및 비주얼 고도화', '데모데이 발표용 최종본 및 발표 리허설 버전 제작']} />],
          ['품질 기준', <Lines key="b" items={['투자심사 목적에 부합하는 구성(문제·솔루션·시장·BM·팀·재무·투자제안 등)을 포함할 것', '원본 편집 가능 파일(PPT 등)과 배포용 파일(PDF)을 함께 납품할 것']} />],
          ['진행 방식', <Lines key="c" items={['기업별 최소 1회 이상 개별 협의(대면 또는 비대면)를 거쳐 초안을 작성하고,', '기업 검토 의견을 반영한 수정 과정을 거쳐 최종본을 확정할 것']} />],
          ['유의사항', '전년도 운영한 IR Deck 전략 컨설팅 과정은 본 과업에서 제외한다.'],
        ]}
      />
      <p style={{ ...P, fontWeight: 700, color: '#071A3E' }}>❍ (3단계) SNU-SH DEMO DAY 운영</p>
      <DocTable
        cols={['구분', '요구사항']}
        widths={['120px']}
        rows={[
          ['개최 시기', '2026년 12월 초 (발주처와 협의하여 확정)'],
          ['개최 장소', '서울대학교 시흥캠퍼스 내 시설을 원칙으로 하며, 발주처와 협의하여 확정'],
          ['행사 진행', <Lines key="a" items={['전문 사회자(MC) 섭외 및 진행', '선정기업 6개사 순차 IR 피칭 및 심사위원 Q&A 운영']} />],
          ['심사·피드백', <Lines key="b" items={['VC·AC·엔젤투자사 등 투자심사역 5인 내외로 심사단 구성', '피칭 심사 및 현장 피드백 제공, 후속 투자검토 연계 지원', '※ 심사위원 명단은 사전에 발주처에 보고하고 승인을 받을 것']} />],
          ['현장 운영', <Lines key="c" items={['무대 연출·좌석 배치·등록데스크 등 행사장 조성 일체', '무선마이크·음향·영상 스위칭 등 콘솔시스템 구성 및 운영', '행사 운영 인력 배치 및 현장 안전·질서 관리']} />],
          ['홍보물', <Lines key="d" items={['키비주얼 및 포스터 디자인', '무대 백월(발표 배경), 현수막, 배너, 명찰, 현판 등 제작·설치']} />],
          ['식음 지원', <Lines key="e" items={['행사 당일 다과(케이터링) 준비', '※ 식사는 제공하지 않음']} />],
          ['기타', '행사 사진 촬영, 참석자 서명부 작성, 만족도 조사 실시 및 결과 제출'],
        ]}
      />

      <div style={H2}>3. 주요 추진일정(안)</div>
      <DocTable
        cols={['단계', '주요 내용', '시기']}
        widths={[undefined, undefined, '90px']}
        rows={[
          ['계약·착수', '용역계약 체결, 착수계 제출, 착수 미팅 및 세부 운영계획 확정', '9월'],
          ['기업 확정·진단', '선정기업 6개사 확정, 기업별 진단 및 교육 커리큘럼 협의·확정', '10월 초'],
          ['투자유치 기초교육', '1·2회차 교육 운영 및 참여관리, 만족도 조사', '10월'],
          ['IR 피치덱 제작 지원', '기업별 스토리라인 설계, 디자인 고도화, 발표용 최종본 확정', '10~11월'],
          ['리허설·데모데이', '발표 리허설 실시 후 SNU-SH DEMO DAY 개최', '12월 초'],
          ['결과보고·정산', '결과보고서 및 증빙자료 제출, 정산', '12월 중'],
        ]}
      />
      <p style={NOTE}>※ 상기 일정은 예비창업패키지 사업 일정에 따라 변동될 수 있으며, 변동 시 발주처와 협의하여 조정한다.</p>

      <h2 style={H1}>Ⅲ. 과업수행 일반사항</h2>
      <ol style={{ margin: '0 0 10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[
          '본 과업지시서는 「2026 SNU-SH DEMO DAY 운영 용역」의 원활한 수행을 위하여 필요한 사항을 규정하며, 모든 과업은 본 과업지시서 및 계약서에 의하여 수행한다. 본 과업지시서에 규정되지 않은 사항은 관계 법령 및 본교 규정에 따르며, 발주처와 협의하여 수행한다.',
          '계약상대자는 계약 체결 후 7일 이내에 과업에 착수하여야 하며, 착수 시 과업수행계획서(착수계), 과업책임자 및 참여인력 명단, 보안각서 등 과업수행에 필요한 제반 서류를 제출하여야 한다.',
          '계약상대자는 신의성실의 원칙에 입각하여 과업을 수행하여야 하며, 과업 목적에 부합하도록 충분한 자료 조사와 검토를 거쳐 성실히 이행하여야 한다.',
          '계약상대자는 과업수행계획서를 기본으로 하되, 세부 실행계획은 발주처와 협의하여 최종 확정한다. 확정된 세부 실행계획을 발주처의 사전 승인 없이 임의로 변경할 수 없다.',
          '계약상대자는 과업 진행상황을 수시로 보고하여야 하며, 각 단계별 과업이 완료되기 전에 그 결과를 발주처에 보고하여야 한다. 보고는 서면 보고를 원칙으로 한다.',
          '행사 일정·장소·심사위원 구성 등 과업의 주요 사항을 결정할 때에는 사전에 발주처와 협의하여 방침을 정하여야 한다.',
          '발주처의 추가 과업 수행 요청이 있을 경우, 전체 사업계획 및 예산에 차질이 없는 범위에서 계약상대자는 이를 수용하여야 한다. 다만 이로 인해 과업 내용에 중대한 변경이 발생할 우려가 있는 경우에는 상호 협의하여 조정한다.',
          '과업책임자 및 담당자가 변경될 때에는 사전에 그 내용을 발주처에 통보하여야 하며, 변경자는 업무 인수인계를 철저히 하여 과업수행의 연속성을 유지하여야 한다.',
          '부득이한 사유로 계약기간 내 과업을 완료하지 못할 것이 예견될 때에는 사전에 발주처와 협의하여야 한다.',
          '본 과업 수행 중 제3자에게 피해를 주었을 경우 계약상대자의 부담으로 손해를 배상하여야 하며, 타인의 저작권·특허권 등을 사용하게 될 경우 그 권리의 사용에 관한 일체의 책임은 계약상대자가 진다.',
          '행사 운영 중 발생할 수 있는 안전사고 예방을 위한 조치를 강구하여야 하며, 사고 발생 시 즉시 발주처에 보고하고 필요한 조치를 취하여야 한다.',
          '과업 내용의 해석에 이견이 있을 때에는 과업의 목적에 부합하는 범위 내에서 발주처의 해석에 따른다.',
        ].map((t) => <li key={t} style={{ fontSize: '13px', lineHeight: 1.7, color: '#1B2437' }}>{t}</li>)}
      </ol>

      <h2 style={H1}>Ⅳ. 보안·지적재산권 및 계약위반에 대한 조치</h2>
      <div style={H2}>1. 보안사항</div>
      <Bullets items={[
        '가. 계약상대자는 보안대책을 수립하고 과업수행계획서와 함께 보안각서를 제출하여야 한다.',
        '나. 본 과업 수행에 따라 취득한 발주처 및 참여기업의 정보(기업 IR 자료, 사업계획, 재무정보, 개인정보 등)는 어떠한 경우에도 타인에게 누설하거나 본 과업 외의 목적으로 사용할 수 없다.',
        '다. 참여기업의 개인정보를 수집·이용하는 경우 「개인정보 보호법」에 따라 동의를 받아야 하며, 과업 종료 후에는 발주처에 이관하거나 파기하고 그 결과를 보고하여야 한다.',
        '라. 보안사항 불이행 또는 과실로 인한 일체의 보안사고에 대한 책임은 계약상대자가 진다.',
      ]} />
      <div style={H2}>2. 소유권 및 지적재산권</div>
      <Bullets items={[
        '가. 본 과업 수행 과정에서 생산된 모든 결과물(보고서, 디자인 원본, 촬영 사진, 운영 자료 등)의 소유권 및 지적재산권은 발주처에 귀속한다.',
        '나. IR 피치덱 등 참여기업별로 제작된 자료는 해당 기업이 자유롭게 활용할 수 있으며, 발주처는 사업 성과 홍보 목적으로 이를 활용할 수 있다.',
        '다. 계약상대자가 과업 성과물을 실적 홍보 등 자사 목적으로 활용하고자 할 경우 사전에 발주처의 승인을 받아야 한다.',
      ]} />
      <div style={H2}>3. 계약위반에 대한 조치</div>
      <p style={P}>발주처는 다음 각 호에 해당하는 경우 계약위반으로 간주하여 계약 해지 등의 조치를 취할 수 있으며, 이로 인해 발주처에 손해가 발생한 경우 계약상대자는 이를 배상하여야 한다.</p>
      <Bullets items={[
        '가. 정당한 사유 없이 착수기일을 경과하고도 과업에 착수하지 아니한 경우',
        '나. 제반 지시사항을 기한 내 이행하지 않았거나 발주처와의 협의 없이 임의로 과업을 진행한 경우',
        '다. 과업 진척이 현저히 미달하거나 계약기간 내 과업을 완료할 능력이 없다고 인정되는 경우',
        '라. 불성실 또는 부주의로 인한 중대한 과실이 인정되어 과업 성과를 기대할 수 없는 경우',
        '마. 제출된 각종 증빙서류가 허위로 작성되었음이 발견된 경우',
      ]} />

      <h2 style={H1}>Ⅴ. 성과물의 납품 및 제출서류</h2>
      <div style={H2}>1. 제출 서류</div>
      <DocTable
        cols={['구분', '제출 시기', '수량', '비고']}
        widths={[undefined, '130px', '60px', undefined]}
        rows={[
          ['착수계(과업수행계획서)', '계약 후 7일 이내', '1부', '참여인력 명단·보안각서 포함'],
          ['중간 진행보고', '단계별 완료 시', '-', '서면 보고 (교육·피치덱 단계)'],
          ['결과보고서', '과업 종료 후 14일 이내', '2부', '인쇄본 및 전자파일 동시 제출'],
          ['정산 증빙자료', '결과보고서 제출 시', '1부', '발주처 요청 서류 일체'],
        ]}
      />
      <div style={H2}>2. 결과보고서 포함 사항</div>
      <Bullets items={[
        '❍  과업 수행 개요 및 단계별 추진 실적',
        '❍  투자유치 기초교육 운영 결과 (회차별 내용, 참여현황, 출결 및 만족도 조사 결과)',
        '❍  IR 피치덱 제작 결과 (기업별 최종본 원본 파일 및 PDF 일체)',
        '❍  SNU-SH DEMO DAY 운영 결과 (진행 결과, 심사위원 구성 및 심사·피드백 결과, 후속 투자검토 연계 현황)',
        '❍  운영 증빙자료 (행사 사진, 참석자 서명부, 홍보물 실물 사진, 만족도 조사 결과 등)',
        '❍  기타 발주처가 요청하는 자료 일체',
      ]} />
      <p style={NOTE}>※ 성과물의 납품은 일괄 납품을 원칙으로 하되, 발주처가 부분 납품을 요구할 때에는 이에 응하여야 한다.</p>
      <p style={NOTE}>※ 납품된 성과물에 하자가 있거나 보완이 필요한 경우 계약상대자의 부담으로 즉시 보완하여야 한다.</p>
      <p style={{ ...P, marginTop: '10px', fontWeight: 600 }}>본 과업지시서에 명시되지 않은 사항은 발주처와 계약상대자가 상호 협의하여 결정한다.</p>
    </div>
  );
}

/* ── 운영제안서 ────────────────────────────────────────────── */

function StepCard({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div style={{ flex: '1 1 200px', background: '#F6F9FF', border: '1px solid rgba(20,99,243,0.16)', borderRadius: '14px', padding: '16px 18px' }}>
      <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '12px', color: '#1463F3', marginBottom: '6px' }}>{n}</div>
      <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#071A3E', marginBottom: '6px' }}>{title}</div>
      <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.6, color: '#5A6478', whiteSpace: 'pre-line' }}>{desc}</p>
    </div>
  );
}

export function ProposalDocument() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}><DocBadge tone="ai">AI 생성 문서</DocBadge></div>
      <div style={{ textAlign: 'center', padding: '30px 0 26px', borderBottom: '3px solid #0D3B8F', marginBottom: '10px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 800, color: '#071A3E' }}>2026 SNU-SH DEMO DAY</h1>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0D3B8F', marginBottom: '10px' }}>투자 액셀러레이팅 운영계획(안) (v2.4, 2026.07.22)</div>
        <div style={{ fontSize: '12.5px', color: '#5A6478' }}>데모데이로 완성하는 투자 액셀러레이팅 프로그램</div>
      </div>

      <h2 style={H1}>1. 사업 개요</h2>
      <DocTable
        cols={['구분', '내용']}
        widths={['110px']}
        rows={[
          ['사 업 명', '2026 SNU-SH DEMO DAY 운영 용역'],
          ['발 주 처', '서울대학교 예비창업패키지 주관기관'],
          ['수 행 사', '주식회사 이노웨이브'],
          ['지원 대상', '예비창업패키지 선정기업 6개사'],
          ['사업 구조', '사전 역량강화(투자유치 교육 · IR 피치덱 제작 지원) + SNU-SH DEMO DAY 운영'],
          ['총 사업비', '23,800,000원 (VAT 포함)'],
          ['계약 방식', '여성기업 수의계약 (총 사업비 2천만원 이상)'],
        ]}
      />
      <p style={P}>본 프로그램은 투자유치 기초교육 → IR 피치덱 제작 지원 → 데모데이 실전 피칭으로 이어지는 3단계 집중 액셀러레이팅 프로그램으로 구성됩니다. 지원기업 6개사는 데모데이 무대에 서기 전까지 투자자 관점의 커뮤니케이션 훈련과 IR 자료 고도화를 완료하고, 실전 투자 피칭을 실시</p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '14px 0 6px' }}>
        <StepCard n="STEP 1" title="투자유치 기초교육" desc={'투자자 관점 커뮤니케이션 · 표준 IR Deck 전략\n(2회차, 온라인 · 강사 선임급)'} />
        <StepCard n="STEP 2" title="IR 피치덱 제작 지원" desc={'스토리텔링 · 디자인/비주얼 고도화\n발표용 마스터본 제작 (6개사)'} />
        <StepCard n="STEP 3" title="데모데이 실전 피칭" desc={'투자심사역 5인 앞 실전 피칭\n현장 피드백 · 후속 투자검토'} />
      </div>

      <h2 style={H1}>2. 프로그램별 개요</h2>
      <div style={H2}>Phase 1. 투자유치 기초교육 (필수, 2회차)</div>
      <DocTable
        cols={['회차', '주제', '내용']}
        widths={['70px', '210px', undefined]}
        rows={[
          ['1회차', '투자 생태계 이해와 투자자 커뮤니케이션', '국내 투자 생태계 구조, 투자 단계별 특성, 투자자 관점의 사고와 소통법'],
          ['2회차', '표준 IR Deck 기획과 피칭 전략', '표준 IR Deck 구성 논리, 스토리라인 설계, 데모데이 피칭 전략'],
        ]}
      />
      <p style={NOTE}>6개사 전체 필수 참여, 회차당 3시간 내외 온라인 교육 · 강사 선임급 이상 섭외</p>
      <p style={NOTE}>※ 교육 강사비는 주관기관에서 전문가활용비로 직접 지출 (본 용역 견적 제외)</p>

      <div style={H2}>Phase 2. IR 피치덱 제작 지원 (6개사)</div>
      <Bullets items={[
        '교육 결과를 반영한 기업별 피치덱 스토리텔링 구성 및 디자인·비주얼 고도화 지원',
        '인포그래픽·발표용 마스터본 제작 및 데모데이 발표용 최종본 완성 (발표 리허설 버전 포함)',
      ]} />

      <div style={H2}>Phase 3. SNU-SH DEMO DAY 운영</div>
      <p style={NOTE}>※ 일정안은 발주처와 논의 후 확정</p>
      <DocTable
        cols={['구분', '내용']}
        widths={['110px']}
        rows={[
          ['무대 구성', '전문 사회자(MC) 진행, 6개사 순차 피칭 및 Q&A'],
          ['심사·피드백', '투자심사역 5인 패널 — 피칭 심사, 현장 피드백 및 후속 투자검토 연계'],
          ['현장 운영', '실전 IR·데모데이 환경 구성 (무선마이크·음향 시스템, 영상스위칭 등)'],
          ['홍보물', '키비주얼·포스터, 무대 백월(PPT-SET), 현수막·배너, 명찰·현판'],
        ]}
      />

      <h2 style={H1}>3. 추진 일정(안)</h2>
      <DocTable
        cols={['단계', '내용', '시기(잠정)']}
        widths={[undefined, undefined, '90px']}
        rows={[
          ['모집·선정', '예비창업패키지 6개사 모집·확정', '9월'],
          ['착수·진단', '착수 미팅, 기업 진단 및 교육 커리큘럼 확정', '10월 초'],
          ['투자유치 기초교육', '1·2회차 (온라인, 강사 선임급 이상)', '10월'],
          ['IR 피치덱 제작 지원', '스토리텔링·디자인 고도화·발표 마스터본 (6개사)', '10~11월'],
          ['최종 리허설·데모데이', '발표 리허설 후 SNU-SH DEMO DAY 개최', '12월 초'],
          ['결과보고·정산', '결과보고 및 정산', '12월 중'],
        ]}
      />

      <h2 style={H1}>4. 기대효과</h2>
      <Bullets items={[
        '6개사 전원 투자유치 실전 역량(IR·피칭) 완성 — 데모데이 이후에도 활용 가능한 자산화',
        '투자심사역 5인과의 실질적 네트워킹 및 후속 투자검토 기회 창출',
        '교육-제작-실전이 연결된 완결형 구조로 후속 투자 유치 미팅을 위한 실전 역량 강화',
      ]} />

      <h2 style={H1}>별첨) SNU 교육실을 활용한 참고 사진</h2>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {['현수막', '배너', '다과', '다과', '아나운서', '심사위원', 'IR 피칭', 'IR 피칭'].map((label, i) => (
          <span key={`${label}-${i}`} style={{ background: '#F6F9FF', border: '1px dashed rgba(112,115,124,0.35)', borderRadius: '10px', padding: '10px 16px', fontSize: '12px', color: '#5A6478', fontWeight: 600 }}>
            🖼 {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── 견적서 ────────────────────────────────────────────────── */

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

interface BudgetLine {
  category: string;
  qty: string;
  unit: string;
  freq: string;
  unitPrice: number | null;
  supply: number | null;
  tax: number | null;
  total: number | null | 'org'; // 'org' = 주관기관 지급
}
interface BudgetGroup { item: string; lines: BudgetLine[] }

const BUDGET_GROUPS: BudgetGroup[] = [
  {
    item: '투자 교육',
    lines: [
      { category: '1차시 강연 : 투자 생태계 이해와 투자자 커뮤니케이션 (3H)', qty: '1', unit: '명', freq: '1', unitPrice: null, supply: null, tax: null, total: 'org' },
      { category: '2차시 강연 : 표준 IR Deck 기획과 피칭 전략 (3H)', qty: '1', unit: '명', freq: '1', unitPrice: null, supply: null, tax: null, total: 'org' },
    ],
  },
  {
    item: 'IR DECK 제작지원',
    lines: [
      { category: 'IR 피치덱 제작 PPT 원본 (스토리텔링·구조 및 배치 설계, 6개사)', qty: '1', unit: '명', freq: '6', unitPrice: 1500000, supply: 9000000, tax: 900000, total: 9900000 },
      { category: 'IR 피치덱 디자인·비주얼 리터치 (인포그래픽·발표용 마스터본, 6개사)', qty: '1', unit: '명', freq: '6', unitPrice: 500000, supply: 3000000, tax: 300000, total: 3300000 },
    ],
  },
  {
    item: 'IR 평가 위원',
    lines: [
      { category: 'VC , AC , 엔젤투자사', qty: '1', unit: '명', freq: '5', unitPrice: 500000, supply: 2500000, tax: 250000, total: 2750000 },
    ],
  },
  {
    item: '홍보물 제작',
    lines: [
      { category: '디자인 (키비주얼·포스터)', qty: '1', unit: '식', freq: '1', unitPrice: 600000, supply: 600000, tax: 60000, total: 660000 },
      { category: '홍보물 제작 설치 (무대 백월 PPT-SET, 현수막2, 배너4, 명찰20, 현판5)', qty: '1', unit: '식', freq: '1', unitPrice: 800000, supply: 800000, tax: 80000, total: 880000 },
    ],
  },
  {
    item: '임차·운영비',
    lines: [
      { category: '콘솔시스템 (무선마이크, 퍼펙트큐, 보이스음향)', qty: '1', unit: '식', freq: '1', unitPrice: 1000000, supply: 1000000, tax: 100000, total: 1100000 },
      { category: '케이터링', qty: '1', unit: '식', freq: '1', unitPrice: 1000000, supply: 1000000, tax: 100000, total: 1100000 },
      { category: '사무용 비품·소모품', qty: '1', unit: '식', freq: '1', unitPrice: 300000, supply: 300000, tax: 30000, total: 330000 },
    ],
  },
  {
    item: '진행·인력',
    lines: [
      { category: '사회자(아나운서)', qty: '1', unit: '명', freq: '1', unitPrice: 600000, supply: 600000, tax: 60000, total: 660000 },
      { category: '운영인력 (교육·피치덱 제작·리허설·데모데이 등 운영 지원)', qty: '3', unit: '명', freq: '1', unitPrice: 300000, supply: 900000, tax: 90000, total: 990000 },
    ],
  },
];

const CELL: CSSProperties = { border: '1px solid rgba(112,115,124,0.22)', padding: '7px 9px', fontSize: '12.5px', color: '#1B2437', lineHeight: 1.5, verticalAlign: 'top' };
const CELL_HEAD: CSSProperties = { ...CELL, background: '#EEF3FC', fontWeight: 700, color: '#0D3B8F', textAlign: 'center' };
const CELL_NUM: CSSProperties = { ...CELL, textAlign: 'right', fontFamily: GROTESK };

export function BudgetDocument() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '4px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#071A3E', letterSpacing: '0.1em' }}>견 적 서</h1>
        <DocBadge tone="ai">AI 생성 문서</DocBadge>
      </div>
      <p style={{ ...P, marginTop: '4px' }}>고객사 : 서울대학교 예비창업패키지 주관기관 &nbsp;|&nbsp; 수행사 : 주식회사 이노웨이브 / 대표 김유환</p>

      {/* 좌: 고객사 정보 · 우: 수행사 정보 (견적서 원문 2열 구성 그대로) */}
      <table style={{ ...TABLE, marginTop: '10px' }}>
        <tbody>
          <tr>
            <td style={{ ...CELL_HEAD, width: '82px' }}>사업자번호</td><td style={CELL}>-</td>
            <td style={{ ...CELL_HEAD, width: '82px' }}>사업자번호</td><td style={CELL}>272-87-03485</td>
          </tr>
          <tr>
            <td style={CELL_HEAD}>주소</td><td style={CELL}>경기도 시흥시 서울대학로 173 (배곧동) 교육협력동 10층 1006호</td>
            <td style={CELL_HEAD}>주소</td><td style={CELL}>인천 광역시 강화대로 352번길 5 B101</td>
          </tr>
          <tr>
            <td style={CELL_HEAD}>전화번호</td><td style={CELL}>-</td>
            <td style={CELL_HEAD}>업태</td><td style={CELL}>교육 서비스업</td>
          </tr>
          <tr>
            <td style={CELL_HEAD}>견적명</td><td style={CELL}>2026 SNU-SH DEMO DAY 운영 용역</td>
            <td style={CELL_HEAD}>대표</td><td style={CELL}>김유환 (010-8787-4041)</td>
          </tr>
          <tr>
            <td style={CELL_HEAD}>참조</td><td style={CELL}>담당 : 심정은 매니저님</td>
            <td style={CELL_HEAD}>이메일</td><td style={CELL}>innowave250301@gmail.com</td>
          </tr>
        </tbody>
      </table>

      <div style={{ background: '#E5F0FF', borderRadius: '12px', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', margin: '14px 0 18px' }}>
        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0D3B8F' }}>합계금액 (VAT 포함)</span>
        <span style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '19px', color: '#0D3B8F' }}>이천삼백팔십만원정 (₩23,800,000)</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ ...TABLE, minWidth: '760px' }}>
          <thead>
            <tr>
              <th style={CELL_HEAD}>품목</th>
              <th style={CELL_HEAD}>비목</th>
              <th style={{ ...CELL_HEAD, width: '48px' }}>수량</th>
              <th style={{ ...CELL_HEAD, width: '48px' }}>단위</th>
              <th style={{ ...CELL_HEAD, width: '70px' }}>횟수(회/일)</th>
              <th style={{ ...CELL_HEAD, width: '90px' }}>단가(원)</th>
              <th style={{ ...CELL_HEAD, width: '100px' }}>공급가액</th>
              <th style={{ ...CELL_HEAD, width: '90px' }}>세액</th>
              <th style={{ ...CELL_HEAD, width: '110px' }}>합계</th>
            </tr>
          </thead>
          <tbody>
            {BUDGET_GROUPS.map((g) => g.lines.map((line, i) => (
              <tr key={`${g.item}-${i}`}>
                {i === 0 && <td style={{ ...CELL, fontWeight: 700, color: '#071A3E' }} rowSpan={g.lines.length}>{g.item}</td>}
                <td style={CELL}>{line.category}</td>
                <td style={{ ...CELL, textAlign: 'center' }}>{line.qty}</td>
                <td style={{ ...CELL, textAlign: 'center' }}>{line.unit}</td>
                <td style={{ ...CELL, textAlign: 'center' }}>{line.freq}</td>
                <td style={CELL_NUM}>{line.unitPrice !== null ? line.unitPrice.toLocaleString('ko-KR') : '-'}</td>
                <td style={CELL_NUM}>{line.supply !== null ? line.supply.toLocaleString('ko-KR') : '-'}</td>
                <td style={CELL_NUM}>{line.tax !== null ? line.tax.toLocaleString('ko-KR') : '-'}</td>
                <td style={{ ...CELL_NUM, fontWeight: 700, color: line.total === 'org' ? '#5A6478' : '#071A3E' }}>
                  {line.total === 'org' ? '주관기관 지급' : line.total !== null ? line.total.toLocaleString('ko-KR') : '-'}
                </td>
              </tr>
            )))}
            <tr>
              <td style={{ ...CELL, fontWeight: 800, color: '#0D3B8F', background: '#F6F9FF' }} colSpan={2}>계</td>
              <td style={{ ...CELL, background: '#F6F9FF' }} colSpan={4} />
              <td style={{ ...CELL_NUM, fontWeight: 700, background: '#F6F9FF' }}>{won(19700000)}</td>
              <td style={{ ...CELL_NUM, fontWeight: 700, background: '#F6F9FF' }}>{won(1970000)}</td>
              <td style={{ ...CELL_NUM, fontWeight: 800, color: '#0D3B8F', background: '#F6F9FF' }}>{won(21670000)}</td>
            </tr>
            <tr>
              <td style={{ ...CELL, fontWeight: 700, color: '#071A3E' }}>기획(실행비)</td>
              <td style={CELL}>일반관리비 (대행 수수료) 10%</td>
              <td style={CELL} colSpan={4} />
              <td style={CELL_NUM}>{won(1970000)}</td>
              <td style={CELL_NUM}>{won(197000)}</td>
              <td style={{ ...CELL_NUM, fontWeight: 700 }}>{won(2167000)}</td>
            </tr>
            <tr>
              <td style={{ ...CELL, fontWeight: 800, color: '#FFFFFF', background: '#0D3B8F' }} colSpan={2}>견적 총액 (만원단위절삭)</td>
              <td style={{ ...CELL, background: '#0D3B8F' }} colSpan={4} />
              <td style={{ ...CELL_NUM, fontWeight: 800, color: '#FFFFFF', background: '#0D3B8F' }}>{won(21670000)}</td>
              <td style={{ ...CELL_NUM, fontWeight: 800, color: '#FFFFFF', background: '#0D3B8F' }}>{won(2167000)}</td>
              <td style={{ ...CELL_NUM, fontWeight: 800, color: '#FFFFFF', background: '#0D3B8F', fontSize: '14px' }}>{won(23800000)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { DocBadge };
