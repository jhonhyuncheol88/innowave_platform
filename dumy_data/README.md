# INNOWAVE 목업 데이터 (DB 시딩용)

과업지시서 3장(용어의 정의), 4.3(AI 엔진 및 데이터 연동) 기준으로 만든 임시 스키마와 시드 데이터입니다.
실제 스키마는 1단계 기능정의서 확정 시 "갑"과 협의 후 변경될 수 있습니다.

## 파일 구성

| 파일 | 설명 | 건수 |
| --- | --- | --- |
| `schema.sql` | 5개 테이블 CREATE 문 (SQLite 문법 기준, 타입만 바꾸면 MySQL/PostgreSQL 호환) | - |
| `rate_cards.json` / `.sql` | 레이트카드 (행사 구성 항목별 표준 단가) | 120건 |
| `case_data.json` / `.sql` | 케이스 데이터 (과거 행사 실데이터) | 80건 |
| `personnel_pool.json` / `.sql` | 인력풀 (강사/멘토/심사위원/운영인력) | 500명 |
| `sample_events.json` / `.sql` | 샘플 행사 (1단계 워크플로우 입력 데모용) | 10건 |
| `project_progress.json` / `.sql` | 진행 현황 (REQ-12~14 데모, 샘플 행사 3건에 대한 5단계 진행상황) | 15건 |

## 테이블 관계

- `sample_events.id` ← `project_progress.sample_event_id` (FK)
- 나머지 테이블(rate_cards, case_data, personnel_pool)은 독립 테이블이며, 실제 서비스에서는
  견적 산출 시 `sample_events` ↔ `rate_cards`, 인력 매칭 시 `sample_events` ↔ `personnel_pool` 간
  N:M 연결 테이블(예: `quote_items`, `event_personnel_matches`)이 추가로 필요합니다.
  이번 목업에서는 워크플로우 UI 시연에 집중하기 위해 이 연결 테이블은 포함하지 않았습니다.

## 사용 방법

**SQLite로 즉시 확인:**
```bash
sqlite3 innowave.db < schema.sql
for f in rate_cards case_data personnel_pool sample_events project_progress; do
  sqlite3 innowave.db < $f.sql
done
```

**MySQL/PostgreSQL 사용 시:**
- `schema.sql`의 `INTEGER PRIMARY KEY` → `INT AUTO_INCREMENT PRIMARY KEY`(MySQL) 또는
  `SERIAL PRIMARY KEY`(PostgreSQL)로 변경
- `BOOLEAN` 타입은 MySQL에서는 `TINYINT(1)`로 자동 매핑됨
- 나머지 INSERT 문법은 표준 SQL이라 별도 변환 없이 사용 가능

**JSON으로 애플리케이션 레벨 시딩 시:**
- 각 `.json` 파일을 그대로 파싱하여 ORM(Prisma, TypeORM, SQLAlchemy 등)의 시드 스크립트에 사용

## 데이터 성격 안내

- 모든 인명·소속·연락처는 가상 데이터입니다 (기관명은 "OO"로 익명 처리, 이메일은 example-mail.com 도메인 사용).
- 단가·예산·평점 등 수치는 현실적인 범위 내에서 무작위 생성했습니다. 실제 레이트카드 단가와 인력풀 단가는
  "갑"이 제공하는 원천 데이터로 교체되어야 합니다 (과업지시서 4.3, 4.5).
- `sample_events`는 4단계 워크플로우(정보입력→프로그램구성→인력매칭→견적산출) 시연 목적의 다양한 상태값
  (draft/in_progress/quoted/confirmed)을 포함하고 있어 화면별 상태 분기 테스트에 활용할 수 있습니다.
