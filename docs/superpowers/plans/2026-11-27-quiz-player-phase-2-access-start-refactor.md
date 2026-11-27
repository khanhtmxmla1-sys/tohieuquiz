# Refactor useQuizPlayer đợt 2 — truy cập và bắt đầu bài

Ngày lập: 2026-11-27. Người dùng đã duyệt 9 file ban đầu, bổ sung Mobile và tiếp tục duyệt bổ sung riêng test login; phạm vi hiện là 11 file. Đang triển khai synchronization test login và verification cuối. Commit/push/PR vẫn chờ duyệt phạm vi cuối theo AGENTS.md bước 6.

## 1. Baseline và mục tiêu

- Baseline `origin/main`: `da6b04b5d2e6a70ee6c8cbffb78f02b9727dbd2a`, sau PR #212 của đợt 1.
- Frontend production đã xác minh: deployment `8106299217`, success; https://tohieuquiz-3izc3p2a0-vh-s-projects3.vercel.app. Smoke public 10/10, public/authenticated 14/14 và reliability browser 6/6 đã đạt trong đợt 1.
- Worktree riêng đã tạo: `C:\Users\Administrator\.codex\worktrees\refactor-quiz-player-access-start\quizpro`.
- Branch: `codex/refactor-quiz-player-access-start`. `C:\quizpro` còn thay đổi dở và main local cũ, nên dùng origin/main làm mốc đối chiếu.
- Mục tiêu: tách xác minh mã truy cập và pipeline tải câu hỏi/kiểm tra quyền bắt đầu assignment khỏi facade `useQuizPlayer`; giữ hành vi quan sát được và public return shape hiện tại.
- Đây là refactor frontend. Không đổi scoring, giới hạn lượt nguyên tử, Worker contract, services API, DTO, schema storage, migration D1, dependency, secret hoặc feature flag.

## 2. Kết quả khảo sát và rủi ro

Đã đọc `useQuizPlayer`, `StudentView`, service truy cập quiz, service assignment, route registry và các form hiện có. Đã có khảo sát test và review kiến trúc độc lập chỉ đọc.

GitNexus đã index mới trên worktree, baseline da6b04b: 27.385 nodes, 55.687 edges, 300 flows. Kết quả upstream:

| Symbol | Caller trực tiếp được index | Process được index bị ảnh hưởng | Risk |
| --- | --- | --- | --- |
| useQuizPlayer, xác định bằng Function UID | 1: StudentView | 0 | LOW |
| handleStart trong facade | 0 | 0 | LOW |
| handleCodeVerify trong facade | 0 | 0 | LOW |

FTS không khả dụng; query theo concept trả rỗng kèm cảnh báo degraded search. Context/impact theo UID hoạt động. Số process bằng 0 không chứng minh React callback không có ảnh hưởng; test qua facade và browser là bắt buộc. Khi triển khai phải chạy lại impact trên mọi symbol thực sự sửa, gồm fixture/helper test nếu thay đổi. Nếu HIGH/CRITICAL phải báo và chờ xác nhận riêng theo AGENTS.md.

Rủi ro nghiệp vụ cần khóa bằng test: vòng đời grant, thứ tự fetch/preflight, khóa Start đồng thời, thử lại sau lỗi và thời điểm khởi tạo đồng hồ. Không dùng mức LOW của call graph để bỏ các kiểm tra này.

## 3. Kiến trúc được đề xuất

### 3.1 useQuizAccess

Tạo `hooks/useQuizAccess.ts`, quản lý `enteredCode`, `setEnteredCode`, `codeError`, `isVerifyingCode` và `handleCodeVerify`.

- Nhận định danh quiz/assignment theo các field hiện tại, trạng thái đăng nhập và callback chuyển bước ổn định. Truyền trực tiếp setter `setStep`; kiểu callback chỉ nhận `info | notice`, không import QuizStep từ facade để tránh vòng phụ thuộc.
- `accessGrantRef` tiếp tục do facade tạo bằng useRef, sống cùng instance của useQuizPlayer. Hook nhận ref ổn định và chỉ ghi nó theo đúng nhánh hiện tại; không trả grant trong public return của facade.
- Giữ đúng dependency theo quiz ID, assignment ID, isLoggedIn, enteredCode và isVerifyingCode. Thêm dependency ref/callback ổn định khi lint yêu cầu; không phụ thuộc ref.current hay một object kết quả mới mỗi render.
- valid=true: ghi `access.accessGrant || null`, rồi chuyển notice nếu đã đăng nhập, info nếu là khách. valid=true thiếu grant vẫn chuyển bước như baseline.
- invalid/error: giữ nguyên grant cũ và thông báo hiện tại. Đổi input chưa tự xóa codeError; bắt đầu verify mới mới xóa lỗi.
- Không thêm mutex bằng ref, cache grant, tự gia hạn, reset theo quiz prop hoặc hủy request. isVerifyingCode hiện là state guard; không nâng nó thành cam kết chống mọi lời gọi trong cùng một tick.

### 3.2 loadQuizStartQuestions

Tạo `utils/loadQuizStartQuestions.ts`, một async function dùng các service hiện có, không quản lý React state hoặc timer.

Input chỉ gồm các field quiz cần dùng, session/student identity cần kiểm tra và grant trong bộ nhớ. Ưu tiên kiểu Pick từ Quiz/StudentSession hiện có; không thêm any hoặc DTO mới. Giữ ngữ nghĩa snapshot/captured session của callback hiện tại khi thiết kế input.

Thứ tự bắt buộc:

1. Lấy assignment ID bằng quy tắc truthy rồi String như baseline; không thêm trim hoặc biến undefined thành chuỗi.
2. Quiz thường/công khai/assignment: gọi fetchQuizPlayQuestions với assignmentId/accessGrant hiện hành; chỉ đi qua adaptStudentQuizQuestion. Không lấy câu hỏi từ catalog hoặc draft làm fallback, không gọi authoring normalizer.
3. Practice: dùng quiz.questions trong bộ nhớ; không gọi scoped play endpoint hoặc adapter.
4. Payload questions không phải array ở nhánh formal được quy về []; danh sách rỗng ném đúng thông báo `Không tải được câu hỏi của bài làm.`.
5. Khi có assignment ID: sau khi có câu hỏi hợp lệ mới kiểm session.studentId; thiếu ID ném đúng lỗi đăng nhập lại, không gọi preflight. Có ID thì await startAssignmentAttempt với String(studentId).
6. Chỉ trả questions sau preflight thành công. Response preflight hiện chỉ được dùng để cho phép/từ chối; không dùng deadline/remainingAttempts của response để thay timer hoặc cách đếm lượt.

Practice bình thường không có assignment thì bỏ preflight. Nếu dữ liệu synthetic practice có assignment metadata, baseline vẫn chạy preflight; phải giữ nhánh đó.

### 3.3 useQuizPlayer tiếp tục là facade

- Giữ getInitialStep, profile, draft-read useMemo, answers, page, startTime/expiresAt, result và các hook đợt 1.
- Giữ startTriggeredRef, isStarting, startError, guard đầu handleStart, catch/finally và reset khóa khi thất bại.
- Gọi loadQuizStartQuestions trong try; sau await giữ nguyên resolveQuizDraftResume, randomization policy, shuffleWithinLevel/shuffleArray và thứ tự cập nhật state.
- Giữ Date.now sau khi tải/preflight thành công, reset submissionTriggeredRef, đặt questions/answers/page/start/deadline rồi chuyển step='quiz'. Không đổi đồng hồ thành thời điểm bấm nút hoặc deadline của assignment.
- Đọc accessGrantRef.current tại invocation của start và submit như hiện tại; grant không được chụp từ render hoặc đưa vào state/storage/public return.
- Giữ nguyên handleSubmit, handleRetryReward, timeout effect, answer updates, scoring và public return keys. Chỉ thay wiring thật sự cần cho hai phần tách.
- Không đổi UI form, thêm spinner/lỗi cho guest, thay randomization hay sửa các hành vi cũ ngoài mục tiêu.

## 4. Phạm vi đã duyệt: 11 file sau bổ sung

| File | Thay đổi dự kiến |
| --- | --- |
| src/features/quiz-player/hooks/useQuizPlayer.ts | Wiring hook truy cập và loader; giữ facade/start guard |
| src/features/quiz-player/hooks/useQuizAccess.ts | Hook mới cho input/error/busy/verify code |
| src/features/quiz-player/utils/loadQuizStartQuestions.ts | Loader mới cho scoped/practice questions và assignment preflight |
| tests/useQuizPlayerAccessCode.test.tsx | Bổ sung characterization grant và chuyển bước qua facade |
| tests/useQuizPlayerStart.test.tsx | File mới khóa load/preflight/start/retry qua facade |
| tests/studentDashboardCopy.test.ts | Rà thông báo tiếng Việt ở module thực sự sở hữu nó; đưa hai module mới vào corpus |
| cypress/e2e/student-quiz-access-start.cy.ts | Browser characterization mới cho code/start/deny/retry |
| cypress/e2e/mobile-responsive.cy.ts | Bổ sung đã duyệt: API/login fixture xác định, chờ/requery form và assert dashboard thật; giữ nhóm Competition |
| cypress/e2e/login-home.cy.ts | Bổ sung đã duyệt: chờ form/URL commit, assertion retry và requery DOM; giữ đủ 6 ca/contract |
| package.json | Chỉ thêm spec mới vào cypress:run:stubbed, giữ các spec cũ |
| docs/superpowers/plans/2026-11-27-quiz-player-phase-2-access-start-refactor.md | Plan và bằng chứng triển khai |

`studentDashboardCopy.test.ts` đang yêu cầu literal lỗi nằm trong useQuizPlayer; chuyển check sang nguồn loader mới. Không sao chép literal trở lại facade chỉ để giữ test xanh và không xóa kiểm tra bản dịch.

Cả CI lẫn Release readiness đang chạy `npm run cypress:run:stubbed`, danh sách spec nằm trong package.json. Thêm spec mới tại script này để CI thật sự chạy regression. Không cần sửa lockfile hoặc workflow. Spec reliability của đợt 1 vẫn chạy focused riêng vì chưa thuộc danh sách đó.

Các test resume/navigation/deadline/practice/submission/service/Worker hiện có sẽ chạy lại, không mặc định chỉnh chúng. Nếu triển khai đòi thêm file hoặc sửa hành vi, trình phạm vi bổ sung trước khi sửa.

## 5. Ma trận characterization trước khi tách

Test chính đi qua useQuizPlayer, tránh chỉ test helper bằng mock tự khẳng định implementation. Dùng deferred promises, fake clock và assertion call order/state để kiểm tra các điểm bất đồng bộ.

### Access và grant

1. requireCode ưu tiên hơn đăng nhập/draft; khách bắt đầu ở code, valid → info; học sinh đã đăng nhập valid → notice.
2. Đúng quizId, enteredCode và assignmentId được truyền tới service. Service tests hiện khóa chuẩn hóa mã, 403 invalid và lỗi mạng; xử lý HTTP 400 đã được rà source nhưng chưa có ca service test riêng. Bổ sung HTTP 400 bằng browser intercept trong spec mới, không tuyên bố test cũ đã phủ nhánh này.
3. Busy state trong lúc pending; không gửi lại từ render đã busy; finally trả về false ở success/invalid/error.
4. valid có grant, valid thiếu grant, invalid và network error có đúng hành vi ref/error/step như baseline.
5. Verify thành công → Start chuyển đúng grant sang scoped fetch. Submission regression xác nhận chính grant đó trong context onSaveResult, không nằm trong resultData.
6. Grant không xuất hiện trong public return của facade. enteredCode vẫn được trả công khai cho AccessCodeForm như baseline. Cả grant lẫn mã nhập thử không xuất hiện trong draft/sessionStorage/localStorage hoặc submitted result; grant chỉ đi trong request/context được phép. Chọn giá trị thử riêng biệt với nội dung fixture để kiểm tra không nhầm catalog.
7. Reload/remount không tự phục hồi grant; draft của quiz requireCode vẫn phải qua code. Không thêm grant vào quiz object hoặc store.
8. Các stale-response/same-tick-verify/ref chưa reset khi đổi props được mô tả theo baseline; không âm thầm biến refactor thành sửa race.

### Load, assignment và start

1. Thiếu name/class: không fetch hoặc preflight; double Start khi request đang pending chỉ chạy một pipeline.
2. Formal fetch đúng quizId, assignmentId/grant; dùng câu hỏi DTO vừa tải, không dùng câu hỏi catalog cũ hoặc draft để vượt kiểm tra quyền.
3. Fetch pending: chưa preflight, chưa step quiz; với bài mới không có draft thì chưa tạo deadline. Nếu có draft, useQuizDeadline đã nhận expiresAt cũ từ mount: assert không tạo/gia hạn deadline hay thay draft, không assert mọi timer phải bằng 0. Fetch reject, questions rỗng/non-array: không preflight, không tạo draft mới, không render câu hỏi catalog.
4. Assignment thiếu studentId: báo lỗi sau bước load như baseline; không gọi preflight. Khi có studentId: đúng assignment/student và thứ tự load → preflight.
5. Preflight pending: chưa áp câu hỏi hoặc tạo deadline mới; draft có sẵn giữ timer/deadline cũ như baseline. Preflight denied/error: giữ step trước start, hiển thị startError ở hook, không ghi draft mới.
6. Dùng fake clock giữ preflight lâu: bài mới bắt đầu timer sau thành công; deadline trong response preflight không thay deadline quiz. Draft hợp lệ vẫn giữ startedAt/expiresAt cũ, không được gia hạn.
7. Sau lỗi load/preflight: isStarting false, khóa ref được mở; retry xóa startError và chạy lại fetch/preflight. Start thành công tiếp tục giữ khóa như baseline.
8. Practice không assignment: dùng câu hỏi memory, không fetch/adapt/preflight. Practice có assignment metadata: vẫn kiểm student và preflight.
9. Public không assignment: không preflight; không có grant tự chế. Các loại câu hỏi cấu trúc và MCQ/MULTIPLE_SELECT giữ presentation fields/opaque IDs từ adapter.
10. Randomization off, nhóm difficulty, resume order, answers, page và deadline tiếp tục do facade/đợt 1 quyết định; không thay thuật toán hoặc sửa duplicate-ID behavior trong đợt này.

## 6. Browser và CI

Tạo hai fixture local riêng: guest dùng quiz có mã nhưng không assignment; học sinh đăng nhập dùng quiz có mã và assignment. Guest có assignment là ca từ chối vì thiếu studentId sau scoped fetch, không phải ca start thành công. Intercept toàn bộ API liên quan, không dùng tài khoản thật hoặc ghi dữ liệu production:

- POST /api/quizzes/access-verification/:quizId.
- POST /api/quizzes/:quizId/play-questions.
- POST /api/assignments/:assignmentId/start.
- Session/profile/catalog/settings cần cho fixture theo pattern hiện có; chặn request ghi ngoài fixture và không xác nhận nộp bài thật.

Các ca tối thiểu: mã sai rồi đúng bằng Enter, gồm intercept HTTP 400 khi verify; busy verify; guest không assignment valid → info → start; học sinh đăng nhập có assignment valid → notice; scope grant/assignment body; fetch hoặc preflight từ chối rồi retry; pending không hiện câu hỏi; desktop và 320px không tràn ngang. Response scoped dùng learner DTO không có đáp án đúng.

StudentInfoForm hiện không nhận isStarting/startError từ StudentView. Browser assertion thông báo lỗi nghiệp vụ áp dụng màn notice của học sinh đã đăng nhập; không sửa guest UI trong đợt này. Ở guest kiểm bước/request/state mà UI hiện có cho phép quan sát.

Chạy spec mới trên baseline trước và sau extraction; thêm vào cypress:run:stubbed. Chạy riêng student-quiz-reliability để khóa lại đợt 1. Nếu baseline browser không đáp ứng một assertion, điều chỉnh theo hành vi thực tế và ghi hạn chế; không tuyên bố đã kiểm tra một luồng chưa chạy.

## 7. Các task thực hiện sau khi duyệt

### Task 1 — Chốt baseline, scope và dependency sạch

Kiểm tra origin/main/deployment mới nhất và thay đổi baseline nếu main đã tiến. Dùng worktree/branch đã tạo nếu còn phù hợp; giữ nguyên root và các worktree khác. Kiểm dung lượng, cài npm ci đúng lockfile ở root/Worker khi cần verification; không mượn node_modules bằng junction. Chạy lại GitNexus context/impact, lưu kết quả trước sửa symbol.

### Task 2 — Characterization và browser baseline

Chạy bộ hiện có liên quan trước. Thêm test facade và browser theo ma trận, chứng minh chúng chạy qua code gốc trước extraction. Đây là refactor giữ parity nên characterization phải GREEN trên baseline; không tạo lỗi giả để gọi là RED. Nếu phát hiện yêu cầu sửa behavior, tách phạm vi và áp dụng regression RED → GREEN cho bản sửa đó sau khi được duyệt. TDD executable behavior change: N/A trong phạm vi refactor thuần này; test-before-extraction vẫn bắt buộc.

### Task 3 — Tách useQuizAccess

Delegate scoped implementation cho worker theo AGENTS.md, giới hạn file và chưa commit. Giữ ref ở facade, giữ initial step và callbacks. Chạy access/start/submission tests sau wiring. Orchestrator đọc diff thật, đối chiếu dependency, input/step và grant lifecycle với baseline; sửa finding trước task tiếp.

### Task 4 — Tách loadQuizStartQuestions

Tách đúng load/adapt/empty/session/preflight theo thứ tự hiện có. Không kéo shuffle, resume, deadline hoặc các setter vào loader. Cập nhật source-copy test về module thực. Chạy start matrix, resume, deadline, practice và assignment submission. Review thêm await boundary bằng deferred promises và fake clock.

### Task 5 — Wiring CI và kiểm tra browser cuối

Thêm spec mới vào script đã nêu; giữ toàn bộ allowlist cũ. Chạy spec mới, reliability đợt 1 và npm run cypress:run:stubbed với dev server/flag theo CI; kiểm log local xác nhận script đã chọn spec mới. Log hosted CI được xác minh sau khi mở PR ở Task 7; log Release readiness được xác minh sau merge ở Task 8 vì workflow này chạy trên main push hoặc manual dispatch.

### Task 6 — Review độc lập và verification đầy đủ

Chạy ít nhất:

```powershell
npm run test:run -- tests/useQuizPlayerAccessCode.test.tsx tests/useQuizPlayerStart.test.tsx tests/useQuizPlayerResume.test.tsx tests/useQuizPlayerNavigation.test.tsx tests/useQuizDeadline.test.tsx tests/quizAssignmentSubmission.test.tsx tests/useQuizPlayerPracticeSubmission.test.tsx tests/useQuizPlayerRewards.test.tsx tests/StudentQuizLayout.test.tsx tests/studentDashboardCopy.test.ts tests/quizAccessService.test.ts tests/studentQuizQuestionDto.worker.test.ts tests/quizPlayAccess.worker.test.ts tests/practiceService.test.ts
npm run verify
npm run perf:budget
```

Ngoài ra chạy các browser commands ở Task 5 và các gate bắt buộc của PR. Nếu npm launcher Windows lặp lại lỗi fixture như đợt 1, ghi rõ lệnh/exit code, đối chiếu file không đổi, chạy trực tiếp Node để chẩn đoán; không dùng rerun để che failure và vẫn yêu cầu CI đầy đủ PASS.

So sánh submit/reward/timeout/public return và các hook đợt 1 với baseline; giải quyết hết P1/P2. Refresh GitNexus rồi detect_changes trên toàn bộ file mới và file sửa so với origin/main, phân biệt React callback không được graph index. Rà staged diff thực trước commit.

### Task 7 — Duyệt phạm vi cuối, commit, push và PR

Trình đúng file, diff, test evidence, risk và hạn chế; chờ duyệt AGENTS.md bước 6 trước commit/push. Stage đúng 11 file đã duyệt sau bổ sung. Mở PR main, xác minh log CI chạy spec mới, đợi required CI và code-owner approval trên HEAD cuối; kiểm tra HEAD ngay trước merge.

### Task 8 — Production verification, rollback và cleanup

Sau merge xác minh SHA/environment của frontend production, CI/Security/Release readiness và log spec mới trong Release readiness. Chạy smoke chỉ đọc public/authenticated và public browser. Chạy spec access/start cùng reliability với fixture chặn API trên frontend đã deploy; không dùng một lượt assignment production thật để kiểm tra refactor.

Trước phát hành ghi lại frontend deployment đã biết tốt (hiện là da6b04b/8106299217); nếu phát hiện regression, rollback/promote frontend đã xác minh theo quyền và quy trình hiện có. Xác minh lại storage version 1 và smoke sau rollback. Worker deploy/migration: N/A vì đợt này không đổi backend; nếu phát sinh thì phải có plan và approval production riêng.

Lưu bằng chứng ngoài worktree, kiểm tra cây mã sạch và đúng commit đã merge trước khi dọn worktree/branch. Main local chỉ fast-forward khi an toàn; giữ nguyên các thay đổi dở. Báo SHA/status cuối và nhắc lập plan đợt 3.

## 8. Điều kiện nghiệm thu và giới hạn

- Hai module có caller thật; facade giữ public API và quyền sở hữu token ref/start guard đúng thiết kế.
- Không có fallback câu hỏi cũ, đáp án đúng hoặc grant bị đưa vào learner storage/public data để phục vụ UI.
- Thứ tự load → preflight → resume/randomize → clock/state được test trên baseline và refactor.
- Failure/retry/double Start, guest/coded/assignment/practice và regression đợt 1 đạt.
- Browser mới được CI và Release readiness chạy, required checks/code-owner review/production smoke đạt.
- Không trộn cải tiến cancellation, idempotency, storage denial/quota, duplicate draft IDs, guest error UI hoặc chính sách timer vào refactor này.
- Khi xong đợt 2 phải nhắc và lập plan riêng cho đợt 3: submit, authoritative result, manual/timeout, retry và rewards; chưa triển khai đợt 3 từ approval của đợt 2.

Tại thời điểm lập plan: chỉ tài liệu này được tạo trong worktree mới. Chưa cài dependency, chưa chạy bộ test mới và chưa sửa code. Số test/smoke của đợt 1 là bằng chứng baseline đã giao, không phải kết quả triển khai đợt 2.

## 9. Nhật ký thực hiện sau khi duyệt

- Người dùng đã duyệt plan 9 file. Baseline origin/main khi bắt đầu vẫn là da6b04b.
- GitNexus index up-to-date; upstream impact được chạy lại cho useQuizPlayer (LOW, 1 caller StudentView, 0 indexed flows), handleStart và handleCodeVerify (LOW, 0 indexed callers/flows).
- npm ci root đạt 771 package và npm ci Worker đạt 63 package theo lockfile; không dùng junction, lockfile không đổi.
- Bộ regression hiện có trước extraction đạt 130/130 trong 12 file, gồm resume/navigation/deadline/assignment/practice/reward/layout/copy/access service/learner DTO/Worker access.
- Gói characterization hook ban đầu đạt 19/19; sau bổ sung ma trận đạt 25/25 trên code gốc. Review độc lập phát hiện và yêu cầu siết assertion remount grant, assignment pending/empty và dùng output adapter; worker đã sửa, chạy lại 25/25 và review xác nhận hết P1/P2 trong hai file test.
- Các assertion bổ sung khóa verify từ render đang busy, grant không xuất hiện trong public facade/storage, retry tải lại câu hỏi và khóa Start sau thành công. Race same-tick/stale response, cancellation và lỗi quota/denial vẫn ngoài phạm vi sửa hành vi.
- Browser baseline mới đạt 6/6 trước khi áp dụng production patch, gồm verify HTTP 400/thử lại bằng Enter, busy verify, scoped load pending, assignment start, scoped load retry và preflight retry; có viewport 320px.
- Fixture ban đầu có wildcard GET bắt nhầm module Vite trong đường dẫn src/services/api; đã giới hạn bằng pathname /api/**. Fixture cũng mô phỏng riêng telemetry chỉ chấp nhận kind=web_vital; báo lỗi ứng dụng và writes khác vẫn bị chặn/làm test thất bại.
- Worker chuẩn bị patch 4 file production/copy-test trong artifact ignored; orchestrator và reviewer đối chiếu trước khi áp dụng. Review yêu cầu giữ captured session object và normalize assignment ID bên trong verify try; patch đã chỉnh đúng trước khi apply.
- Sau extraction, bộ tập trung đạt 155/155 trong 14 file và typecheck frontend đạt. Đối chiếu source xác nhận toàn bộ đoạn từ handleAnswerChange đến cuối facade giữ nguyên so với baseline, gồm submit/reward/timeout/public return.
- Review diff thực tế độc lập không còn P1/P2. P3 còn lại: alias kiểu raw assignment ID dẫn xuất từ metadata Quiz vốn đang khai báo any; không đổi schema/type metadata toàn hệ thống trong đợt này.
- Browser cuối với flags giống CI đạt 12/12: spec mới 6/6 và reliability đợt 1 6/6. Worker verification hết credit nên orchestrator tiếp quản; kết quả này do orchestrator chạy trực tiếp.
- Lint, typecheck frontend/strict/Worker đã qua trong npm run verify. Phiên verify đầu bị gián đoạn trước khi có kết quả full shard; đang chạy lại bộ test đầy đủ và các gate còn lại riêng, không tuyên bố lệnh verify đầu đã hoàn tất.
- GitNexus refresh gặp hai lỗi startup timeout rồi đã index thành công (27.474 nodes, 55.795 edges, 300 flows); probe riêng xác nhận parser khởi động được. FTS vẫn không khả dụng.
- Phân tích read-only sau refresh: detect_changes compare origin/main cho 4 file đã tracked báo 8 symbols/0 indexed flows/LOW. Hai module mới được kiểm tra upstream riêng: useQuizAccess có 1 caller trực tiếp useQuizPlayer và 1 gián tiếp StudentView, LOW; loadQuizStartQuestions có 1 caller handleStart, LOW. File mới chưa stage không nằm trong git diff; sẽ chạy lại detect_changes trên đầy đủ scope đã stage sau approval và trước commit.
- Coverage đạt 56/56 test và vượt ngưỡng cấu hình: statements 88,32%, branches 62,12%, functions 94,73%, lines 89,38%. Security scan/history/policies đều đạt; audit production root và Worker đều 0 lỗ hổng.
- Full Vitest qua npm: shard 1 đạt 180 file/1.058 test; shard 2 đạt 180 file/996 test; shard 3 đạt 178 file và 1.102 test, còn hai ca fixture CLI audit nhận exit 2 thay vì 0/1. Lệnh full có exit 1 và dừng trước shard 4. Hai file audit không đổi so với baseline. Chạy riêng dependencyAuditReport bằng Node trực tiếp đạt 28/28; shard 4 trực tiếp đạt 179 file/1.094 test. Tổng cộng 4.252 test khác nhau trong 718 file đã đạt qua các lần chạy, gồm hai ca audit chạy lại. Triệu chứng npm/Node này đã ghi nhận ở đợt 1; không coi lệnh npm full là PASS hoặc khẳng định đã chốt nguyên nhân chính xác.
- Máy có 8 GB RAM; lượt Cypress tổng hợp được dừng sớm khi memory trống thấp để dành cho full Vitest và index. Kết quả browser focused 12/12 đã hoàn tất; lượt Cypress tổng hợp sẽ chạy lại sau các bước nặng.
- Frontend build và performance budget đạt: initial JS gzip 169.257 byte, CSS gzip 48.322 byte; giữ nguyên budget.
- Sau khi dành riêng tài nguyên, script Cypress tổng hợp chạy đủ 12 spec/72 ca: 70 PASS, 2 fail tại mobile-responsive.cy.ts cũ. Spec access/start mới đạt 6/6. Mobile rerun riêng trên candidate đạt 10/14, bốn lỗi Auth; file Mobile không đổi.
- Đã chạy lại impact useQuizPlayer (LOW, 1 caller StudentView) rồi tạm dùng nguyên facade baseline HEAD để đối chiếu, xác minh git diff facade rỗng. Nguyên Mobile spec trên baseline vẫn có 3 lỗi disabled/detached DOM, 11/14 PASS. Sau đó khôi phục candidate và xác nhận SHA256 facade khớp tuyệt đối snapshot: 6D2E5C841676A55BF70C3F8A2E0E7A8FA093FDD36C3D88C33D97EAD342EFD8FD.
- Đã trình đề nghị bổ sung duy nhất cypress/e2e/mobile-responsive.cy.ts (scope 9 → 10) để dùng fixture API/login giả và chờ/requery form đúng trạng thái, giữ kiểm tra responsive và không force/skip. Chưa sửa file ngoài scope. Báo cáo cụ thể: C:\Users\Administrator\.codex\artifacts\quiz-player-phase2-da6b04b\mobile-fixture-scope-proposal.md.
- Người dùng yêu cầu tiếp tục sau đề nghị bổ sung; đã thực hiện đúng một file Mobile. Trước sửa đã chạy impact cho file (LOW, 0 upstream) và helper hiện có (LOW, 1 caller trong chính file, 0 indexed flows). Fixture đăng nhập dùng tài khoản giả/response thành công, kiểm tra dashboard thật thay cho nhánh tùy backend. Auth test vào deep link teacher, xác nhận vai trò/form đã sẵn sàng và truy vấn lại input trước type; không còn clear hoặc click chuyển vai trò gây detached DOM. Việc chuyển vai trò vẫn được kiểm tra trong login-home. Public API được mô phỏng theo pathname; mọi write ngoài fixture bị chặn, telemetry chỉ nhận web_vital. Nhóm Competition vẫn giữ nguyên. Đang chạy kiểm tra phần bổ sung.
- Mobile fixture cuối đạt 14/14; ESLint đạt. Review độc lập actual diff và login/API source xác nhận không còn P1/P2: giữ 14 ca, giữ Competition, yêu cầu dashboard thật và chặn write ngoài allowlist.
- Lượt Cypress tổng hợp sau sửa Mobile hoàn tất 12 spec/72 ca: 71 PASS, 1 fail ở login-home cũ (input sau click hiện mật khẩu vẫn có type password). Mobile đạt 14/14 và access/start mới đạt 6/6 ngay trong lượt này. Giữ nguyên log exit 1 và screenshot; file login-home không đổi. Đang kiểm tra khả năng lặp lại riêng, chưa coi lượt tổng hợp là PASS.
- Nguyên login-home chạy riêng sau đó đạt 6/6, không đổi source/test/timeout. Review độc lập và root đọc lại route xác nhận hai module Phase2 không mount trên trang login anonymous; route remount là giả thuyết timing, chưa được chứng minh là nguyên nhân duy nhất.
- Lượt tổng hợp xác nhận không thay mã cho thấy ca hiện mật khẩu PASS, nhưng login-home có hai fail khác: snapshot URL còn returnTo cũ và không thấy nút teacher khi screenshot còn spinner sau visit. Đã dừng lượt này sau khi lưu log/screenshot, không coi là một lượt full hoàn tất/PASS; không chạy lặp tiếp để chọn kết quả xanh.
- Đã trình đề nghị bổ sung riêng cypress/e2e/login-home.cy.ts, phạm vi 10 → 11, để chờ form/route readiness và thay URL snapshot then bằng assertion retry should, giữ đủ 6 ca và các contract. Impact file LOW, 0 upstream/flows. Đang chờ approval bổ sung, chưa sửa file login; chi tiết ở artifact login-fixture-scope-proposal.md. Commit/push vẫn chưa được duyệt.
- GitNexus refresh cuối sau Mobile đạt 64,3 giây, 27.474 nodes/55.795 edges/300 flows; FTS vẫn không khả dụng. Dùng CLI Node trực tiếp và repo absolute path để tránh wrapper Windows làm tách argument có khoảng trắng. detect_changes compare origin/main: 5 tracked file, 8 symbols, 0 indexed flows, LOW. Function UID impact riêng: useQuizAccess LOW, 1 caller trực tiếp/2 tổng; loader LOW, 1 caller; login file LOW, 0 upstream. File untracked chưa stage không nằm trong detect_changes này; vẫn bắt buộc kiểm đủ scope sau approval trước commit.

- Người dùng đã duyệt bổ sung login-home (10 → 11). Worker sửa đúng test login; root đọc diff và yêu cầu readiness trước brand assertion. Review độc lập không còn P1/P2, giữ đủ 6 ca/contract, exact query URL và requery sau transition. ESLint/diff-check đạt; focused login sau sửa đạt 6/6 bằng Node trực tiếp. Lượt npm startup đầu bị dừng khi RAM còn khoảng 330 MiB; người dùng đã đóng Chrome, đang chạy script stubbed đầy đủ.

- Sau bổ sung login và giải phóng RAM, npm run cypress:run:stubbed hoàn tất 12 spec/72 ca PASS, exit 0 (6m53s): login 6/6, Mobile 14/14, access/start 6/6. Giữ toàn bộ log fail trước đó. Đang chốt GitNexus/manifest 11 file trước final approval commit; chưa stage/commit/push.

- GitNexus refresh sau login PASS (53,8s, 27.474 nodes/55.795 edges/300 flows); detect_changes compare origin/main thấy 6 tracked file/8 symbols/0 flows, LOW. Toàn scope chưa stage gồm 11 file đã rà thủ công và impact module mới riêng; detect_changes staged vẫn bắt buộc sau final approval trước commit. Final report: C:\Users\Administrator\.codex\artifacts\quiz-player-phase2-da6b04b\final-ready-11-files.md.
