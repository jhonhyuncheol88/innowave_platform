import { Seo } from '../components/common/Seo.js';
import { WaveDivider } from '../components/common/WaveDivider.js';
import './landing.css';

const STEPS = [
  { no: '1', title: '행사 정보 입력', desc: '과업지시서를 올리면 AI가 행사명·기간·규모·예산을 자동으로 채웁니다.' },
  { no: '2', title: '프로그램 구성', desc: '행사 유형에 맞는 세부 프로그램을 AI가 제안하고, 자유롭게 편집합니다.' },
  { no: '3', title: '전문가 매칭', desc: '500명 이상의 인력풀에서 강사·멘토·심사위원을 적합도 순으로 추천합니다.' },
  { no: '4', title: '견적·기획안 생성', desc: '130개 항목 레이트카드 기반 3가지 견적 옵션과 통합 기획안을 내려받습니다.' },
] as const;

const FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'INNOWAVE는 어떤 서비스인가요?',
      acceptedAnswer: { '@type': 'Answer', text: 'MICE·공공 행사 기획을 위한 AI 기획·견적 자동화 플랫폼입니다. 행사 정보를 입력하거나 과업지시서를 업로드하면 기획안과 3가지 예산 견적을 자동 생성합니다.' },
    },
    {
      '@type': 'Question',
      name: '어떤 문서 형식을 지원하나요?',
      acceptedAnswer: { '@type': 'Answer', text: 'PDF, DOCX, PPTX, HWP 형식의 과업지시서·제안요청서를 업로드할 수 있습니다.' },
    },
    {
      '@type': 'Question',
      name: '발주처도 이용할 수 있나요?',
      acceptedAnswer: { '@type': 'Answer', text: '발주처 계정으로 자신이 의뢰한 프로젝트의 진행 단계와 진행률을 실시간으로 조회하고 중간 산출물을 내려받을 수 있습니다.' },
    },
  ],
};

export function LandingPage() {
  return (
    <>
      <Seo
        title="AI 행사 기획·견적 자동화"
        description="행사 정보 입력부터 견적 산출까지 4단계. MICE 행사 기획의 반복 업무를 AI로 줄이세요."
        path="/"
        jsonLd={FAQ_JSONLD}
      />

      <section className="hero" aria-label="서비스 소개">
        <div className="container hero-inner">
          <p className="hero-eyebrow">MICE · 공공행사 기획 플랫폼</p>
          <h1 className="hero-title">
            수십 시간 걸리던 행사 기획,<br />
            <span className="hero-accent">입력 한 번</span>으로 견적까지.
          </h1>
          <p className="hero-sub">
            과업지시서를 업로드하면 AI가 기획안과 3가지 예산 옵션을 만들어 드립니다.
            발주처는 진행 상황을 실시간으로 확인합니다.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="/login">무료로 기획 시작</a>
            <a className="btn btn-ghost" href="/cases">운영 사례 보기</a>
          </div>
        </div>
        <WaveDivider />
      </section>

      <section className="steps container" aria-label="이용 절차">
        <h2 className="section-title">기획에서 견적까지, 4단계</h2>
        <ol className="step-grid">
          {STEPS.map((s) => (
            <li key={s.no} className="card step-card">
              <span className="step-no" aria-hidden="true">{s.no}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
