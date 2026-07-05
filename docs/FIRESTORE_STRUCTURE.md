# INNOWAVE Firestore 컬렉션 구조

과업지시서 5장(REQ-01~19) 기준. 3-Role 권한 모델(일반 이용자 / 발주처 / 관리자, REQ-15)을 전제로 설계.

## 설계 원칙

1. **루트 컬렉션은 도메인 단위, 종속 데이터는 서브컬렉션** — 견적·진행현황은 행사에 종속되므로 `events` 하위에 둔다.
2. **비정규화는 목록 화면 기준으로만** — 목록에서 보여줄 필드(행사명·상태·진행률)는 상위 문서에 요약 필드로 중복 저장하고, 상세는 서브컬렉션에서 읽는다.
3. **BigQuery 스트리밍 대상 컬렉션은 평평하게** — 분석 대상(`events`, `quotes` 요약)은 export 친화적으로 유지.
4. **원천 데이터(레이트카드·케이스·인력풀)는 읽기 전용 마스터** — 관리자만 쓰기 가능(REQ-16).

## 컬렉션 트리

```
users/{uid}
├─ role: "user" | "client" | "admin"     ← REQ-15 권한 구분
├─ displayName, email, organization
├─ clientOrgId: string | null            ← 발주처 소속 조직 (client 전용)
└─ createdAt, lastLoginAt

events/{eventId}                          ← 워크플로우의 중심 (REQ-01~11)
├─ ownerUid: string                       ← 작성자
├─ clientOrgId: string | null             ← 발주처 조직 (진행현황 조회 권한 기준)
├─ basicInfo: {                           ← 1단계 (REQ-01, 02)
│    name, organizer, eventType, periodStart, periodEnd,
│    region, operationType, participantScale, budgetLimit, purpose }
├─ parsedFromDoc: boolean                 ← AI 문서 파싱 여부 (REQ-04)
├─ status: "draft" | "composing" | "matching" | "quoted" | "confirmed" | "in_progress" | "done"
├─ currentStep: 1 | 2 | 3 | 4
├─ progressSummary: {                     ← 비정규화 요약 (REQ-12 목록용)
│    rate: number, currentStage: string, nextMilestone: string }
├─ createdAt, updatedAt
│
├─ documents/{docId}                      ← 업로드 문서 메타 (REQ-03)
│    fileName, storagePath, mimeType, parseStatus, parsedFields, uploadedAt
│
├─ programs/{programId}                   ← 2단계 프로그램 구성 (REQ-05, 06)
│    title, description, order, durationMin, source: "ai" | "user", linkedRateCardIds[]
│
├─ matches/{matchId}                      ← 3단계 인력 매칭 (REQ-07, 08)
│    personnelId, role, status: "recommended" | "selected" | "rejected",
│    matchScore, unitRateSnapshot         ← 단가 스냅샷 (레이트 변동 대비)
│
├─ quotes/{quoteId}                       ← 4단계 견적 (REQ-09, 10, 11)
│    optionType: "basic" | "standard" | "premium"
│    items: [{ rateCardId, itemName, unit, qty, unitPrice, marginRate, amount }]
│    subtotal, marginTotal, vat, total
│    simulatedBudget: number | null       ← 예산 시뮬레이션 입력값 (REQ-10)
│    generatedDocPath: string | null      ← 통합 문서 Storage 경로 (REQ-11)
│    createdAt
│
└─ progress/{stageId}                     ← 진행 현황 (REQ-12, 13)
     stageName, stageOrder, status: "done" | "active" | "pending"
     progressRate, note, deliverablePath, updatedAt, updatedBy

rateCards/{cardId}                        ← 마스터: 레이트카드 (~130건, REQ-09/17)
├─ category, subcategory, itemName, spec, unit
├─ unitPrice, marginRate, regionVariable, supplierType
└─ isActive, createdAt, updatedAt

caseData/{caseId}                         ← 마스터: 케이스 데이터 (~80건)
├─ eventName, eventType, organizer, periodStart, periodEnd
├─ region, operationType, participantScale, budgetTotal
└─ programSummary, personnelUsed, outcomeSummary, satisfactionScore

personnelPool/{personId}                  ← 마스터: 인력풀 (~500명, REQ-07)
├─ name, role, expertiseField, affiliation, careerYears, careerSummary
├─ eventExperienceCount, rating, activityRegion, availableType, unitRate
└─ contactEmail(관리자만 조회), isActive

notifications/{notifId}                   ← 단계 변경 알림 (REQ-14)
├─ recipientUid, eventId, type: "stage_changed" | "update_posted"
├─ title, body, read: boolean
└─ createdAt

quoteParams/{paramId}                     ← 견적 산출 파라미터 (REQ-17)
├─ key: "default_margin" | "vat_rate" | "option_multipliers" ...
└─ value, updatedAt, updatedBy
```

## 권한 매트릭스 (firestore.rules 근거)

| 컬렉션 | user | client (발주처) | admin |
| --- | --- | --- | --- |
| users (본인) | R/W | R/W | R/W (전체) |
| events | 본인 소유 R/W | 자기 조직(clientOrgId) R | R/W |
| events/progress | 본인 소유 R | 자기 조직 R | R/W |
| rateCards, caseData | R (단가·마진 제외 시 별도 뷰 고려) | R | R/W |
| personnelPool | R (연락처 제외) | R (연락처 제외) | R/W |
| notifications | 본인 수신분 R/W(read 플래그) | 동일 | R/W |
| quoteParams | - | - | R/W |

> `personnelPool.contactEmail`처럼 필드 단위 차단이 필요한 항목은 Firestore rules로는 필드 마스킹이 불가하므로,
> 공개용 필드만 담은 문서를 유지하거나(권장) Cloud Functions 경유 조회로 처리한다.

## BigQuery 연동

- **Stream Firestore to BigQuery** 공식 확장(extension)을 `events`, `rateCards`, `personnelPool`, `caseData`에 설치.
- 원시 changelog 테이블 + latest 뷰가 자동 생성됨. 서브컬렉션(quotes, progress)은 collection group 단위로 별도 설치.
- 분석 예시: 행사유형별 평균 견적액, 레이트카드 항목별 사용 빈도, 케이스 데이터 대비 견적 정확도 추적.
- 자세한 설정은 `docs/BIGQUERY.md` 참고.
