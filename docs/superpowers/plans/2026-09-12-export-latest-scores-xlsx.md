# Implementation Plan: Xuất Excel điểm mới nhất

## Outcome

Thêm tùy chọn xuất XLSX thật từ màn Kết quả học tập. File dùng toàn bộ kết quả phù hợp bộ lọc, giữ một lượt mới nhất cho mỗi học sinh trong mỗi bài kiểm tra, với các cột STT, Họ và tên, Bài kiểm tra, Điểm, Thời gian làm (phút).

## Decisions

- Giữ nguyên xuất CSV và báo cáo tổng hợp.
- Chọn mới nhất theo `submittedAt`, hòa thì theo `id`.
- Định danh bằng `studentId`; fallback dữ liệu cũ theo lớp + họ tên; luôn tách theo `quizId`.
- Dùng `write-excel-file/browser` và `file-saver` đã có.
- Theo cursor API để tránh giới hạn 25 kết quả đầu.

## Tasks

1. RED/GREEN: `loadResults` nạp đủ trang và chống cursor lặp.
2. RED/GREEN: chọn lượt mới nhất và tạo XLSX đúng năm cột.
3. RED/GREEN: thêm menu và nối action, giữ hành vi xuất cũ.
4. Chạy focused tests, typecheck, build, review diff và GitNexus `detect_changes`.
5. Trình người dùng duyệt phạm vi trước commit.

## Risks and rollback

- Nhiều trang tạo thêm request; dùng limit tối đa, dừng theo `hasMore`/`nextCursor`, chống cursor lặp.
- Trùng tên được giảm thiểu bằng canonical `studentId`.
- Rollback bằng revert commit; không có schema, migration hoặc dữ liệu production.
