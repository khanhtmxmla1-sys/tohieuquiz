# Competition Campaign V1 — 6 vòng và Thi cấp trường

**Ngày:** 2026-08-19  
**Trạng thái:** Design approved in chat; pending final written-spec review  
**Phạm vi:** QuizPro — Sân chơi 6 vòng → xét điều kiện → Thi cấp trường → xếp hạng/giải → XLSX/chứng nhận

## 1. Mục tiêu

Xây dựng một subsystem **Sân chơi / Competition** cho phép nhà trường tổ chức một hành trình thi giống mô hình Trạng Nguyên nhưng không hard-code vào một môn hay thương hiệu cụ thể:

1. Admin tạo một sân chơi cho toàn trường, một hoặc nhiều khối/lớp.
2. Sân chơi gồm **6 vòng**; mỗi vòng có lịch mở/đóng và luật riêng.
3. Mỗi vòng có **một đề riêng theo từng khối**.
4. Học sinh làm các vòng theo điều kiện cấu hình; kết quả vòng lấy **điểm cao nhất trong các lượt hợp lệ**.
5. Sau các vòng bắt buộc, hệ thống chốt danh sách **đủ điều kiện Thi cấp trường**.
6. Thi cấp trường là **một kỳ thi cấp cao**, bên dưới có nhiều phòng/ca thi và tái sử dụng Live Exam Engine hiện tại.
7. Admin xử lý sự cố/thi lại có audit, đóng kỳ thi, reconcile, xếp hạng theo khối, gán giải và công bố kết quả.
8. Admin/giáo viên xuất **Excel `.xlsx` thật** theo phạm vi được phép; hệ thống có thể cấp chứng nhận sau công bố.

Mục tiêu thiết kế là tái sử dụng Quiz, attempt/scoring, Live Exam, notification, result/certificate hiện có thay vì viết lại engine làm bài và engine thi trực tiếp.

---

## 2. Các quyết định đã khóa

### 2.1 Luật 6 vòng

Mỗi vòng cấu hình độc lập:

- `opensAt`
- `closesAt`
- `passingScore`
- `maxAttempts` (`null` có thể biểu diễn không giới hạn)
- `requirePreviousRound`
- `requiredForSchoolExam`
- result policy V1: `HIGHEST_SCORE`
- result visibility V1–V6: hiển thị ngay sau submit

Vòng 1 có thể là vòng tự do. Vòng 2–6 có thể là vòng điều kiện. Không hard-code rằng Vòng 2–6 luôn phải `>= 200/300`; đó là cấu hình mặc định có thể thay đổi.

### 2.2 Đối tượng tham gia

Admin được chọn:

- toàn trường;
- một hoặc nhiều khối;
- một hoặc nhiều lớp.

Khi publish campaign, hệ thống tạo **Audience Snapshot**. Việc học sinh đổi lớp, nghỉ học hoặc học sinh mới được thêm sau đó không âm thầm làm thay đổi roster gốc của campaign.

### 2.3 Đề theo khối

Mỗi vòng ánh xạ một `quizId` cho từng khối nằm trong scope. Không copy câu hỏi sang Competition.

Ví dụ Vòng 3:

- Grade 1 → Quiz A
- Grade 2 → Quiz B
- Grade 3 → Quiz C
- Grade 4 → Quiz D
- Grade 5 → Quiz E

### 2.4 Điều kiện vào Thi cấp trường

Eligibility được tính server-side từ các vòng có `requiredForSchoolExam=true`.

- `ELIGIBLE`: đủ toàn bộ điều kiện.
- `NOT_ELIGIBLE`: còn vòng bắt buộc chưa đạt.
- `OVERRIDDEN`: admin đặc cách, bắt buộc có lý do và audit.

Trước khi tạo kỳ thi chính thức, eligibility được **snapshot và khóa**.

### 2.5 Thi cấp trường

Một `SchoolExamEvent` chứa nhiều `SchoolExamRoom`.

- Mặc định tự tạo phòng theo lớp.
- Admin có thể gộp/tách phòng trước khi kỳ thi bắt đầu.
- Mỗi phòng có ca thi cụ thể trong một khung thi chính.
- Mỗi phòng liên kết tới một `LiveExamSession`.
- Mỗi khối có đề phù hợp riêng.

### 2.6 Kết quả Thi cấp trường

Học sinh mặc định có **1 lượt chính thức**.

Nếu sự cố:

- chỉ admin được cấp thi lại;
- bắt buộc nhập lý do;
- lượt cũ không bị xóa;
- lượt cũ chuyển `SUPERSEDED`/không còn là kết quả chính thức;
- lượt thay thế được dùng làm official result.

Không áp dụng “điểm cao nhất” cho kỳ thi chính thức.

### 2.7 Công bố kết quả

Vòng 1–6: hiển thị kết quả ngay.

Thi cấp trường: sau submit chỉ hiện đã ghi nhận bài. Không hiện điểm/đáp án/xếp hạng cho đến khi:

1. mọi phòng đã đóng;
2. reconcile không còn critical issue;
3. mọi thi lại/sự cố cần xử lý đã hoàn tất;
4. ranking/award preview hoàn tất;
5. admin chủ động `PUBLISH RESULTS`.

### 2.8 Xếp hạng và giải

Xếp hạng chính thức **theo từng khối**.

Comparator V1:

1. `score DESC`
2. `durationMs ASC`
3. `warningsCount ASC`
4. `submittedAt ASC`
5. nếu vẫn bằng hoàn toàn → đồng hạng

Dùng competition ranking, ví dụ `1, 2, 2, 4`.

Giải thưởng cấu hình theo khối. Không hard-code số lượng giải.

### 2.9 Phân quyền

- **Admin:** toàn quyền cấu hình campaign, publish, eligibility, school exam, rooms, retest, reconcile, publish result, export toàn trường.
- **Teacher:** xem tiến độ/kết quả và export trong phạm vi lớp được phân công; không sửa luật toàn trường.
- **Student:** chỉ xem campaign mình thuộc audience, làm vòng/quizzes đúng grade, vào đúng room/ca, xem dữ liệu của chính mình.

Backend phải tự xác minh quyền; không tin `studentId`, `teacherId`, `classId` do client gửi.

---

## 3. Kiến trúc tổng thể

Chọn phương án **Competition Orchestrator đặt trên các engine hiện có**.

```text
CompetitionCampaign
├── AudienceSnapshot
├── CompetitionRound × 6
│   ├── RoundQuizMapping per grade → existing Quiz
│   └── RoundProgress per participating student
├── Qualification / Eligibility Snapshot
└── SchoolExamEvent
    ├── SchoolExamRoom → existing LiveExamSession
    ├── RetestAuthorization
    ├── OfficialSchoolExamResult
    ├── AwardRule / AwardResult
    └── Result Publication
```

### 3.1 Không dùng Assignment làm primitive bắt buộc cho 6 vòng

Assignment tiếp tục phục vụ bài tập về nhà/giao bài thông thường.

Competition không tạo sẵn `6 × số_học_sinh` Assignment records. Quyền vào vòng được xác định từ:

```text
AudienceSnapshot
+ Round schedule
+ Grade Quiz Mapping
+ Prerequisite
+ Attempt policy
```

Attempt chỉ tạo khi học sinh thực sự bắt đầu.

Điều này tránh fan-out dữ liệu không cần thiết và không làm Assignment model gánh thêm lifecycle của một cuộc thi nhiều vòng.

### 3.2 Tái sử dụng Live Exam

Competition không viết engine thi trực tiếp mới. `SchoolExamRoom` là orchestration record liên kết tới `LiveExamSession`; join/status/autosave/submit/scoring/activity của phòng thi tiếp tục chạy qua Live Exam Engine.

---

## 4. Data model đề xuất

Tên collection/table cụ thể có thể điều chỉnh theo conventions hiện tại của repo; semantics dưới đây là bắt buộc.

### 4.1 `CompetitionCampaign`

Các trường chính:

- `id`
- `name`
- `schoolYear`
- `description?`
- `timezone` (mặc định nghiệp vụ: `Asia/Ho_Chi_Minh`)
- `status`
- `audienceMode`: `ALL_SCHOOL | GRADES | CLASSES`
- `createdBy`
- `createdAt`
- `publishedAt?`
- `qualificationLockedAt?`
- `resultsPublishedAt?`
- `archivedAt?`

Campaign state:

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

Một số trạng thái có thể được derive từ timestamps trong implementation nếu điều đó phù hợp data-store hiện tại, nhưng transition phải được enforce server-side.

### 4.2 `CompetitionAudienceSnapshot`

- `campaignId`
- `studentId`
- `grade`
- `classId`
- `classNameSnapshot?`
- `studentNameSnapshot?`
- `status`: `ACTIVE | WITHDRAWN | DISQUALIFIED` (V1 có thể chỉ cần `ACTIVE` và giữ khả năng mở rộng)
- `snapshottedAt`

Khóa duy nhất logic: `campaignId + studentId`.

### 4.3 `CompetitionRound`

- `id`
- `campaignId`
- `roundNumber` (1–6)
- `name`
- `status`: `DRAFT | SCHEDULED | OPEN | CLOSED | FINALIZED`
- `opensAt`
- `closesAt`
- `passingScore`
- `maxScore`
- `maxAttempts?`
- `requirePreviousRound`
- `requiredForSchoolExam`
- `resultPolicy`: `HIGHEST_SCORE`
- `showResultImmediately=true`

Ràng buộc:

- `opensAt < closesAt`
- `roundNumber` duy nhất trong campaign
- không tạo prerequisite cycle
- nếu `requirePreviousRound=true`, Vòng 1 không được bật giá trị này

### 4.4 `CompetitionRoundQuiz`

- `campaignId`
- `roundId`
- `grade`
- `quizId`

Khóa logic: `roundId + grade`.

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
- `status`: `NOT_STARTED | IN_PROGRESS | NOT_PASSED | PASSED`
- `passedAt?`
- `updatedAt`

Nguồn chứng cứ gốc vẫn là attempts/results của Quiz Engine.

### 4.6 `CompetitionEligibility`

- `campaignId`
- `studentId`
- `status`: `ELIGIBLE | NOT_ELIGIBLE | OVERRIDDEN`
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
- `status`: `DRAFT | SCHEDULED | RUNNING | CLOSED | PUBLISHED`
- `examWindowStartsAt`
- `examWindowEndsAt`
- `resultVisibility`: `AFTER_PUBLISH`
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
- `studentIds` hoặc room-membership records tùy khả năng scale/query
- `status`

Với Firestore/row-size constraints, ưu tiên membership records thay vì một array rất lớn nếu room size có thể tăng.

### 4.9 `SchoolExamRetestAuthorization`

- `id`
- `schoolExamEventId`
- `studentId`
- `originalAttemptId`
- `replacementAttemptId?`
- `reason`
- `authorizedBy`
- `authorizedAt`
- `status`: `GRANTED | USED | EXPIRED | REVOKED`

### 4.10 `OfficialSchoolExamResult`

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

### 4.11 `CompetitionAwardRule` / `CompetitionAwardResult`

Award rule theo `campaignId + grade`:

- tên giải
- số lượng tối đa
- optional minimum score
- order/priority

Nếu đồng hạng đúng ranh giới giải, UI phải cảnh báo admin; không cắt ngẫu nhiên.

### 4.12 `CompetitionAuditLog`

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

### 5.1 Tạo và publish campaign

```text
Admin tạo campaign DRAFT
→ chọn scope
→ tạo 6 rounds
→ cấu hình schedule/rules
→ map quiz theo grade cho từng round
→ preflight campaign
→ preview audience
→ publish
→ snapshot audience
→ PUBLISHED/ACTIVE khi đến lịch
```

Campaign preflight chặn publish nếu thiếu round, thiếu đề của grade nằm trong scope, lịch sai, prerequisite sai hoặc audience rỗng.

### 5.2 Start một vòng

`POST .../rounds/:roundId/start` là gate trung tâm.

Backend kiểm tra theo thứ tự logic:

1. campaign đã publish;
2. student nằm trong AudienceSnapshot;
3. round đang mở theo **server time**;
4. student có grade hợp lệ;
5. round có quiz mapping cho grade;
6. prerequisite đã đạt nếu yêu cầu;
7. chưa vượt `maxAttempts` nếu giới hạn;
8. quiz có thể bắt đầu.

Từ chối với stable business error codes, ví dụ:

- `ROUND_NOT_OPEN`
- `ROUND_CLOSED`
- `NOT_IN_AUDIENCE`
- `PREVIOUS_ROUND_REQUIRED`
- `MAX_ATTEMPTS_REACHED`
- `QUIZ_NOT_ASSIGNED`
- `CAMPAIGN_LOCKED`

Frontend không tự quyết quyền bắt đầu.

### 5.3 Submit vòng và cập nhật progress

Sau khi Quiz Engine scoring thành công:

```text
Attempt submitted
→ scoring complete
→ CompetitionProgressService
→ atomic/idempotent update
→ attemptCount
→ bestScore/bestAttempt
→ PASSED nếu bestScore >= passingScore
```

Double submit/retry không được tăng attempt count hai lần.

Progress phải có utility/service để rebuild từ source attempts nếu cần recovery.

### 5.4 Khóa eligibility

Sau khi các vòng điều kiện kết thúc:

```text
batch calculate eligibility
→ review ELIGIBLE / NOT_ELIGIBLE / OVERRIDDEN
→ resolve overrides
→ QUALIFICATION_LOCKED
```

Nên xử lý batch thay vì một request dài cho hàng nghìn học sinh; batch phải idempotent và có progress observable cho admin.

### 5.5 Tạo School Exam

```text
locked eligibility
→ group eligible students by grade/class
→ generate default rooms by class
→ admin merge/split/move before exam
→ assign time slots
→ assign quiz by grade
→ create/link LiveExamSession for each room
→ school-exam preflight
→ SCHOOL_EXAM_READY
```

Preflight chặn nếu:

- eligible student chưa có room;
- student bị duplicate ở nhiều room;
- room thiếu LiveExamSession;
- grade/quiz mismatch;
- room schedule ngoài exam window;
- quiz không hợp lệ;
- room/session config không hợp lệ.

### 5.6 Thi chính thức

Trong ca thi:

```text
WAITING → ACTIVE → SUBMITTED → LOCKED
```

Student chỉ được vào room đã gán, đúng exam window và đúng authorization.

Sau submit chỉ hiển thị trạng thái đã ghi nhận, không hiển thị score/answers/rank.

### 5.7 Thi lại

```text
official attempt gặp sự cố
→ admin review
→ grant retest + reason
→ original attempt SUPERSEDED
→ replacement attempt
→ replacement becomes official result
```

Grant retest phải transactional/idempotent để không có hai authorization đang mở cho cùng student/event.

### 5.8 Reconcile, rank, award, publish

```text
all rooms closed
→ reconcile attempts/results/retests
→ resolve critical issues
→ build OfficialSchoolExamResult snapshot
→ rank per grade
→ preview awards
→ admin publish
→ lock final result version
```

Không cho publish khi còn retest pending hoặc reconcile critical issue.

---

## 6. UI/UX

Competition có menu riêng **Sân chơi**, không nhập chung vào Giao bài.

### 6.1 Admin

Các màn hình chính:

1. Danh sách Sân chơi
2. Wizard tạo campaign
3. Cấu hình 6 vòng và quiz mapping theo khối
4. Campaign preflight / audience preview
5. Dashboard vận hành 6 vòng
6. Eligibility review/override
7. School Exam — Tổng quan / Phòng thi / Giám sát / Kết quả
8. Retest & incident handling
9. Ranking/award preview
10. Result publish
11. Export XLSX

Dashboard phải filter/paginate server-side theo grade/class/status/search.

### 6.2 Teacher

Teacher chỉ thấy:

- campaign thuộc học sinh lớp mình;
- participation/pass progress theo vòng;
- danh sách học sinh đạt/chưa đạt;
- eligibility của lớp;
- school exam result sau khi được phép xem;
- export XLSX lớp mình.

Không có control thay đổi campaign law/schedule/quiz/eligibility/retest.

### 6.3 Student

Student thấy một hành trình liên tục:

```text
V1 ✓
V2 ✓
V3 đang mở
V4 khóa vì prerequisite
V5 chưa đến lịch
V6 chưa đến lịch
School Exam khóa/chưa đủ điều kiện
```

Mỗi vòng hiển thị:

- lịch;
- điểm đạt;
- best score;
- lượt đã dùng/tối đa;
- trạng thái;
- lý do khóa nếu không vào được.

Sau qualification lock, student đủ điều kiện thấy room/ca/ngày thi. Sau school-exam submit chỉ thấy đã ghi nhận bài cho tới khi admin publish.

---

## 7. API boundaries

Tên route cuối cùng có thể thích ứng router hiện tại, nhưng bounded interfaces cần tương đương:

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
POST   /api/competitions/:id/school-exam/results/publish
POST   /api/competitions/:id/school-exam/students/:studentId/retest

GET    /api/competitions/:id/export
```

### Teacher

Read/export endpoints phải resolve authorized class scope từ backend.

### Student

```text
GET  /api/student/competitions
GET  /api/student/competitions/:id
POST /api/student/competitions/:id/rounds/:roundId/start
GET  /api/student/competitions/:id/school-exam
```

Submit/scoring có thể tiếp tục qua Quiz/Live Exam routes hiện có; Competition integration chạy tại server-side completion hooks/services thay vì client tự gọi “update progress”.

---

## 8. Consistency, idempotency và recovery

### 8.1 Server time

Tất cả gate thời gian dùng server time. Browser clock không quyết định quyền mở vòng hoặc vào ca thi.

### 8.2 Idempotent operations

Bắt buộc idempotent hoặc transactional đối với:

- round start;
- round submit/progress update;
- audience publish snapshot;
- eligibility calculation;
- room generation;
- retest authorization;
- school-exam reconcile;
- official result snapshot generation;
- ranking calculation;
- export generation nếu có retry.

### 8.3 Recovery

Các read models/snapshots chưa publish phải có khả năng rebuild/re-run an toàn:

- `RoundProgress` từ attempts;
- eligibility từ finalized progress;
- rooms từ locked eligibility (trước khi exam starts);
- official result snapshot từ resolved Live Exam attempts/retests;
- ranking từ official results.

Không chấp nhận workflow mà lỗi giữa chừng bắt buộc sửa database thủ công trong điều kiện vận hành bình thường.

---

## 9. Audit và data locking

Ba mốc khóa chính:

1. **Audience Locked** — khi campaign publish.
2. **Qualification Locked** — trước School Exam.
3. **Result Published** — official result/ranking/award khóa.

Các action bắt buộc audit tối thiểu:

- `CAMPAIGN_PUBLISHED`
- `ROUND_UPDATED_AFTER_PUBLISH`
- `ROUND_EXTENDED`
- `QUALIFICATION_LOCKED`
- `ELIGIBILITY_OVERRIDDEN`
- `ROOM_GENERATED`
- `ROOM_CHANGED`
- `STUDENT_MOVED_ROOM`
- `RETEST_GRANTED`
- `ATTEMPT_SUPERSEDED`
- `EXAM_RECONCILED`
- `EXAM_CLOSED`
- `RANKING_CALCULATED`
- `AWARD_RULE_CHANGED`
- `RESULTS_PUBLISHED`
- `EXPORT_GENERATED`

### 9.1 Khóa có kiểm soát sau publish

- Round chưa mở: admin có thể chỉnh schedule/rule/quiz trong giới hạn hợp lệ.
- Round đã mở nhưng chưa có attempt: có thể cho phép một số chỉnh sửa với warning + audit.
- Round đã có attempt: khóa các trường làm thay đổi fairness/result như quiz, max score, passing rule/result policy.
- Có thể gia hạn `closesAt` nếu policy cho phép, luôn audit.
- Sau ca thi đầu tiên của School Exam: gần như đóng băng cấu hình, chỉ giữ operations xử lý vận hành/sự cố.

Sau `RESULT_PUBLISHED`, không sửa âm thầm. Nếu tương lai cần correction, phải dùng versioned correction workflow.

---

## 10. Báo cáo XLSX

Export là `.xlsx` thật, dựng từ backend/service và official snapshots, không từ rows đang hiển thị ở frontend.

Workbook toàn trường V1:

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

### 10.1 Tổng quan

Một student/row:

- mã học sinh;
- họ tên;
- grade/class;
- V1–V6 best score/status;
- eligibility + `NORMAL/ADMIN_OVERRIDE`;
- official school exam score;
- duration;
- warnings;
- grade rank;
- award;
- result status.

### 10.2 Metadata export

Workbook cần metadata tối thiểu:

- campaign ID/name;
- school year;
- exportedAt/exportedBy;
- qualificationLockedAt;
- resultsPublishedAt;
- resultVersion.

### 10.3 Quyền export

- Admin: toàn trường / khối / lớp / phòng.
- Teacher: chỉ lớp được phân quyền.

Authorization thực thi server-side.

---

## 11. Certificate

V1 chỉ cần hai loại:

1. chứng nhận hoàn thành sân chơi;
2. giấy chứng nhận đạt giải cấp trường.

Chỉ sinh sau `RESULT_PUBLISHED`. Competition tái sử dụng certificate infrastructure hiện có; không viết certificate engine mới.

---

## 12. Performance và scale

### 12.1 Tránh fan-out

Không tạo trước Assignment cho mọi `student × round`. Audience snapshot chỉ một record/student/campaign; progress có thể tạo lazy hoặc batch khi cần.

### 12.2 Dashboard

Không N+1 query theo từng student/round. Cần aggregate endpoints/read models và pagination server-side (`50–100` rows/page tùy UI).

Các filter chính:

- campaign;
- round;
- grade;
- class;
- progress status;
- eligibility;
- search.

### 12.3 School Exam

Không gom toàn trường vào một Live Exam Session. Chia thành room sessions, aggregate ở SchoolExamEvent.

Trước production phải benchmark:

- **100 học sinh đồng thời**: target vận hành;
- **150 học sinh đồng thời**: stress.

Các flow benchmark:

- join;
- room/status polling;
- autosave;
- submit;
- scoring;
- admin monitoring.

Không được có global sweep/query theo toàn kỳ thi trên endpoint student polling nóng.

### 12.4 Index/query paths

Thiết kế storage/index phải hỗ trợ hiệu quả ít nhất các truy vấn:

```text
campaignId + studentId
campaignId + grade
campaignId + classId
campaignId + roundId + status
roundId + studentId
schoolExamEventId + grade
schoolExamEventId + roomId
studentId + campaignId
```

Index cụ thể được xác định theo Firestore/schema hiện tại trong implementation plan.

---

## 13. Security và fairness

- Không tin thời gian client.
- Không tin role/scope IDs từ client.
- Không cho student gọi quiz của grade khác dù biết ID.
- Không cho teacher export lớp khác.
- Không cho frontend tự ghi `PASSED`, eligibility, rank, award hoặc official result.
- Không tự động trừ điểm chỉ dựa trên anti-cheat warning ở V1.
- Existing Live Exam activity/warnings được dùng để monitoring và tie-break theo rule đã duyệt.
- Lỗi hạ tầng không được làm student mất lượt một cách im lặng.

---

## 14. Error handling

Business errors phải có stable machine-readable codes. Infrastructure errors phải tách biệt khỏi business denial.

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

Client map code sang thông báo tiếng Việt; không suy luận logic từ HTTP status/text.

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
- award boundary.

### 15.2 API/Authorization

- Student/Teacher/Admin allowed/denied flows;
- spoof `studentId`/`classId`/grade;
- round closed/not-open;
- teacher cross-class export;
- admin-only override/retest/publish.

### 15.3 Integration

- Quiz attempt → RoundProgress;
- finalized progress → eligibility;
- locked eligibility → room generation;
- Live Exam attempt → OfficialSchoolExamResult;
- retest → superseded original + replacement official result;
- official result → ranking/award/export/certificate.

### 15.4 State transitions

- invalid campaign transition bị chặn;
- locked round fields không sửa được;
- School Exam config khóa sau start;
- result publish bị chặn khi reconcile/retest còn pending.

### 15.5 Concurrency/idempotency

- double start;
- double submit;
- retry after network timeout;
- concurrent best-score updates;
- two admins granting retest;
- repeated eligibility batch;
- repeated room generation/reconcile.

### 15.6 Load

- 100 concurrent operational benchmark;
- 150 concurrent stress benchmark;
- polling/autosave/submit/scoring/admin monitoring riêng và phối hợp.

---

## 16. Acceptance criteria V1

V1 chỉ được coi là hoàn thành khi chạy end-to-end mà không cần chỉnh database thủ công:

```text
Admin tạo Sân chơi
→ chọn audience
→ gắn đề từng khối cho 6 vòng
→ cấu hình lịch/luật
→ preflight + publish
→ snapshot audience
→ student làm V1–V6
→ highest score/progress đúng
→ eligibility đúng
→ admin lock qualification
→ generate rooms
→ merge/split/move + assign slots
→ school-exam preflight
→ Live Exam execution
→ incident/retest handling
→ reconcile
→ official results
→ ranking theo khối
→ awards
→ publish result
→ student/teacher/admin visibility đúng
→ XLSX chính thức
→ certificate
```

Ngoài functional acceptance, CI/regression hiện có phải pass và load benchmark phải đáp ứng target 100 / stress 150 theo tiêu chí latency/error rate được định lượng trong implementation plan.

---

## 17. Non-goals V1

Không đưa vào V1:

- thi liên trường/cấp xã/tỉnh/quốc gia;
- public live leaderboard toàn trường;
- social sharing;
- engine anti-cheat mới;
- tự động trừ điểm do warning;
- SMS/Zalo automation;
- AI phân tích năng lực;
- workflow khiếu nại/correction hoàn chỉnh;
- badge/gamification mở rộng;
- queue/export async bắt buộc nếu benchmark synchronous export vẫn đạt.

---

## 18. Rủi ro và biện pháp

### 18.1 Drift giữa attempts và RoundProgress

**Giảm thiểu:** update idempotent/atomic + rebuild path + tests concurrency.

### 18.2 Thay đổi roster/lớp giữa campaign

**Giảm thiểu:** AudienceSnapshot và grade/class snapshot tại publish.

### 18.3 Lộ đề giữa nhiều ca

**Giảm thiểu:** randomization hiện có hoặc bộ đề tương đương theo policy; không hiển thị đáp án/result School Exam trước publish.

### 18.4 Live Exam chịu tải không đủ

**Giảm thiểu:** chia rooms + không global polling sweep + benchmark 100/150 trước release.

### 18.5 Admin thay luật sau khi student đã làm

**Giảm thiểu:** field-level lock theo lifecycle + audit.

### 18.6 Reconcile sai official attempt sau retest

**Giảm thiểu:** explicit RetestAuthorization + superseded marker + deterministic reconcile + snapshot official result.

---

## 19. Phân kỳ implementation đề xuất

Đây **không phải implementation plan chi tiết**; chỉ là boundary để tránh một PR quá lớn. Plan chính thức sẽ được viết sau khi spec này được user duyệt.

Khuyến nghị tách theo capability:

1. Competition core + storage/contracts + admin CRUD/preflight.
2. Audience snapshot + 6-round student flow + progress.
3. Eligibility + teacher/admin dashboards.
4. SchoolExamEvent/rooms + Live Exam integration + preflight.
5. Retest/reconcile/official results/ranking/awards.
6. XLSX + certificates + hardening/load tests.

Mỗi capability phải giữ backward compatibility cho Assignment và Live Exam hiện có.

---

## 20. Kết luận kiến trúc

Competition V1 là **orchestration subsystem**, không phải replacement cho Assignment, Quiz hoặc Live Exam.

Boundary cốt lõi:

```text
Competition = lịch + luật + audience + progress + eligibility
            + school-exam orchestration + official results

Quiz        = nội dung + attempt + scoring của V1–V6
Live Exam   = runtime thi trực tiếp theo từng phòng
Assignment  = giao bài thông thường, không phải primitive của campaign
```

Thiết kế này đáp ứng mô hình 6 vòng → Thi cấp trường hiện tại nhưng vẫn cho phép QuizPro sau này tạo các sân chơi Toán, Tiếng Việt, Tiếng Anh hoặc số vòng khác mà không phải viết lại engine lõi.