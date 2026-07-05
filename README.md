# INNOWAVE Platform

AI 기반 MICE 행사 기획·견적 자동화 플랫폼 (과업지시서 REQ-01~19 대응 스캐폴드)

## 기술 스택

- **Frontend**: React 18 + Vite 5, react-router, react-helmet-async(SEO)
- **Backend**: Firebase (Auth / Firestore / Storage / Hosting / App Check)
- **Analytics**: BigQuery (Stream Firestore to BigQuery 확장) — `docs/BIGQUERY.md`
- **아키텍처**: 객체지향 MVC — Model(도메인 클래스) / Repository(데이터 접근) / Controller(비즈니스 로직) / View(React)

## 아키텍처 규칙

```
View(React 컴포넌트)
  └─ hooks (useProgress, useAuth …)      ← View-Controller 브릿지
       └─ Controllers (QuoteController …) ← 비즈니스 로직, Firestore 모름
            └─ Repositories (BaseRepository 상속) ← Firestore SDK는 여기서만
                 └─ Models (BaseModel 상속)  ← 도메인 규칙 + Firestore 컨버터
```

- 컴포넌트에서 `firebase/firestore`를 직접 import하지 않는다 (예외: `config/firebase.js`, repositories).
- 도메인 규칙(견적 계산, 매칭 점수, 단계 검증)은 모델/컨트롤러에만 둔다. View에는 로직을 두지 않는다.

## 디렉토리

```
src/
├─ config/        Firebase 초기화 (App Check 포함)
├─ models/        BaseModel, Event, RateCard, Personnel, Quote, ProgressStage
├─ repositories/  BaseRepository + 도메인별 Repository
├─ controllers/   QuoteController, MatchingController, ProgressController
├─ hooks/         useAuth, useProgress
├─ views/
│  ├─ pages/       LandingPage …
│  └─ components/  common(Seo, WaveDivider), progress(대시보드), workflow
└─ styles/        tokens.css(디자인 토큰), global.css
docs/             FIRESTORE_STRUCTURE.md, BIGQUERY.md, SECURITY.md
firestore.rules   3-Role 보안 규칙
storage.rules     업로드 파일 제한
```

## 시작하기

```bash
npm install
cp .env.example .env    # Firebase 콘솔 값 입력
npm run dev

# 로컬 에뮬레이터로 rules 테스트
VITE_USE_EMULATOR=true npm run dev  # 별도 터미널: npm run emulators
```

## SEO / GEO

- 빌드 시 sitemap.xml/robots.txt 자동 생성 (`vite.config.js`)
- robots에 GPTBot/ClaudeBot/PerplexityBot 허용 → LLM 검색 노출(GEO)
- `public/llms.txt`: 생성형 엔진용 서비스 요약
- `index.html` JSON-LD(Organization/SoftwareApplication) + 페이지별 `<Seo jsonLd>` (FAQPage 등)
- SPA 한계 보완: 마케팅 페이지(/, /about, /cases)는 추후 prerender 또는 SSR(예: vite-plugin-ssr) 전환 검토

## 디자인 토큰

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--iw-blue-900` | #071A3E | 히어로/푸터 배경 (Deep Harbor) |
| `--iw-blue-500` | #1463F3 | 프라이머리 (Innowave Blue) |
| `--iw-cyan-300` | #4FD8EB | 웨이브 포인트 (Signal Cyan) |
| `--iw-wave` | cyan→blue 그라디언트 | 시그니처 웨이브 (WaveDivider, 진행률 바) |

서체: Pretendard(본문·한글) + Space Grotesk(숫자·영문 디스플레이)
