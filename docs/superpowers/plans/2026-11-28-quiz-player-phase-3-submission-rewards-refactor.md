# Quiz Player đợt 3 — submit, kết quả chính thức và thưởng

Ngày lập: 28/11/2026. Người dùng yêu cầu chốt plan rồi triển khai ngay; đã cho phép thực hiện phạm vi dưới đây sau review plan, không cần hỏi duyệt plan lần nữa. Final approval commit/push vẫn riêng theo AGENTS.md. Tại thời điểm chốt plan chỉ tạo tài liệu, chưa sửa code/test, chưa chạy test đợt 3.

Tiến độ hiện tại: đã hoàn tất code, review và verification; chờ final approval commit/push/PR đúng 10 file. Chi tiết kết quả và giới hạn nằm ở nhật ký cuối tài liệu và báo cáo artifact.

## 1. Baseline và mục tiêu

- origin/main sau fetch: `6ed97fc48f6948b9d29a03c06695dd1bbe7b9838`, PR #213 đợt 2 đã merge.
- Baseline frontend production đã xác minh ở đợt 2: deployment `8115049383`, SHA trên; public 10/10, authenticated 14/14, public browser 3/3, quiz fixture browser 12/12. CI main có 4.252 test/718 file PASS, Release readiness PASS. Đây là bằng chứng đợt 2, chưa phải test đợt 3.
- Worktree riêng: `C:\Users\Administrator\.codex\worktrees\refactor-quiz-player-submission-rewards\quizpro`.
- Branch: `codex/refactor-quiz-player-submission-rewards`. Main local C:\quizpro còn dirty và ở SHA cũ; không reset/clean/fast-forward hoặc đụng các file đó.
- Mục tiêu: giảm trách nhiệm của facade useQuizPlayer bằng cách tách submission/completion và mapping practice, giữ nguyên hành vi quan sát được, public return và type import hiện tại.
- Không đổi scoring, quyền truy cập, giới hạn lượt nguyên tử, Worker/API contract, schema draft, database, dependency, cấu hình, secret hoặc flag.

## 2. Khảo sát hiện trạng và rủi ro

useQuizPlayer hiện khoảng 505 dòng. handleSubmit đang cùng lúc: chống nộp trùng, tạo payload, chọn formal/secure practice/legacy practice, nhận kết quả, xóa draft, claim thưởng, track activity và chuyển UI. handleRetryReward nằm cùng facade; effect timeout gọi handleSubmit('timeout').

Formal gọi onSaveResult và bắt buộc nhận kết quả trả về. quizStore.submitResult đã kiểm response authoritative đầy đủ; hook hiện chỉ chặn kết quả falsy. Không thêm validator mới hoặc fallback điểm client trong refactor.

Secure practice phân biệt bằng own property practiceSession. Có marker nhưng undefined/null/sai định dạng/hết hạn thì lỗi; không được rơi sang legacy local grading. Không có own marker mới dùng local gradeQuiz và snapshot hiện tại. Practice không save formal, claim thưởng hoặc track activity.

Điểm phải giữ ở đúng await boundary:

1. Guard submissionTriggeredRef/isSubmitting và startTime trước khi nộp; thời gian được tính từ Date.now, làm tròn giây rồi phút như hiện tại.
2. Payload formal có score/correctCount bằng 0, order từ shuffledQuestions, assignmentId theo truthy/String; grant chỉ nằm ở ephemeral callback context.
3. Sau khi grade/save thành công: setResult → clearQuizAttemptDraft → đọc gamification snapshot → claim thưởng nếu đủ điều kiện → setRewardData/showReward → fire-and-forget track activity → setStep result → âm thanh.
4. Khi claim đang pending, result có thể đã được set và draft đã xóa nhưng step vẫn quiz, isSubmitting vẫn true. Không tự đẩy overlay/result sớm hơn.
5. Claim trả null: giữ kết quả đã lưu, overlay status error và vẫn vào result. Retry chỉ claim theo saved resultId; không save lại kết quả.
6. Error thrown bất thường từ claim/clear draft vẫn đi outer catch, có thể đã setResult rồi mới submitError/unlock. Store claim hiện bắt lỗi mạng và trả null; không nhầm null với thrown. Refactor không sửa tình huống bất thường này.
7. Retry reward hiện không có catch/lock riêng: thrown có thể để syncing và reject caller; nhiều retry có thể chạy đồng thời. Không âm thầm bổ sung cancellation, mutex hay chính sách retry.
8. Manual và timeout dùng chung guard. Khi save lỗi và deadline đã hết, các render/effect sau có thể thử nộp lại theo baseline. Không hứa chỉ có một network request cho cả vòng đời sau failure; không thêm backoff hoặc tự dừng retry trong đợt này.

GitNexus baseline đã index mới (173,8s): 27.474 nodes, 55.795 edges, 300 flows. Context theo Function UID xác nhận StudentView là caller ứng dụng trực tiếp. Query concept đã chạy nhưng FTS không khả dụng, trả degraded/rỗng; dùng context/impact theo file và Function kind để tránh ambiguity.

| Symbol | Caller trực tiếp / tổng upstream | Indexed flows | Risk |
| --- | --- | --- | --- |
| useQuizPlayer | 1 / 1 (StudentView) | 0 | LOW |
| handleSubmit | 1 / 2 | 0 | LOW |
| handleRetryReward | 0 / 0 | 0 | LOW |
| mapPracticeGradeToStudentResult | 1 / 3 | 0 | LOW |
| hasOwnProperty | 1 / 3 | 0 | LOW |
| isSecurePracticeSession | 1 / 3 | 0 | LOW |
| isExpiredPracticeSession | 1 / 3 | 0 | LOW |

LOW/0 flows không thay thế test React callbacks hoặc bảo đảm không có ảnh hưởng UI. Import type CompletionRewardData của RewardOverlay được rà source và giữ qua type re-export. Trước sửa executable symbol/test helper vẫn phải chạy impact tương ứng; nếu có HIGH/CRITICAL, dừng xác nhận riêng.

## 3. Ranh giới module đề xuất

### 3.1 hooks/useQuizSubmission.ts

Sở hữu các state hiện có: result, isSubmitting, submitError, showReward, rewardData; giữ handleSubmit và handleRetryReward trong cùng hook để tránh chia nhỏ state orchestration sang hai hook phụ thuộc chéo.

Nhận các giá trị đúng từ render hiện tại: quiz, answers, shuffledQuestions, startTime, studentName/Class, onSaveResult, generateUUID, captured classroom store, hai ref ổn định và callback setStep chỉ nhận 'result'. Không import runtime hoặc QuizStep từ facade.

- submissionTriggeredRef và accessGrantRef tiếp tục được facade tạo bằng useRef. handleStart reset chính submissionTriggeredRef đó; hook đọc/ghi cùng instance. Không snapshot grant từ render hoặc đưa ref.current vào dependencies.
- Giữ captured classroom store/reference và thời điểm đọc studentSession.username sau await; không chụp sớm username ở đầu request hoặc đổi sang classroomStore.getState() nếu baseline không làm vậy.
- useGamificationStore.getState() vẫn đọc sau khi lưu/clear draft; đọc useGameLoopStore lúc track như cũ. Không song song hóa save, claim và track; track vẫn không được await.
- Giữ thứ tự state updates, error message, finally, guards và dependency semantics; không thêm reset khi quiz prop đổi, abort/unmount guard hay cache.
- Định nghĩa CompletionRewardStatus/Data tại hook mới và re-export type từ useQuizPlayer để RewardOverlay giữ import cũ. Không đổi tên field, status ready/syncing/error hoặc UI contract.

### 3.2 utils/practiceSubmission.ts

Tách các helper hiện có: own-property check/session validation, expiry check, mapPracticeGradeToStudentResult; đưa phần dựng legacy practice result thành helper đồng bộ có input cụ thể.

- Giữ nguyên validation hiện có; không tự siết expiry format, version, token hoặc fallback.
- Secure branch trong hook vẫn await gradePracticeQuiz rồi gọi mapper; legacy branch vẫn grade/map đồng bộ. Không gom hai nhánh thành một async function để phát sinh await mới ở legacy.
- Giữ StudentResult/PracticeGradeResponse và shared grading engine hiện tại. Map đủ id, score/count/voided/version, answers/order, validationDetails/reviewDetails; không suy ra review từ catalog cho secure practice.
- Pure helper không sở hữu state, timer, storage, API credentials hoặc gamification.

### 3.3 Facade giữ lại

Access/start hai module đợt 2, UUID/shuffle, identity/answers, page/progress, draft persistence/navigation, deadline và timeout effect, showSubmitConfirm UI state và hai ref vẫn ở facade. Chỉ wiring submission hook, re-export type và bỏ phần đã chuyển. Public return keys và callback signatures giữ nguyên; SubmissionReason manual/timeout không được dùng làm cơ hội đổi payload/chính sách.

## 4. Phạm vi dự kiến: 10 file

| File | Công việc |
| --- | --- |
| src/features/quiz-player/hooks/useQuizPlayer.ts | Wiring hook, giữ ref/timeout và public API, type re-export |
| src/features/quiz-player/hooks/useQuizSubmission.ts | Hook mới cho submit/completion/reward retry |
| src/features/quiz-player/utils/practiceSubmission.ts | Helper practice đồng bộ/mapper/validation |
| tests/useQuizPlayerSubmission.test.tsx | Characterization mới qua facade cho guard/payload/order/failure |
| tests/useQuizPlayerRewards.test.tsx | Bổ sung pending/null/retry/ordering và snapshot timing |
| tests/useQuizPlayerPracticeSubmission.test.tsx | Siết marker/expiry/mapping/no fallback |
| tests/studentDashboardCopy.test.ts | Thêm nguồn hook/helper mới vào corpus kiểm tiếng Việt |
| cypress/e2e/student-quiz-submission-rewards.cy.ts | Spec mới cho submit/retry/timeout/completion, có 320px |
| package.json | Chỉ thêm spec mới vào cypress:run:stubbed, giữ spec cũ |
| docs/superpowers/plans/2026-11-28-quiz-player-phase-3-submission-rewards-refactor.md | Plan và bằng chứng thực hiện |

Không mặc định sửa StudentView, RewardOverlay, stores/services, Worker hoặc workflow. Tests hiện có assignment/resume/deadline/UI/reward store/backend sẽ chạy lại nhưng chưa cần sửa. Nếu có phụ thuộc source-test mới hoặc browser cũ lỗi, báo phạm vi cụ thể trước khi mở rộng; không tăng timeout toàn cục/force/skip để làm xanh.

## 5. Ma trận characterization trước extraction

Tất cả behavior chính kiểm qua facade thật. Dùng deferred promises, fake clock, deterministic UUID/fixtures, assertion call-count/order và state tại từng boundary; không chỉ mock helper mới rồi tự xác nhận wiring.

### A. Formal và guard

- startTime <= 0: đúng lỗi, không save/grade/claim/clear/track; gọi mặc định và manual tương đương.
- Hai submit trong cùng tick, submit từ render busy và manual trùng timeout khi save pending: một save; giữ lock sau success. StrictMode không nhân đôi thành công.
- Payload khóa raw answers + _questionOrder, assignment truthy/String, client ID và submittedAt, score placeholders, số câu/voided và rounding timeTaken. Không có grant/secure token trong result, draft, public return hoặc reward data.
- Scoped DTO không có đáp án vẫn nộp raw; score/review/UI/reward dùng response authoritative có saved ID khác client ID. Không gọi prevalidation/local scoring formal.
- Deferred save: không clear draft, claim hoặc track trước response. Falsy response/reject: lỗi, finally reset busy, unlock, giữ draft và cho retry theo baseline; không giả vờ idempotency phía client.
- Error after save (clear/claim thrown) được characterization riêng; không dùng expectation “save đã thành công thì không bao giờ quay lại catch” vì baseline không bảo đảm.

### B. Completion, rewards và retry

- Khóa thứ tự save → result/clear → gam snapshot/claim → overlay → track/result/sound; kiểm state khi save và claim đang pending bằng deferred promise.
- Logged-in formal có username và function claim: claim bằng saved ID, map đủ rewarded totals/level/exp/coins/leveledUp; zero correct vẫn có completion.
- Guest/không username/không claim function: ready zero earned, totals từ pet/coins snapshot; pet null dùng defaults hiện tại. Track có điều kiện riêng đúng baseline, không buộc vào claim tồn tại.
- Claim null/error store: result giữ nguyên, overlay error, vào result; retry syncing → ready hoặc error, không save/grade/clear/track/sound lần hai.
- Retry no data/practice/no username/no claim: no-op; thrown/retry overlap/stale captured closure được mô tả là giới hạn baseline, không sửa policy trong refactor.
- Đổi store/session trong lúc pending: xác nhận snapshot/captured object đúng thời điểm; không lấy username hay pet theo logic mới.

### C. Practice

- Secure marker own property: valid, invalid, undefined/null, expiry vừa tới deadline và future; invalid/expired không gọi local grade hoặc formal save/reward.
- gradePracticeQuiz nhận token/raw answers/order string và quiz ID đúng; missing answer vẫn là raw partial map. Grade reject giữ draft, lỗi và retry theo baseline.
- Secure response map đủ canonical practice ID, counts, grading version, answer/review/validation và order; không đưa session token vào output/storage.
- Không có own marker: legacy local grade đồng bộ; map selectedAnswer (kể cả null), status/version/snapshot, validation và question order. Không gọi secure API/save/reward/activity.

### D. Timeout và tích hợp cũ

- Không tự nộp ở initial render/start, tự nộp khi Date.now vượt expiresAt kể cả callback tick trễ, restored expired draft và manual/timeout cạnh tranh.
- Không auto-submit practice/timeLimit falsy/không expiresAt/chưa start hoặc step khác quiz; timeout effect vẫn ở facade.
- Chạy lại resume/navigation/access/start/submission-context/rewards/UI controls/type import của đợt 1/2. So public return và phần access/start/answers/page/navigation với baseline.

## 6. Browser characterization và CI

Spec mới tối thiểu 6 kịch bản trên baseline trước và sau extraction:

1. Guest formal manual: xác nhận nộp, response authoritative khác placeholder, completion/result hiển thị đúng; không claim reward.
2. Logged-in formal có assignment/grant: save pending rồi reward pending; request một lần và claim saved ID đúng, không vào completion sớm. Fixture response phải đủ shape quizStore.submitResult hiện yêu cầu.
3. Save lỗi rồi nộp lại: draft giữ sau lỗi, chỉ completion sau save thành công, không reward trước save. Không khẳng định retry giữ client UUID nếu baseline tạo UUID mới.
4. Reward null rồi retry: cùng saved resultId, không POST result lần nữa; kiểm syncing/error/ready và chuyển xem kết quả bằng keyboard, viewport 320px không overflow.
5. Deadline/manual gần nhau: fake clock/deferred save chứng minh cùng guard, không tiêu hao hai lượt; giữ hành vi timer hiện tại.
6. Secure practice server grade/review: grade endpoint fixture, không formal save/claim/activity; invalid marker/no fallback được khóa thêm ở unit matrix.

Mô phỏng API bằng pathname /api/**, chặn tất cả write ngoài allowlist rõ ràng, gồm result save, claim, activity, secure grade và scoped load; chỉ cho performance telemetry kind=web_vital dự kiến. Không bắt nhầm module Vite src/services/api. Không đưa đáp án formal/secure sang learner UI để tạo fixture. Giữ log baseline/final; không force/skip hoặc tự động retry toàn test để che failure.

Thêm spec vào script package.json hiện được CI và Release readiness dùng. Chạy mới + access/start + reliability focused; chạy toàn script stubbed. Xác minh hosted CI log có spec mới, rồi xác minh lại Release readiness sau merge; không tuyên bố hai workflow đã chạy chỉ vì script thay đổi.

## 7. Các task sau khi duyệt

1. **Chốt baseline/tooling:** fetch origin/main; nếu main tiến, đọc diff và cập nhật baseline trước sửa. Giữ worktree riêng, kiểm RAM/disk, npm ci root/Worker theo lockfile khi verification cần; không junction dependency hoặc xóa artifact task khác.
2. **GitNexus:** refresh, context/query/impact mọi symbol dự kiến sửa; test helpers/callback cần kiểm file và manual graph limitations. Báo blast radius, dừng xác nhận nếu HIGH/CRITICAL.
3. **Test trước tách:** chạy regression hiện có, thêm ma trận unit/browser, chứng minh GREEN trên baseline. Đây là refactor parity; không tạo lỗi giả để gọi RED. Nếu phát hiện behavior fix cần thiết, tách approval và RED→GREEN riêng; không sửa nghiệp vụ để khớp expectation tự đặt.
4. **Tách practice helpers:** worker triển khai scope hẹp; root đọc diff thật, kiểm own marker/expiry, secure/legacy timing, map đầy đủ và chạy practice + formal regression.
5. **Tách useQuizSubmission/wiring:** chuyển nguyên state/handlers, giữ ref/timeout ở facade, type re-export tương thích. Review await boundaries, call ordering, captured store/closure và public return; sửa mọi P1/P2 trước tiếp tục.
6. **Verification/review:** chạy focused matrix, browser mới/cũ, full verify, security/perf/build. Review độc lập sau wiring, so diff/corpus/public shape. Refresh GitNexus và detect_changes compare origin/main; file mới chưa stage kiểm impact riêng; ghi đúng hạn chế công cụ.
7. **Final approval:** trình chính xác 10 file hoặc scope bổ sung đã duyệt, evidence và rủi ro; chờ duyệt trước stage/commit/push. Sau stage chạy detect_changes đủ scope và rà cached diff rồi commit/push/PR main.
8. **CI/review/merge:** required CI và code-owner approval GitHub trên HEAD cuối; không thay bằng chat approve. Kiểm unresolved reviews, HEAD/mergeability ngay trước merge.
9. **Production/cleanup:** xác minh frontend SHA/environment, CI/Security/Release readiness (spec mới thật sự chạy); smoke read-only public/authenticated/public browser. Chạy submit/practice/reward browser trên production với fixture chặn API, không lưu kết quả/claim thưởng/thử assignment thật. Lưu log ngoài worktree rồi cleanup đúng worktree/branch; main dirty giữ nguyên.

## 8. Lệnh và điều kiện verification

Focused dự kiến:

```powershell
npm run test:run -- tests/useQuizPlayerSubmission.test.tsx tests/useQuizPlayerRewards.test.tsx tests/useQuizPlayerPracticeSubmission.test.tsx tests/quizAssignmentSubmission.test.tsx tests/quizStoreSubmitResult.test.ts tests/useQuizPlayerResume.test.tsx tests/useQuizPlayerNavigation.test.tsx tests/useQuizPlayerAccessCode.test.tsx tests/useQuizPlayerStart.test.tsx tests/useQuizDeadline.test.tsx tests/QuizSubmitControls.test.tsx tests/SubmitConfirmModal.accessibility.test.tsx tests/RewardOverlay.test.tsx tests/gamificationResultRewardStore.test.ts tests/practiceService.test.ts tests/studentDashboardCopy.test.ts
npm run verify
npm run perf:budget
npm run cypress:run:stubbed
```

Chạy browser mới + student-quiz-access-start + student-quiz-reliability với server/flags đúng CI. Đọc thêm test Worker hiện có resultRewardClaim/resultRewardLedger/practiceGrading và kết quả full suite để khóa API compatibility; không chỉnh Worker nhằm làm frontend test xanh.

Nếu npm launcher Windows lại lỗi fixture audit, ghi nguyên command/exit/log, chứng minh file không đổi, chẩn đoán direct Node và báo riêng kết quả rerun; không coi verify gốc PASS. Vẫn bắt buộc hosted CI và Release readiness xanh. Chạy các bước nặng tuần tự trên máy 8 GB RAM; không tự đóng app của người dùng hoặc xóa dependency task khác.

## 9. Rollback và nghiệm thu

- Rollback code: revert PR refactor có phạm vi này. Frontend production baseline tốt hiện là 6ed97fc/deployment 8115049383; khi phát hành phải ghi lại last-known-good mới nhất và rollback/promote theo quyền/quy trình hiện hành nếu có regression.
- Không đổi schema draft, nên rollback không đòi migration dữ liệu. Worker deploy/D1 migration/secret/flag change: N/A cho phạm vi này; nếu phát sinh phải có plan và approval production riêng.
- Nghiệm thu: formal không client-score/fallback; practice secure không rơi legacy; grant/token không lọt output/storage; guard và timeout parity; draft/reward/order/snapshot timing giữ nguyên; type import và public return tương thích; test/browser/CI/readiness/smoke đạt; không còn P1/P2; cleanup an toàn.
- Không gộp tối ưu scoring, server/client idempotency, cancellation/unmount race, retry/backoff mới, transactional reward/draft recovery, thay authoritative validator, chuẩn hóa toàn bộ any hoặc viết lại UI vào đợt này. Phát hiện mới ghi backlog, đề nghị riêng sau khi parity được giao.

Tại thời điểm chốt plan: chưa chạy test đợt 3. Các kết quả đợt 2 ở mục baseline chỉ dùng làm mốc kiểm chứng. Người dùng đã cho phép triển khai sau khi plan được chốt/review; vẫn cần final approval trước commit/push.

## 10. Nhật ký triển khai

- User yêu cầu lập plan rồi thực hiện luôn. Review kiến trúc độc lập xác nhận không còn P1/P2, phạm vi 10 file phù hợp. Rà test độc lập xác nhận các gap deferred reward, duplicate pending submit, save retry, timeout và type import.
- Safeguard đã chốt: truyền đúng captured classroomStore object (structural type), không eager username/spread/destructure session; hai ref do facade sở hữu; callback setStep trực tiếp/stable chỉ nhận result; dependencies giữ username như baseline, không lấy whole store identity làm dependency mới.
- Không tạo thêm file types: CompletionRewardData/Status được export từ hook mới và facade type-reexport để giữ import RewardOverlay. New submission test file gom guard/payload/timeout, tránh sao chép các test reward/practice đã có; StudentResultScreen và resume tests chạy regression, không sửa mặc định.
- Đã phân công ba gói test/browser có write scope tách biệt. Chưa tách source; characterization phải chạy trên baseline trước.

- Dependency root cài 771 package, Worker 63 package theo lockfile, không junction/đổi lock. npm audit mặc định toàn cây báo 36 lỗ hổng; audit production enforce riêng root và Worker đều 0. Lượt cài lại no-audit phục vụ chẩn đoán đã hoàn tất, không thay gate security. Regression source gốc trước extraction: 128/128 trong 16 file PASS (77,27s); chưa tính các characterization đang viết.

- Characterization đầu trên baseline: browser 4/6 (hai lỗi fixture: selector alert không tồn tại và HTTP200 status:error không tạo null qua REST adapter), submission unit 7/8 (Storage instance spy không intercept JSDOM). Đã giao sửa test/fixture, chưa đổi production. Review test yêu cầu siết pending claim duplicate/track, thrown initial draft boundary, invalid token/expiry và legacy mapping đầy đủ. Index sau characterization đạt 27.557 nodes/55.922 edges/300 flows; impact FileUID bốn file test/browser LOW, 0 upstream/flows. Production patch chỉ nằm trong artifact ignored, git apply --check đạt, chưa apply.

- Characterization baseline cuối đạt 39/39 trong 3 file và browser 6/6 sau sửa fixture; backend compatibility baseline 43/43. Đã áp dụng production patch 4 file sau review độc lập không P1/P2 và git apply --check. Hook giữ nguyên ordering/refs/captured store; bổ sung dependency stable refs/setStep trước apply. Regression sau extraction đạt 149/149 trong 17 file. Lượt verify đầu bị gián đoạn tại lint do phiên công cụ, không coi PASS; đang chạy lại npm run verify, lint và frontend typecheck đã qua.

- Lint và typecheck frontend/strict/Worker PASS. npm run verify dừng exit 1 tại shard 3: dependencyAuditReport.test.ts không đổi có 4 lỗi (2 timeout spawnSync, 2 exit-code mismatch). Shard1:180file/1058PASS; shard2:180/1007PASS; shard3:179file/1110PASS và4fail. Chạy trực tiếp Node audit fixture đạt28/28; shard4 trực tiếp179file/1094PASS. Tổng4273 test khác nhau/719file đã PASS qua các lượt; không coi verify gốc làPASS hoặc khẳng định đã chốt nguyên nhân Windows/npm. Review diff thực tế độc lập không cònP1/P2; có import thừa clearQuizAttemptDraft cần dọn.

- Đã dọn import thừa clearQuizAttemptDraft sau fresh impact LOW; esbuild JS emit trước/sau giống hệt SHA256 `c40b99ae1eeb2eb39f223b23421b831c74780bae419820043b17b31124ccc9f4`. AST parity các handler ngoài mục tiêu, public return và timeout effect đều khớp baseline.
- Coverage gate 56/56 vượt ngưỡng hiện có; build 34,57 giây PASS, performance budget PASS (initial JS gzip 169.238 byte, CSS 48.322 byte). Security scan/history/policies đạt; audit production root/Worker đều 0 lỗ hổng. Typecheck frontend/strict/Worker chạy lại trên source cuối đều PASS.
- Browser focused 18/18 và script stubbed 13 spec/78 ca PASS, exit 0; không skip/pending. Index cuối có 27.562 nodes, 55.940 edges, 300 flows; detect compare thấy 5 tracked file/13 symbols/0 flows, LOW. File mới được kiểm impact riêng và manual review scope 10 file; staged detect vẫn phải chạy sau approval trước commit.
- Dev server từng EBUSY khi watch cache trong lúc index chạy; đã restart sau index, không sửa config. Đã dừng server, lưu artifact ngoài worktree và trình final approval 10 file; chưa stage/commit/push.
