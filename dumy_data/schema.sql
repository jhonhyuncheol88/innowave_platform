-- =========================================================
-- INNOWAVE 플랫폼 - 목업 DB 스키마
-- 과업지시서 4.3(AI 엔진 및 데이터 연동), 3장(용어의 정의) 기준
-- 실제 스키마는 1단계 기능정의서 확정 시 협의 후 변경될 수 있음
-- =========================================================

-- 1. 레이트카드 (행사 구성 항목별 표준 단가, 약 130개 항목)
CREATE TABLE rate_cards (
    id              INTEGER PRIMARY KEY,
    category        VARCHAR(50)   NOT NULL,   -- 대분류 (장소/케이터링/인쇄/장비/인력 등)
    subcategory     VARCHAR(100)  NOT NULL,   -- 중분류
    item_name       VARCHAR(200)  NOT NULL,   -- 항목명
    spec            VARCHAR(200),             -- 규격/사양
    unit            VARCHAR(20)   NOT NULL,   -- 단위 (일/회/개/인/식 등)
    unit_price      INTEGER       NOT NULL,   -- 표준 단가 (원, VAT 별도)
    margin_rate     DECIMAL(5,2)  NOT NULL,   -- 기본 마진율 (%) - REQ-17
    region_variable BOOLEAN       NOT NULL DEFAULT 0,  -- 지역별 단가 변동 여부
    supplier_type   VARCHAR(50),              -- 공급 형태 (자체/외주/제휴)
    notes           VARCHAR(300),
    is_active       BOOLEAN       NOT NULL DEFAULT 1,
    created_at      TIMESTAMP     NOT NULL,
    updated_at      TIMESTAMP     NOT NULL
);

-- 2. 케이스 데이터 (과거 행사 운영 실데이터, 약 80건)
CREATE TABLE case_data (
    id                   INTEGER PRIMARY KEY,
    event_name           VARCHAR(200)  NOT NULL,
    event_type           VARCHAR(50)   NOT NULL,   -- REQ-01 행사 유형 분류
    organizer            VARCHAR(100)  NOT NULL,
    period_start         DATE          NOT NULL,
    period_end           DATE          NOT NULL,
    region               VARCHAR(50)   NOT NULL,
    operation_type       VARCHAR(20)   NOT NULL,   -- 오프라인/온라인/하이브리드
    participant_scale    INTEGER       NOT NULL,
    budget_total         INTEGER       NOT NULL,   -- 실행 예산 (원)
    program_summary      TEXT,                     -- 프로그램 구성 요약
    personnel_used_json  TEXT,                     -- 투입 인력 요약 (JSON 문자열)
    outcome_summary      TEXT,                     -- 결과/성과 요약
    satisfaction_score   DECIMAL(3,1),              -- 만족도 (5점 만점)
    created_at           TIMESTAMP     NOT NULL
);

-- 3. 인력풀 (강사/멘토/심사위원/운영인력, 약 500명)
CREATE TABLE personnel_pool (
    id                     INTEGER PRIMARY KEY,
    name                   VARCHAR(50)   NOT NULL,
    role                   VARCHAR(20)   NOT NULL,   -- 강사/멘토/심사위원/운영인력
    expertise_field        VARCHAR(100)  NOT NULL,   -- 전문 분야
    affiliation            VARCHAR(100),             -- 소속
    career_years           INTEGER       NOT NULL,
    career_summary         TEXT,
    event_experience_count INTEGER       NOT NULL DEFAULT 0,  -- 누적 참여 행사 수
    rating                 DECIMAL(2,1)  NOT NULL,   -- 평점 (5점 만점)
    activity_region        VARCHAR(50)   NOT NULL,   -- 주 활동 지역
    available_type         VARCHAR(20)   NOT NULL,   -- 온라인/오프라인/온오프라인
    unit_rate              INTEGER       NOT NULL,   -- 회당/시간당 단가 (원)
    contact_email          VARCHAR(100)  NOT NULL,
    is_active              BOOLEAN       NOT NULL DEFAULT 1,
    created_at             TIMESTAMP     NOT NULL
);

-- 4. 샘플 행사 (워크플로우 1단계 입력 데모용, REQ-01/02/03)
CREATE TABLE sample_events (
    id                     INTEGER PRIMARY KEY,
    event_name             VARCHAR(200)  NOT NULL,
    event_type             VARCHAR(50)   NOT NULL,
    organizer              VARCHAR(100)  NOT NULL,
    period_start           DATE          NOT NULL,
    period_end             DATE          NOT NULL,
    region                 VARCHAR(50)   NOT NULL,
    operation_type         VARCHAR(20)   NOT NULL,
    participant_scale      INTEGER       NOT NULL,
    budget_limit           INTEGER       NOT NULL,
    purpose                TEXT          NOT NULL,
    uploaded_document_name VARCHAR(200),            -- REQ-03 업로드 문서 (nullable)
    status                 VARCHAR(20)   NOT NULL   -- draft/in_progress/quoted/confirmed
);

-- 5. 진행 현황 (발주처 실시간 진행 현황 조회, REQ-12~14 데모용)
CREATE TABLE project_progress (
    id                 INTEGER PRIMARY KEY,
    sample_event_id    INTEGER       NOT NULL,      -- FK -> sample_events.id
    stage_name         VARCHAR(50)   NOT NULL,      -- 요구사항분석/화면설계/핵심개발/통합테스트/최종검수
    stage_order        INTEGER       NOT NULL,
    status             VARCHAR(20)   NOT NULL,      -- 완료/진행중/예정
    progress_rate      INTEGER       NOT NULL,      -- 0~100
    updated_note        VARCHAR(300),
    deliverable_name   VARCHAR(200),                -- 공유 가능한 중간 산출물명 (nullable)
    updated_at         TIMESTAMP     NOT NULL,
    FOREIGN KEY (sample_event_id) REFERENCES sample_events(id)
);
