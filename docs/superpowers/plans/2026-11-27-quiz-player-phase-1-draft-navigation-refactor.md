# Refactor useQuizPlayer đợt 1

## Mục tiêu và baseline

Baseline đã đọc là `origin/main 4a87995f76e76e67177917450be68cafe47203a3`. Tách trách nhiệm lưu bài dở, đối chiếu thứ tự khôi phục và bảo vệ điều hướng khỏi `useQuizPlayer`. Giữ tương thích dữ liệu và các hành vi đã được characterization test xác nhận.

Worktree chuẩn bị cho plan nằm tại `C:/Users/Administrator/.codex/worktrees/refactor-quiz-player-draft-navigation/quizpro`, branch `codex/refactor-quiz-player-draft-navigation`. Trước triển khai, kiểm tra HEAD mới nhất, cây làm việc và dung lượng. Nếu main thay đổi, đọc diff trước khi cập nhật baseline.

## Kiến trúc dự kiến

- `useQuizPlayer` tiếp tục sở hữu state bài làm, bước màn hình và các handler bắt đầu/nộp bài.
- `useQuizAttemptPersistence` nhận dữ liệu state hiện hành và phụ trách effect lưu bản nháp.
- `resolveQuizDraftResume` là hàm thuần nhận bản nháp cùng danh sách câu hỏi đã được cấp quyền, trả `restoredOrder` và `canResumeDraft` theo thuật toán hiện có.
- `useQuizNavigationGuard` quản lý listener popstate, trạng thái hộp thoại đang mở và việc xác nhận thoát.
- `quizAttemptDraft.ts` tiếp tục là lớp đọc/ghi sessionStorage. `useQuizDeadline` tiếp tục quản lý đồng hồ.

Hook mới nhận `active` thay vì import `QuizStep` ngược từ facade. Giữ hướng import một chiều. State và callback phải có kiểu cụ thể, các hook nhận đúng dữ liệu chúng sử dụng.

## Phạm vi dự kiến gồm 8 file

1. Sửa `src/features/quiz-player/hooks/useQuizPlayer.ts`.
2. Tạo `src/features/quiz-player/hooks/useQuizAttemptPersistence.ts`.
3. Tạo `src/features/quiz-player/hooks/useQuizNavigationGuard.ts`.
4. Tạo `src/features/quiz-player/utils/resolveQuizDraftResume.ts`.
5. Bổ sung `tests/useQuizPlayerResume.test.tsx`.
6. Tạo `tests/useQuizPlayerNavigation.test.tsx`.
7. Rà soát và cập nhật fixture/test liên quan trong `cypress/e2e/student-quiz-reliability.cy.ts` khi cần để kiểm tra luồng hiện tại.
8. Plan `docs/superpowers/plans/2026-11-27-quiz-player-phase-1-draft-navigation-refactor.md`.

Việc tách phần gọi API bắt đầu lượt làm thuộc đợt 2. Việc tách nộp bài, retry nhận thưởng và mapping kết quả thuộc đợt 3. Worker, schema, storage format và các bộ scoring nằm ngoài phạm vi file của đợt 1.

## Những hành vi cần khóa

- Bản nháp dùng prefix `tohieuquiz_quiz_attempt_v1:`, version 1 và sessionStorage theo quiz ID.
- Đọc bản nháp theo thời điểm useMemo hiện tại. Việc đổi quiz ID cần được đối chiếu baseline thay vì tự bổ sung reset state.
- Lưu chỉ khi đang ở bước quiz, đã có câu hỏi và startTime hợp lệ. Giữ thứ tự effect lưu trước effect bảo vệ điều hướng.
- Nội dung lưu gồm tên, lớp, answers, questionOrder, currentPage, startedAt và expiresAt.
- Bài chính thức tải lại câu hỏi từ scoped learner endpoint trước khi áp dụng thứ tự khôi phục.
- Thuật toán Map và so sánh độ dài hiện tại quyết định canResumeDraft. Characterize cả ID thiếu, số câu thay đổi và ID trùng trước khi tách.
- Khi resume hợp lệ, answers, trang, thời điểm bắt đầu và deadline được lấy từ bản nháp.
- Hết giờ dùng deadline tuyệt đối hiện tại. Test cần khóa cả bài mới bắt đầu và bài khôi phục đã hết hạn.
- Chỉ bước quiz gắn listener popstate. Cleanup tháo listener khi rời bước hoặc unmount.
- Nút Back mở hộp thoại showConfirm hiện có. Back liên tiếp khi đang chờ chỉ giữ một hộp thoại và khôi phục history theo baseline.
- Hủy thoát giữ bản nháp và tiếp tục bài. Xác nhận thoát xóa bản nháp trước onExit.
- Nộp thành công xóa bản nháp ở vị trí hiện có. Submit lỗi 403/409 giữ bản nháp.
- Kiểm thử StrictMode dựa trên số listener đang hoạt động và việc cleanup, đồng thời ghi nhận đúng số lần pushState mà baseline tạo ra.

## Task 1 — Kiểm tra baseline và GitNexus

Kiểm tra worktree sạch, HEAD, origin/main và dependency lockfiles. Dùng index riêng cho worktree, chạy analyze với `--index-only` khi cần.

Chạy query/context cho luồng resume và popstate. Chạy upstream impact cho `useQuizPlayer`, `handleStart`, `handlePopState` và mọi function/class/method hiện có thực sự cần sửa. Ghi nhận direct callers, execution flows và mức rủi ro.

Các effect ẩn danh cần được đọc cùng symbol useQuizPlayer và vị trí dòng thực tế. Xác minh dependencies của StudentView, RewardOverlay và các test source-inspection. Giới hạn thay đổi handleStart vào khối tính thứ tự resume.

Rủi ro dự kiến là MEDIUM do vòng đời effect và promise xác nhận thoát. Đây là nhận định kiến trúc, chưa phải kết quả impact mới. Nếu GitNexus trả HIGH/CRITICAL, báo kết quả và xin xác nhận theo AGENTS.md trước khi chỉnh symbol.

## Task 2 — Characterization trước khi tách

Chạy các test hiện có trên baseline. Bổ sung ca còn thiếu qua API công khai của useQuizPlayer để tránh buộc test phụ thuộc vị trí code sau refactor.

Nhóm resume/persistence cần kiểm tra bài chưa bắt đầu, cập nhật answers và trang, resume với scoped questions, đổi tập câu hỏi, deadline đã hết, submit thành công/lỗi, và dữ liệu version 1.

Nhóm navigation cần kiểm tra bước notice/result, Back mở hộp thoại, Back nhiều lần trong lúc promise còn pending, cancel, confirm, thứ tự clear/onExit, unmount và StrictMode.

Kiểm tra các tình huống đang có hành vi khó hiểu như promise xác nhận hoàn tất sau unmount hoặc storage lỗi. Ghi nhận kết quả baseline và đưa thay đổi nghiệp vụ cần thiết vào đề xuất riêng.

TDD RED→GREEN được đánh dấu N/A cho phép tách giữ hành vi. Characterization phải GREEN trên baseline trước khi production code được tách. Nếu phát hiện lỗi cần sửa, xác định riêng scope thay đổi hành vi và viết regression RED trước khi sửa.

## Task 3 — Tách tính thứ tự resume

Di chuyển nguyên thuật toán loadedById, restoredOrder và canResumeDraft sang resolveQuizDraftResume. Hàm chỉ tính từ đầu vào và trả kết quả, giữ nguyên thuật toán Map và điều kiện độ dài.

handleStart tiếp tục gọi API, preflight assignment, chọn randomization và cập nhật state theo thứ tự cũ. Chạy lại resume, access code, assignment và practice tests sau bước này.

## Task 4 — Tách effect persistence

Tạo useQuizAttemptPersistence với input active và các trường cần lưu. Dùng utility sessionStorage hiện có. Giữ điều kiện lưu, dependency array tương đương và serialization version 1.

Giữ useMemo đọc bản nháp cùng các state initializer trong useQuizPlayer. Giữ các điểm clear trong submit và navigation ở thời điểm cũ. Đối chiếu nội dung sessionStorage trước/sau thao tác và khi effect chạy lại.

## Task 5 — Tách bảo vệ điều hướng

Chuyển navigationConfirmOpenRef và effect popstate sang useQuizNavigationGuard. Giữ cấu hình hộp thoại, preventDefault, pushState, trình tự xử lý promise, clearQuizAttemptDraft và onExit.

Hook nhận active, quizId và onExit. Rà dependencies để listener dùng đúng callback hiện tại. Chạy toàn bộ navigation characterization và resume tests ngay sau bước tách.

## Task 6 — Kiểm chứng qua màn hình học sinh

Chạy các bộ Vitest tập trung sau.

```powershell
npx vitest run tests/quizAttemptDraft.test.ts tests/useQuizPlayerResume.test.tsx tests/useQuizPlayerNavigation.test.tsx tests/useQuizDeadline.test.tsx tests/useQuizPlayerAccessCode.test.tsx tests/quizAssignmentSubmission.test.tsx tests/useQuizPlayerPracticeSubmission.test.tsx tests/useQuizPlayerRewards.test.tsx tests/quizProgressRollout.test.tsx tests/StudentQuizLayout.test.tsx tests/quizPageNavigation.test.tsx tests/studentDashboardCopy.test.ts --maxWorkers=2
```

Rà Cypress student-quiz-reliability trước khi chạy. Spec hiện có kỳ vọng vào thẳng bài sau reload, trong khi hook đã chuyển qua notice và tải lại câu hỏi được cấp quyền. Đối chiếu baseline thực tế và sửa fixture/assertion trong file đã liệt kê nếu cần, chứng minh test đi qua luồng hiện hành.

Browser checks cần có start → chọn đáp án → đổi trang → reload → tiếp tục qua bước bắt đầu → khôi phục answers/trang/deadline. Kiểm tra Back/cancel/confirm bằng hộp thoại thực tế, thao tác keyboard và viewport 320px.

## Task 7 — Review và verification

Chạy lint, typecheck, strict typecheck, frontend build, performance budget và security gates theo scripts của repo. Chạy full Vitest phù hợp cùng CI bắt buộc của PR. Đối chiếu mọi thất bại mới với baseline và ghi lại ca timeout/flaky nếu có.

Review thực diff, dependencies của effects, cleanup listener, dữ liệu khôi phục và các điểm xóa bản nháp. Người điều phối kiểm tra bằng chứng của worker và xử lý các finding P1/P2 trước handoff.

Chạy GitNexus detect_changes so sánh baseline origin/main, tính cả các file mới. Xác nhận scope cuối cùng đúng các file đã trình.

## Task 8 — Giao hàng và rollback

Trình danh sách file cuối, bằng chứng kiểm thử và rủi ro còn lại để duyệt commit theo AGENTS.md. Sau khi được duyệt, stage đúng file, commit, push và mở PR.

Đợi required CI cùng human/code-owner review. Kiểm tra lại PR HEAD trước merge. Sau frontend deployment, xác minh SHA/environment và chạy smoke qua màn hình làm bài. Package này có điểm triển khai ở frontend.

Ghi deployment frontend đã biết tốt trước khi phát hành. Nếu refactor gây regression, dùng quy trình promote/rollback deployment frontend đã biết tốt, ghi nhận trạng thái bản nháp version 1 khi kiểm tra lại.

Khi production smoke đạt, lưu bằng chứng, dọn worktree/branch đã merge và kiểm tra trạng thái main trước khi cập nhật local.

## Điều kiện nghiệm thu

- Ba trách nhiệm đã tách thành hai hook và một helper có caller thực tế.
- Public return shape của useQuizPlayer tương thích với StudentView và RewardOverlay.
- Characterization trước/sau refactor và browser checks đạt.
- Điểm tải scoped questions, giới hạn lượt, deadline, chống submit trùng và nhận thưởng được các test hiện có xác nhận.
- Review, GitNexus, CI, approval, merge và frontend production smoke hoàn tất theo workflow.
- Rủi ro hoặc test chưa xác minh được được ghi rõ trong handoff.

## Nhắc bắt buộc khi hoàn tất đợt 1

Yêu cầu trực tiếp của người dùng là phải nhắc lập plan đợt 2 và 3 sau khi xong đợt 1. Đây là bước trong checklist hoàn tất, cần xuất hiện trong câu trả lời bàn giao cuối.

- Đợt 2 sẽ lập plan tách mã truy cập, tải scoped questions, assignment preflight và bắt đầu lượt làm. Khi lập plan cần rà lại main và kết quả đợt 1.
- Đợt 3 sẽ lập plan tách submit, authoritative result, timeout/manual submit, retry và nhận thưởng. Khi lập plan cần rà lại kết quả đợt 2 cùng contract đang chạy.

Câu nhắc bàn giao dự kiến là “Đợt 1 đã hoàn tất. Tiếp theo cần lập plan đợt 2 cho truy cập/bắt đầu lượt làm và đợt 3 cho nộp bài/nhận thưởng.”

Mỗi đợt sẽ được trình scope và approval theo workflow khi đến bước thực hiện.

## Bằng chứng baseline khi triển khai

- Đã xác nhận origin/main cùng worktree ở SHA `4a87995`.
- GitNexus upstream impact báo LOW cho useQuizPlayer với một caller trực tiếp StudentView. handleStart và handlePopState báo LOW. Các helper Cypress installQuiz, startStandardQuiz và assertNoHorizontalOverflow cũng báo LOW.
- Index có call graph và context theo symbol. Keyword query bị suy giảm vì môi trường thiếu extension FTS, thử repair cũng thất bại. Việc rà symbol được đối chiếu thêm với source và characterization.
- Bộ test hiện có đã PASS 67 test trong 11 file. Bộ resume/navigation bổ sung đã PASS 27 test trên production code gốc.
- Cypress reliability đã PASS 6/6 trên code gốc sau cập nhật fixture scoped learner endpoint và bước bắt đầu lại sau reload. Bài khôi phục được kiểm tra giữ đúng startedAt, expiresAt, questionOrder, trang và đáp án. Keyboard Escape đóng hộp thoại và focus được kiểm tra cùng desktop/mobile 320px.
- Test ghi nhận hành vi cũ với ID câu hỏi trùng trong bản nháp, state tồn tại khi đổi quiz prop và promise xác nhận hoàn tất sau unmount. Phép tách sẽ giữ parity cho các trường hợp này. Khi lập plan các đợt sau cần đánh giá chúng như các cải tiến hành vi riêng.
- Mốc frontend production đã biết tốt hiện tại là GitHub deployment `8103571529`, SHA `4a87995`, URL `https://tohieuquiz-c934nz5jb-vh-s-projects3.vercel.app`, có status success. Cần xác minh lại trước phát hành.

## Bằng chứng review và verification sau khi tách

- Đã tách đúng hai hook và một helper. useQuizPlayer còn 533 dòng so với 576 dòng của baseline. State, draft-read useMemo và public return shape được giữ tại facade.
- Đã đối chiếu nguyên văn các khối code verify access, submit, deadline effect và retry reward với baseline.
- Review phát hiện nguy cơ dependency array mới làm lưu draft mỗi tick nếu truyền questionOrder được map lại trên mỗi render. Bản cuối nhận questions ổn định và thực hiện map bên trong effect. Test timer-only rerender đã đạt.
- Test StrictMode đã được tăng cường với callback ổn định, số history entry lần lượt 0 khi notice, 1 sau start, 2 sau cancel và giữ 2 sau unmount. Đồng thời kiểm tra một listener active và cleanup về 0.
- Tạm dùng nguyên facade baseline để chạy lại bộ characterization tăng cường, đã PASS 28/28. Sau đó khôi phục nguyên bản facade refactor và đối chiếu diff.
- Cypress reliability đạt 6/6 trên baseline và 6/6 trên bản refactor, gồm reload giữ deadline tuyệt đối, trang, thứ tự và đáp án, cùng Back/Escape/confirm và mobile 320px.
- Typecheck frontend/strict/Worker, lint, frontend build, performance budget và security check đều đạt. Production audits root và Worker đều ghi nhận 0 lỗ hổng.
- Review độc lập đối chiếu production diff và ba helper, kết luận hết finding P1/P2 do phép tách. GitNexus detect_changes trên toàn bộ 8 file báo LOW, 43 symbols và 0 execution flows được index. Call graph của callback React được bổ trợ bằng test hành vi.
- Trường hợp sessionStorage bị chặn hoặc hết quota được rà ở source, lớp utility vẫn có thể ném lỗi theo baseline. Chưa có test trực tiếp cho lỗi quota/denial trong gói này.
- Browser test hiện xác minh thao tác keyboard Escape và focus. Thử giả lập Enter đã không kích hoạt hành vi đóng nút trên baseline trong phiên Cypress này, vì vậy kết quả browser không được dùng để tuyên bố đã xác minh Enter.
- Bộ tập trung cuối đạt 76/76 trong 12 file. Lint đã được kiểm tra lại cho các file test sau khi tăng cường assertion.
- Đã kiểm tra đủ 4 shard với tổng 4.230 test trong 717 file. Shard 1 đạt 1.058 test, shard 2 đạt 979 test, shard 4 đạt 1.089 test. Shard 3 ban đầu đạt 1.102 và lỗi 2 ca fixture dependencyAuditReport khi chạy qua npm wrapper trên Windows. Chạy riêng file qua npm vẫn tái hiện lỗi, chạy trực tiếp Node đạt 28/28, sau đó chạy lại toàn shard 3 trực tiếp Node đạt 1.104/1.104.
- Vì vậy lệnh `npm run test:ci:all` nguyên bản có exit code 1 ở shard 3 trong môi trường này. Kết quả bốn shard đạt bao gồm lần chạy lại shard 3 và lần chạy shard 4 trực tiếp bằng Node. Hai file audit giữ nguyên so với baseline. Kết quả này cần được ghi trong PR và đối chiếu với required CI.
- Tại bước bàn giao local, còn chờ duyệt commit/push/PR theo AGENTS.md bước 6. Checklist nhắc lập plan đợt 2 và 3 vẫn được áp dụng sau khi đợt 1 hoàn tất merge và production smoke.
