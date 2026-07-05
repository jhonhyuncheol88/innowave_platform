# BigQuery 연동 가이드

INNOWAVE의 데이터 분석 파이프라인은 Firebase 공식 확장 **Stream Firestore to BigQuery**를 사용한다.
코드 수정 없이 Firestore 변경분이 BigQuery로 실시간 스트리밍된다.

## 1. 확장 설치

```bash
# 컬렉션별로 확장 인스턴스를 설치 (Firebase 콘솔 Extensions 또는 CLI)
firebase ext:install firebase/firestore-bigquery-export --project=innowave-platform
```

설치 시 컬렉션 경로별로 다음처럼 지정:

| 인스턴스 | Collection Path | Dataset | Table Prefix |
| --- | --- | --- | --- |
| events | `events` | `innowave_analytics` | `events` |
| quotes | `events/{eventId}/quotes` (Collection Group: `quotes`) | 동일 | `quotes` |
| rate_cards | `rateCards` | 동일 | `rate_cards` |
| personnel | `personnelPool` | 동일 | `personnel` |
| case_data | `caseData` | 동일 | `case_data` |

- 각 인스턴스는 `{prefix}_raw_changelog` 테이블과 `{prefix}_raw_latest` 뷰를 생성한다.
- 기존 데이터 백필: `npx @firebaseextensions/fs-bq-import-collection` 스크립트 사용.

## 2. 분석 쿼리 예시

**행사 유형별 평균 견적액 (스탠다드 옵션 기준):**
```sql
SELECT
  JSON_VALUE(e.data, '$.basicInfo.eventType') AS event_type,
  ROUND(AVG(CAST(JSON_VALUE(q.data, '$.total') AS INT64))) AS avg_total
FROM `innowave_analytics.quotes_raw_latest` q
JOIN `innowave_analytics.events_raw_latest` e
  ON STARTS_WITH(q.path_params.eventId, e.document_id)
WHERE JSON_VALUE(q.data, '$.optionType') = 'standard'
GROUP BY event_type
ORDER BY avg_total DESC;
```

**레이트카드 항목별 사용 빈도 (견적 라인 unnest):**
```sql
SELECT
  JSON_VALUE(item, '$.itemName') AS item_name,
  COUNT(*) AS used_count,
  SUM(CAST(JSON_VALUE(item, '$.amount') AS INT64)) AS total_amount
FROM `innowave_analytics.quotes_raw_latest`,
  UNNEST(JSON_QUERY_ARRAY(data, '$.items')) AS item
GROUP BY item_name
ORDER BY used_count DESC
LIMIT 30;
```

## 3. 운영 팁

- **스케줄 쿼리**: 위 쿼리들을 BigQuery Scheduled Query로 일 1회 materialize → Looker Studio 대시보드 연결.
- **비용**: raw_changelog는 파티셔닝(_PARTITIONTIME) 기준 조회로 스캔량 최소화. 90일 이상 changelog는 만료 정책 설정 권장.
- **PII 주의**: `personnelPool.contactEmail` 등 개인정보 필드는 확장 설치 시 "Exclude fields" 옵션으로 export 제외하거나, 뷰에서 마스킹할 것 (REQ-19).

## 4. 향후 확장

- 케이스 데이터(과거 80건) 대비 AI 견적 정확도 추적: `case_data` vs `quotes` 예산 편차 분석
- 검수 기준(9.2) 모니터링: 견적 생성 소요 시간 로그를 별도 컬렉션(`perfLogs`)으로 적재 후 스트리밍
