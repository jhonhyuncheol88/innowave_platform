# 보안 체크리스트 (REQ-19 기준)

## 적용 완료 (이 스캐폴드에 포함)

| 영역 | 조치 | 위치 |
| --- | --- | --- |
| 인증·인가 | 3-Role(user/client/admin) Firestore Rules, 권한 상승 차단(role 자가 변경 불가) | `firestore.rules` |
| 데이터 격리 | 발주처는 자기 조직(clientOrgId) 프로젝트만 조회 (4.2 권한 분리) | `firestore.rules` events 블록 |
| 입력 검증 | rules 레벨 문자열 길이 제한 + 모델 레벨 단계 검증(canAdvanceTo) | rules, `Event.js` |
| 파일 업로드 | 크기 20MB 제한, MIME 타입 화이트리스트(PDF/DOCX/PPTX/HWP) | `storage.rules` |
| 봇 방어 | App Check (reCAPTCHA v3) 초기화 | `src/config/firebase.js` |
| 전송 보안 | HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy 헤더 | `firebase.json` hosting.headers |
| 알림 무결성 | notifications 생성은 서버 전용, 클라이언트는 read 플래그만 갱신 | `firestore.rules` |
| 문서 생성물 | generated/deliverables 경로는 클라이언트 쓰기 금지 (Functions 전용) | `storage.rules` |

## 배포 전 필수 작업

- [ ] Firebase 콘솔에서 **App Check 강제 적용**(Enforce) 전환 — Firestore/Storage 모두
- [ ] Authentication > 승인된 도메인에 운영 도메인만 남기기
- [ ] `personnelPool` 민감 필드(contactEmail) 분리: `personnelPool/{id}/private/contact` 서브문서로 이동 후 admin 전용 rule 적용
- [ ] Cloud Functions에 요청 검증(2세대 함수 + App Check 토큰 검증) 적용
- [ ] Firestore Rules 단위 테스트 작성 (`@firebase/rules-unit-testing` + 에뮬레이터)
- [ ] BigQuery export에서 PII 필드 제외 설정 (docs/BIGQUERY.md 3항)
- [ ] 의존성 취약점 점검: CI에 `npm audit --audit-level=high` 추가

## 운영 정책 권고

- 관리자 계정은 이메일+비밀번호 대신 Google Workspace SSO + 2단계 인증 강제
- Rules 변경은 반드시 에뮬레이터 테스트 통과 후 배포 (CI 게이트)
- 과업지시서 12장에 따라 "AI 결과의 최종 확인 책임은 이용자에게 있음" 고지 문구를 견적/기획안 화면과 생성 문서 하단에 고정 노출
