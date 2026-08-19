# Competition Campaign V1 — 6 vòng và Thi cấp trường

**Ngày:** 2026-08-19  
**Trạng thái:** Design approved in chat; pending final written-spec review  
**Phạm vi:** QuizPro — Sân chơi 6 vòng → xét điều kiện → Thi cấp trường → xếp hạng/giải → XLSX/chứng nhận

## 1. Mục tiêu

Xây dựng subsystem **Sân chơi / Competition** cho QuizPro theo mô hình 6 vòng và một kỳ Thi cấp trường, nhưng không hard-code theo một môn hay thương hiệu cụ thể.

V1 phải cho phép:

1. Admin tạo một sân chơi cho toàn trường, một số khối hoặc một số lớp.
2. Sân chơi có **đúng 6 vòng trong V1**; từng vòng có lịch và luật riêng.
3. Mỗi vòng gắn **một quiz riêng theo từng khối**.
4. Học sinh làm nhiều lượt theo policy; kết quả vòng lấy **điểm cao nhất trong các lượt hợp lệ**.
5. Hệ thống chốt danh sách đủ điều kiện sau các vòng bắt buộc.
6. Thi cấp trường là một `SchoolExamEvent` chứa nhiều phòng/ca và tái sử dụng Live Exam Engine hiện có.
7. Admin xử lý đặc cách, sự cố, thi lại, reconcile, xếp hạng, giải thưởng và công bố kết quả có audit.
8. Admin/giáo viên xuất **`.xlsx` thật** theo phạm vi được phép; chứng nhận chỉ sinh sau khi kết quả chính thức được công bố.

Competition là lớp **orchestration**. Quiz vẫn chịu trách nhiệm nội dung/attempt/scoring của Vòng 1–6; Live Exam vẫn chịu trách nhiệm runtime thi trực tiếp; Assignment vẫn phục vụ giao bài thông thường.

---

## 2. Quyết định nghiệp vụ đã khóa

### 2.1 Sáu vòng

Mỗi `CompetitionRound` có:

- `opensAt`
- `closesAt`
- `passingScore`
- `maxScore`
- `maxAttempts` (`null` = không giới hạn)
- `requirePreviousRound`
- `requiredForSchoolExam`
- `resultPolicy = HIGHEST_SCORE`
- `showResultImmediately = true`

Vòng 1 có thể là vòng tự do. Vòng 2–6 có thể là vòng điều kiện. Mức `200/300` chỉ là default/template, không hard-code.

### 2.2 Audience

Admin chọn một trong ba scope:

- toàn trường;
- một hoặc nhiều khối;
- một hoặc nhiều lớp.

Khi campaign được publish, hệ thống tạo **Audience Snapshot**. Học sinh đổi lớp hoặc học sinh mới được thêm sau thời điểm publish không âm thầm làm thay đổi roster gốc.

### 2.3 Quiz theo khối

Mỗi vòng có một `CompetitionRoundQuiz` cho từng grade nằm trong scope. Không copy câu hỏi vào Competition.

Ví dụ Vòng 3:

```text
Grade 1 → Quiz A
Grade 2 → Quiz B
Grade 3 → Quiz C
Grade 4 → Quiz D
Grade 5 → Quiz E
```

### 2.4 Eligibility

Eligibility được tính server-side từ các vòng có `requiredForSchoolExam=true`:

- `ELIGIBLE`
- `NOT_ELIGIBLE`
- `OVERRIDDEN`

`OVERRIDDEN` chỉ do admin thực hiện, bắt buộc nhập lý do và ghi audit. Trước khi tạo kỳ thi chính thức, eligibility phải được snapshot và khóa.

### 2.5 School Exam

Một `SchoolExamEvent` chứa nhiều `SchoolExamRoom`.

- Mặc định hệ thống tạo phòng theo lớp.
- Admin được gộp/tách/chuyển học sinh trước khi ca thi đầu tiên bắt đầu.
- Mỗi phòng có một ca cụ thể nằm trong khung thi chính.
- Mỗi phòng liên kết một `LiveExamSession`.
- Đề thi được chọn theo khối.

### 2.6 Thi lại

Học sinh mặc định có **1 lượt chính thức**.

Thi lại chỉ khi admin cấp quyền vì sự cố và bắt buộc có lý do. Lịch sử lượt cũ không bị xóa.

Quy tắc V1 để tránh trạng thái mất kết quả nếu thi lại không được dùng:

1. Khi admin cấp quyền thi lại, attempt cũ vẫn là **provisional official result** và authorization ở trạng thái `GRANTED`.
2. Khi replacement attempt được submit/scoring thành công và reconcile chấp nhận, attempt cũ mới chuyển `SUPERSEDED`; replacement trở thành official attempt.
3. Nếu quyền thi lại hết hạn/được thu hồi mà replacement chưa có kết quả hợp lệ, attempt cũ vẫn là official result, trừ khi admin thực hiện một quyết định vô hiệu hóa riêng có audit.
4. Không lấy điểm cao nhất giữa lượt cũ và lượt thi lại; khi replacement đã được chấp nhận thì replacement là kết quả chính thức.

### 2.7 Hiển thị kết quả

- Vòng 1–6: hiển thị điểm/trạng thái ngay sau submit.
- Thi cấp trường: sau submit chỉ hiện **đã ghi nhận bài**.
- Không hiển thị điểm, đáp án hoặc xếp hạng School Exam cho tới khi admin publish kết quả.

### 2.8 Xếp hạng

Xếp hạng chính thức theo **từng khối**:

1. `score DESC`
2. `durationMs ASC`
3. `warningsCount ASC`
4. `submittedAt ASC`
5. bằng toàn bộ → đồng hạng

Dùng competition ranking: `1, 2, 2, 4`.

Giải thưởng cấu hình riêng theo khối. Nếu đồng hạng tại ranh giới giải, hệ thống cảnh báo admin; không tự ý loại một học sinh ngẫu nhiên.

### 2.9 Phân quyền

**Admin**: cấu hình/publish campaign, khóa eligibility, quản lý School Exam/rooms, override, retest, reconcile, ranking/award, publish result, export toàn trường.

**Teacher**: xem tiến độ/kết quả và export trong các lớp được phân công; không thay đổi luật campaign, eligibility hay quyền thi lại.

**Student**: chỉ xem campaign mình thuộc audience, làm quiz đúng grade, vào đúng room/ca và xem dữ liệu của chính mình.

Backend tự resolve quyền; không tin `studentId`, `teacherId`, `classId` do client cung cấp.

---

## 3. Kiến trúc tổng thể

Chọn **Competition Orchestrator trên các engine hiện có**:

```text
CompetitionCampaign
├── AudienceSnapshot
├── CompetitionRound × 6
│   ├── RoundQuiz per grade → existing Quiz
│   └── RoundProgress
├── Eligibility Snapshot
└── SchoolExamEvent
    ├── SchoolExamRoom
    │   ├── SchoolExamRoomMember
    │   └── → existing LiveExamSession
    ├── RetestAuthorization
    ├── OfficialSchoolExamResult
    ├── AwardRule / AwardResult
    └── Result Publication
```

### 3.1 Không biến Competition thành Assignment

Không tạo trước `6 × số_học_sinh` Assignment records. Quyền truy cập một vòng được xác định từ:

```text
AudienceSnapshot
+ server time / Round schedule
+ Grade Quiz Mapping
+ Prerequisite
+ Attempt policy
```

Attempt chỉ tạo khi học sinh thực sự bắt đầu. Assignment tiếp tục phục vụ bài tập về nhà/giao bài bình thường.

### 3.2 Tái sử dụng Live Exam

Competition không viết engine thi trực tiếp mới. `SchoolExamRoom` liên kết `LiveExamSession`; join/status/autosave/submit/scoring/activity tiếp tục qua Live Exam Engine.

---

## 4. Data model

Tên collection/table cuối cùng có thể điều chỉnh theo convention hiện tại, nhưng semantics dưới đây là bắt buộc.

### 4.1 `CompetitionCampaign`

- `id`
- `name`
- `schoolYear`
- `description?`
- `timezone` (default nghiệp vụ: `Asia/Ho_Chi_Minh`)
- `status`
- `audienceMode: ALL_SCHOOL | GRADES | CLASSES`
- `createdBy`
- `createdAt`
- `publishedAt?`
- `qualificationLockedAt?`
- `resultsPublishedAt?`
- `archivedAt?`

Lifecycle:

```text
DRAFT
→ PUBLISHED
→ ACTIVE
→ QUALIFICATION_LOCKED
→ SCHOOL_EXAM_READY
→ SCHOOL_EXAM_RUNNING
→ SCHOOL_EXAM_CLOSED
→ RESULT_PUBLISHED
→ ARCHIVED
```

Implementation có thể derive một số state từ timestamps nếu phù hợp data-store, nhưng transition/gate phải enforce server-side.

### 4.2 `CompetitionAudienceSnapshot`

- `campaignId`
- `studentId`
- `grade`
- `classId`
- `studentNameSnapshot?`
- `classNameSnapshot?`
- `status: ACTIVE | WITHDRAWN | DISQUALIFIED`
- `snapshottedAt`

Logical unique key: `campaignId + studentId`.

### 4.3 `CompetitionRound`

- `id`
- `campaignId`
- `roundNumber` (`1..6` trong V1)
- `name`
- `status: DRAFT | SCHEDULED | OPEN | CLOSED | FINALIZED`
- `opensAt`
- `closesAt`
- `passingScore`
- `maxScore`
- `maxAttempts?`
- `requirePreviousRound`
- `requiredForSchoolExam`
- `resultPolicy: HIGHEST_SCORE`
- `showResultImmediately: true`

Ràng buộc:

- `opensAt < closesAt`
- unique `campaignId + roundNumber`
- Vòng 1 không được `requirePreviousRound=true`
- prerequisite chỉ trỏ về vòng ngay trước và không tạo cycle

### 4.4 `CompetitionRoundQuiz`

- `campaignId`
- `roundId`
- `grade`
- `quizId`

Unique: `roundId + grade`.

### 4.5 `CompetitionRoundProgress`

Đây là **read model có thể rebuild**, không phải nguồn chứng cứ gốc.

- `campaignId`
- `roundId`
- `studentId`
- `attemptCount`
- `bestScore`
- `bestAttemptId?`
- `latestScore?`
- `latestAttemptId?`
- `status: NOT_STARTED | IN_PROGRESS | NOT_PASSED | PASSED`
- `passedAt?`
- `updatedAt`

Nguồn gốc vẫn là Quiz attempts/results.

### 4.6 `CompetitionEligibility`

- `campaignId`
- `studentId`
- `status: ELIGIBLE | NOT_ELIGIBLE | OVERRIDDEN`
- `missingRequiredRounds[]`
- `snapshotVersion`
- `calculatedAt`
- `lockedAt?`
- `overriddenBy?`
- `overrideReason?`
- `overriddenAt?`

### 4.7 `SchoolExamEvent`

- `id`
- `campaignId`
- `title`
- `status: DRAFT | SCHEDULED | RUNNING | CLOSED | PUBLISHED`
- `examWindowStartsAt`
- `examWindowEndsAt`
- `resultVisibility: AFTER_PUBLISH`
- `createdBy`
- `createdAt`
- `closedAt?`
- `publishedAt?`

### 4.8 `SchoolExamRoom`

- `id`
- `schoolExamEventId`
- `grade`
- `name`
- `startsAt`
- `endsAt`
- `liveExamSessionId`
- `status`

Không lưu toàn bộ học sinh trong một `studentIds[]` array.

### 4.9 `SchoolExamRoomMember`

Membership là record riêng:

- `schoolExamEventId`
- `roomId`
- `studentId`
- `grade`
- `classIdSnapshot`
- `assignedAt`
- `assignedBy`

Unique trong event: một `studentId` chỉ được ở **một room**. Cấu trúc này tránh giới hạn document/row lớn và giúp query/move student rõ ràng.

### 4.10 `SchoolExamRetestAuthorization`

- `id`
- `schoolExamEventId`
- `studentId`
- `originalAttemptId`
- `replacementAttemptId?`
- `reason`
- `authorizedBy`
- `authorizedAt`
- `expiresAt?`
- `status: GRANTED | USED | EXPIRED | REVOKED`

### 4.11 `OfficialSchoolExamResult`

Snapshot chính thức dùng cho ranking/export/certificate:

- `schoolExamEventId`
- `campaignId`
- `studentId`
- `grade`
- `classId`
- `roomId`
- `officialAttemptId`
- `score`
- `maxScore`
- `durationMs`
- `correctCount?`
- `wrongCount?`
- `warningsCount`
- `startedAt`
- `submittedAt`
- `rank?`
- `award?`
- `resultVersion`
- `lockedAt?`

### 4.12 `CompetitionAwardRule` / `CompetitionAwardResult`

Rule theo `campaignId + grade`:

- `awardCode/name`
- `maxRecipients`
- `minimumScore?`
- `priority`

Award result lưu student, grade, rank, award code, result version và thời điểm chốt.

### 4.13 `CompetitionAuditLog`

- `campaignId`
- `actorId`
- `actorRole`
- `action`
- `targetType`
- `targetId`
- `reason?`
- `before?`
- `after?`
- `createdAt`

Audit không được xóa từ UI.

---

## 5. Luồng nghiệp vụ

### 5.1 Tạo và publish

```text
DRAFT campaign
→ chọn scope
→ cấu hình 6 rounds
→ map quiz theo grade
→ campaign preflight
→ preview audience
→ publish
→ create AudienceSnapshot idempotently
→ PUBLISHED / ACTIVE khi đến lịch
```

Campaign preflight chặn nếu thiếu round, thiếu quiz của grade nằm trong scope, audience rỗng, schedule không hợp lệ hoặc prerequisite sai.

### 5.2 Start round

`POST .../rounds/:roundId/start` là gate trung tâm. Backend kiểm tra:

1. campaign đã publish;
2. student có trong AudienceSnapshot;
3. round đang mở theo **server time**;
4. grade hợp lệ;
5. có quiz mapping cho grade;
6. prerequisite đạt nếu yêu cầu;
7. còn lượt nếu `maxAttempts` hữu hạn;
8. quiz có thể bắt đầu.

Stable business codes:

- `ROUND_NOT_OPEN`
- `ROUND_CLOSED`
- `NOT_IN_AUDIENCE`
- `PREREQUISITE_NOT_MET`
- `MAX_ATTEMPTS_REACHED`
- `QUIZ_NOT_ASSIGNED`
- `CAMPAIGN_LOCKED`

Frontend không tự quyết `canStart`.

### 5.3 Submit round và progress

Sau scoring thành công:

```text
Quiz attempt submitted
→ scoring complete
→ CompetitionProgressService
→ atomic/idempotent update
→ attemptCount
→ bestScore/bestAttempt
→ PASSED nếu bestScore >= passingScore
```

Double submit/retry không được tăng attempt count lần hai. Progress phải rebuild được từ source attempts.

### 5.4 Qualification

```text
finalize required rounds
→ calculate eligibility theo batch
→ admin review
→ resolve overrides
→ snapshot
→ QUALIFICATION_LOCKED
```

Batch phải idempotent và có progress để admin theo dõi.

### 5.5 Generate School Exam

```text
locked eligibility
→ group by grade/class
→ default rooms by class
→ create SchoolExamRoomMember
→ admin merge/split/move
→ assign time slots + grade quiz
→ create/link LiveExamSession
→ school-exam preflight
→ SCHOOL_EXAM_READY
```

Preflight chặn nếu:

- eligible student chưa có room;
- student xuất hiện ở >1 room;
- room thiếu LiveExamSession;
- grade/quiz mismatch;
- ca nằm ngoài exam window;
- quiz không hợp lệ;
- room/session config không hợp lệ.

### 5.6 Thi chính thức

Trong room:

```text
WAITING → ACTIVE → SUBMITTED → LOCKED
```

Student chỉ vào room được gán, đúng ca và đúng authorization. Sau submit chỉ thấy đã ghi nhận bài.

### 5.7 Retest

```text
original official attempt
→ incident reviewed
→ admin grant retest + reason
→ authorization GRANTED
→ replacement attempt
→ replacement submit/scoring accepted
→ original SUPERSEDED
→ authorization USED
→ replacement becomes official result
```

Nếu authorization hết hạn/thu hồi trước khi có replacement hợp lệ, original result vẫn giữ hiệu lực, trừ khi có explicit admin invalidation flow có audit.

### 5.8 Reconcile, rank, award, publish

```text
all rooms closed
→ reconcile attempts/retests
→ resolve critical issues
→ build OfficialSchoolExamResult
→ rank per grade
→ preview awards
→ admin publish
→ lock final result version
```

Không cho publish khi còn retest pending hoặc reconcile critical issue.

---

## 6. UI/UX

Competition có menu riêng **Sân chơi**, không nhét vào **Giao bài**.

### 6.1 Admin

Các màn hình chính:

1. Danh sách Sân chơi
2. Wizard tạo campaign
3. Cấu hình 6 vòng + quiz theo khối
4. Preflight / audience preview
5. Dashboard vận hành 6 vòng
6. Eligibility review/override
7. School Exam: Tổng quan / Phòng thi / Giám sát / Kết quả
8. Retest & incident handling
9. Ranking/award preview
10. Publish result
11. Export XLSX

Dashboard phải paginate/filter server-side theo grade/class/status/search.

### 6.2 Teacher

Teacher thấy:

- tiến độ các vòng trong lớp;
- học sinh đạt/chưa đạt;
- eligibility của lớp;
- School Exam result sau thời điểm được phép;
- export `.xlsx` lớp mình.

Không có control thay đổi luật toàn trường.

### 6.3 Student

Student thấy hành trình:

```text
V1 ✓
V2 ✓
V3 đang mở
V4 khóa vì prerequisite
V5 chưa đến lịch
V6 chưa đến lịch
School Exam khóa/chưa đủ điều kiện
```

Mỗi vòng hiển thị lịch, điểm đạt, best score, lượt đã dùng/tối đa, trạng thái và lý do khóa. Sau qualification lock, student đủ điều kiện thấy room/ca. Sau School Exam submit chỉ thấy bài đã được ghi nhận đến khi publish.

---

## 7. API boundaries

Tên route cuối cùng có thể thích ứng router hiện tại; capability boundary cần tương đương.

### Admin

```text
POST   /api/competitions
PATCH  /api/competitions/:id
POST   /api/competitions/:id/preflight
POST   /api/competitions/:id/publish

POST   /api/competitions/:id/rounds
PATCH  /api/competitions/:id/rounds/:roundId
POST   /api/competitions/:id/rounds/:roundId/finalize

GET    /api/competitions/:id/eligibility
POST   /api/competitions/:id/eligibility/:studentId/override
POST   /api/competitions/:id/eligibility/lock

POST   /api/competitions/:id/school-exam
POST   /api/competitions/:id/school-exam/generate-rooms
POST   /api/competitions/:id/school-exam/preflight
POST   /api/competitions/:id/school-exam/reconcile
POST   /api/competitions/:id/school-exam/students/:studentId/retest
POST   /api/competitions/:id/school-exam/results/publish

GET    /api/competitions/:id/export
```

### Teacher

Read/export endpoints resolve authorized class scope server-side.

### Student

```text
GET  /api/student/competitions
GET  /api/student/competitions/:id
POST /api/student/competitions/:id/rounds/:roundId/start
GET  /api/student/competitions/:id/school-exam
```

Submit/scoring tiếp tục qua Quiz/Live Exam routes hiện có. Competition progress/result integration chạy từ server-side service/hook; client không gọi một endpoint tùy ý để tự ghi `PASSED` hay official result.

---

## 8. Consistency, idempotency và recovery

### 8.1 Server time

Tất cả schedule gates dùng server time. Browser clock không quyết định quyền mở vòng hoặc vào ca.

### 8.2 Operations phải idempotent/transactional

- audience snapshot publish;
- round start;
- submit → progress update;
- eligibility calculation/lock;
- room generation/member assignment;
- retest authorization;
- reconcile;
- official result snapshot;
- ranking/award calculation;
- export generation khi retry.

### 8.3 Recovery

Phải có đường chạy lại an toàn:

- RoundProgress từ attempts;
- eligibility từ finalized progress;
- rooms từ locked eligibility trước khi exam starts;
- official result từ resolved Live Exam attempts/retests;
- ranking từ official results.

Workflow bình thường không được phụ thuộc sửa database thủ công khi job/request lỗi giữa chừng.

---

## 9. Data locking và audit

Ba mốc khóa:

1. **Audience Locked** — publish campaign.
2. **Qualification Locked** — trước School Exam.
3. **Result Published** — official result/ranking/award khóa.

Audit actions tối thiểu:

- `CAMPAIGN_PUBLISHED`
- `ROUND_UPDATED_AFTER_PUBLISH`
- `ROUND_EXTENDED`
- `QUALIFICATION_LOCKED`
- `ELIGIBILITY_OVERRIDDEN`
- `ROOM_GENERATED`
- `ROOM_CHANGED`
- `STUDENT_MOVED_ROOM`
- `RETEST_GRANTED`
- `RETEST_EXPIRED`
- `ATTEMPT_SUPERSEDED`
- `EXAM_RECONCILED`
- `EXAM_CLOSED`
- `RANKING_CALCULATED`
- `AWARD_RULE_CHANGED`
- `RESULTS_PUBLISHED`
- `EXPORT_GENERATED`

### 9.1 Lock có kiểm soát sau publish

- Round chưa mở: được chỉnh schedule/rule/quiz nếu preflight vẫn hợp lệ.
- Round đã mở nhưng chưa có attempt: chỉ các thay đổi policy cho phép, có warning + audit.
- Round đã có attempt: khóa quiz, max score, passing rule, result policy và các trường ảnh hưởng fairness/result.
- Có thể gia hạn `closesAt` nếu policy cho phép; luôn audit.
- Sau ca thi đầu tiên của School Exam: đóng băng cấu hình cốt lõi; chỉ giữ vận hành/sự cố.
- Sau `RESULT_PUBLISHED`: không sửa âm thầm; tương lai nếu cần correction phải version hóa.

---

## 10. XLSX chính thức

Export là `.xlsx` thật từ backend/service và snapshots, không từ các rows đang hiển thị ở frontend.

Workbook V1 toàn trường:

1. `01_Tong_quan`
2. `02_Vong_1`
3. `03_Vong_2`
4. `04_Vong_3`
5. `05_Vong_4`
6. `06_Vong_5`
7. `07_Vong_6`
8. `08_Du_dieu_kien`
9. `09_Thi_cap_truong`
10. `10_Xep_hang`
11. `11_Thi_lai_Su_co`
12. `12_Audit`

`01_Tong_quan` có một student/row với grade/class, V1–V6 best score/status, eligibility + `NORMAL/ADMIN_OVERRIDE`, official School Exam score/duration/warnings, rank, award và result status.

Metadata workbook:

- campaign ID/name;
- school year;
- exportedAt/exportedBy;
- qualificationLockedAt;
- resultsPublishedAt;
- resultVersion.

Quyền export:

- Admin: toàn trường / khối / lớp / phòng.
- Teacher: chỉ lớp được phân quyền.

Authorization luôn server-side.

---

## 11. Certificate

V1 hỗ trợ tối thiểu:

1. chứng nhận hoàn thành sân chơi;
2. giấy chứng nhận đạt giải cấp trường.

Chỉ sinh sau `RESULT_PUBLISHED` và tái sử dụng certificate infrastructure hiện có.

---

## 12. Performance và scale

### 12.1 Tránh fan-out

Không tạo Assignment cho mọi `student × round`. Audience snapshot là một record/student/campaign; progress có thể tạo lazy hoặc batch.

### 12.2 Dashboard

Không N+1 query theo student/round. Dùng aggregate/read model + pagination server-side (`50–100` rows/page tùy UI).

Filter chính: campaign, round, grade, class, progress status, eligibility, search.

### 12.3 School Exam

Không đưa toàn trường vào một Live Exam Session. Dùng nhiều room sessions và aggregate qua `SchoolExamEvent`.

Trước production phải benchmark:

- **100 học sinh đồng thời**: target vận hành;
- **150 học sinh đồng thời**: stress.

Flow benchmark: join, room/status polling, autosave, submit, scoring, admin monitoring.

Endpoint polling nóng không được chạy global sweep/query theo toàn kỳ thi.

### 12.4 Query/index paths

Storage/index cần hỗ trợ hiệu quả ít nhất:

```text
campaignId + studentId
campaignId + grade
campaignId + classId
campaignId + roundId + status
roundId + studentId
schoolExamEventId + grade
schoolExamEventId + roomId
schoolExamEventId + studentId
studentId + campaignId
```

Index cụ thể được khóa trong implementation plan theo Firestore/schema thực tế.

---

## 13. Security và fairness

- Không tin client time.
- Không tin client role/scope IDs.
- Student không thể start quiz grade khác dù biết ID.
- Teacher không thể export lớp khác.
- Frontend không tự ghi `PASSED`, eligibility, rank, award hoặc official result.
- Không tự động trừ điểm do anti-cheat warning trong V1.
- Existing Live Exam warnings dùng cho monitoring và tie-break theo rule đã duyệt.
- Hạ tầng lỗi không được làm student mất lượt một cách im lặng.

---

## 14. Error handling

Business errors dùng stable machine-readable codes; infrastructure errors tách khỏi business denial.

Ví dụ:

- `ROUND_NOT_OPEN`
- `ROUND_CLOSED`
- `NOT_IN_AUDIENCE`
- `PREREQUISITE_NOT_MET`
- `MAX_ATTEMPTS_REACHED`
- `QUIZ_NOT_ASSIGNED`
- `NOT_ELIGIBLE`
- `EXAM_ROOM_NOT_ASSIGNED`
- `EXAM_NOT_STARTED`
- `EXAM_ALREADY_SUBMITTED`
- `RETEST_NOT_AUTHORIZED`
- `RESULT_ALREADY_PUBLISHED`

Client map code sang thông báo tiếng Việt; không suy luận nghiệp vụ từ message text.

---

## 15. Test strategy

### 15.1 Unit

- round access policy;
- prerequisite;
- highest-score selection;
- attempt limit;
- eligibility;
- ranking comparator;
- tied ranks;
- award boundary;
- retest fallback khi replacement không hoàn tất.

### 15.2 API/Authorization

- Student/Teacher/Admin allowed/denied;
- spoof `studentId`/`classId`/grade;
- round closed/not-open;
- teacher cross-class export;
- admin-only override/retest/publish.

### 15.3 Integration

- Quiz attempt → RoundProgress;
- finalized progress → eligibility;
- locked eligibility → rooms/members;
- Live Exam attempt → OfficialSchoolExamResult;
- retest accepted → original superseded + replacement official;
- retest expired unused → original remains official;
- official result → ranking/award/export/certificate.

### 15.4 State transitions

- invalid campaign transition bị chặn;
- locked round fields không sửa được;
- School Exam config khóa sau start;
- publish result bị chặn khi reconcile/retest còn pending.

### 15.5 Concurrency/idempotency

- double start;
- double submit;
- retry after timeout;
- concurrent best-score updates;
- two admins grant retest;
- duplicate room membership;
- repeated eligibility batch;
- repeated room generation/reconcile.

### 15.6 Load

- 100 concurrent operational benchmark;
- 150 concurrent stress benchmark;
- polling/autosave/submit/scoring/admin monitoring độc lập và phối hợp.

---

## 16. Acceptance criteria V1

V1 chỉ hoàn thành khi end-to-end chạy mà không cần sửa DB thủ công:

```text
Admin tạo Sân chơi
→ chọn audience
→ gắn đề từng khối cho 6 vòng
→ cấu hình lịch/luật
→ preflight + publish
→ snapshot audience
→ student làm V1–V6
→ highest-score progress đúng
→ eligibility đúng
→ admin lock qualification
→ generate rooms/members
→ merge/split/move + assign slots
→ School Exam preflight
→ Live Exam execution
→ incident/retest handling
→ reconcile
→ official result snapshot
→ ranking theo khối
→ awards
→ publish result
→ student/teacher/admin visibility đúng
→ XLSX chính thức
→ certificate
```

CI/regression hiện có phải pass. Load benchmark phải đáp ứng target 100 / stress 150 theo latency/error-rate thresholds được định lượng trong implementation plan.

---

## 17. Non-goals V1

Không đưa vào V1:

- thi liên trường/cấp xã/tỉnh/quốc gia;
- public live leaderboard toàn trường;
- social sharing;
- anti-cheat engine mới;
- tự động trừ điểm do warning;
- SMS/Zalo automation;
- AI phân tích năng lực;
- workflow khiếu nại/correction hoàn chỉnh;
- badge/gamification mở rộng;
- bắt buộc queue/export async nếu benchmark sync export vẫn đạt.

---

## 18. Rủi ro và biện pháp

### Drift attempts ↔ RoundProgress

Idempotent/atomic updates + rebuild path + concurrency tests.

### Roster thay đổi giữa campaign

AudienceSnapshot + grade/class snapshot tại publish.

### Lộ đề giữa nhiều ca

Tận dụng randomization hiện có hoặc bộ đề tương đương; không công bố School Exam answers/results trước publish.

### Live Exam chịu tải không đủ

Chia rooms + tránh global polling sweep + benchmark 100/150 trước release.

### Admin thay luật sau khi student làm

Field-level lifecycle lock + audit.

### Retest làm mất official result

Original giữ provisional official cho tới khi replacement hợp lệ; chỉ supersede sau reconcile chấp nhận replacement.

### Student room membership không nhất quán

Dùng `SchoolExamRoomMember` với uniqueness `(eventId, studentId)` + transactional move + preflight duplicate detection.

---

## 19. Phân kỳ capability

Đây **không phải implementation plan chi tiết**. Plan chính thức chỉ viết sau khi spec này được user duyệt.

Khuyến nghị chia capability:

1. Competition core + storage/contracts + admin CRUD/preflight.
2. Audience snapshot + 6-round student flow + progress.
3. Eligibility + teacher/admin dashboards.
4. SchoolExamEvent/rooms/members + Live Exam integration + preflight.
5. Retest/reconcile/official results/ranking/awards.
6. XLSX + certificates + hardening/load tests.

Mỗi capability phải giữ backward compatibility cho Assignment và Live Exam hiện có.

---

## 20. Kết luận kiến trúc

```text
Competition = lịch + luật + audience + progress + eligibility
            + School Exam orchestration + official results

Quiz        = nội dung + attempt + scoring của V1–V6
Live Exam   = runtime thi trực tiếp theo từng phòng
Assignment  = giao bài thông thường, không phải primitive của campaign
```

V1 cố định 6 vòng theo yêu cầu hiện tại. Boundary/data model không được hard-code theo môn hay thương hiệu, để phiên bản sau có thể mở rộng sang các sân chơi khác mà không viết lại Quiz/Live Exam engine.