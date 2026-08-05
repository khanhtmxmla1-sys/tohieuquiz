# Xóa bản nháp từ trang Tổng quan — Thiết kế

## Mục tiêu

Cho phép giáo viên hoặc quản trị viên xóa ngay bản nháp gần nhất từ thẻ **Bản nháp chưa hoàn tất** trong Action Center của trang Tổng quan, không cần mở Trình soạn đề trước.

## Phạm vi

- Thẻ bản nháp có hai hành động:
  - **Tiếp tục bản nháp** — giữ nguyên điều hướng hiện tại.
  - **Xóa bản nháp** — hành động phá hủy có xác nhận.
- Hộp thoại xác nhận nêu rõ tên bản nháp và hậu quả.
- Khi xác nhận:
  1. Gọi API `DELETE /api/quiz-drafts/:draftId` hiện có.
  2. Xóa bản cục bộ cùng `draftId` trên thiết bị hiện tại theo cơ chế best-effort.
  3. Tải lại Action Center để cập nhật số lượng và bản nháp kế tiếp.
  4. Hiển thị toast thành công hoặc lỗi.
- Backend tiếp tục là lớp quyết định quyền cuối cùng; route hiện có cho phép giáo viên xóa bản nháp của chính mình và quản trị viên xóa bản nháp trong phạm vi quản trị.

## Ngoài phạm vi

- Thùng rác 30 ngày, khôi phục và xóa vĩnh viễn.
- Xóa hàng loạt hoặc trang quản lý toàn bộ bản nháp.
- Thay đổi cơ chế autosave của Trình soạn đề.
- Xóa đề đã xuất bản, bài đã giao hoặc kết quả học sinh.

## Kiến trúc

### Hợp đồng Action Center

Mở rộng `TeacherActionItem` bằng thuộc tính tùy chọn `secondaryAction`:

```ts
export type TeacherActionMutationKind = 'delete_draft';

export interface TeacherActionMutation {
  kind: TeacherActionMutationKind;
  label: string;
  resourceId: string;
  resourceLabel: string;
  ownerUsername: string;
}
```

Chỉ item `draft_unpublished` có `secondaryAction`. Dữ liệu này do Worker tạo; frontend không phân tích `draftId` từ URL CTA.

### Worker

`loadDrafts()` trả thêm tên và chủ sở hữu của bản nháp có `updated_at` mới nhất trong tập actionable. `loadTeacherActionCenter()` ánh xạ thành `secondaryAction` khi có `next_id`.

### Frontend

`ActionCenterPanel` quản lý ba trạng thái:

- item đang chờ xác nhận;
- `draftId` đang xóa;
- dữ liệu Action Center hiện tại.

Một component riêng `DraftDeleteDialog` chịu trách nhiệm giao diện và accessibility của hộp thoại. Nút xác nhận giữ nguyên nhãn **Xóa bản nháp** khi loading và thêm spinner.

### Dữ liệu cục bộ

Sau khi API xóa thành công, gọi `removeLocalDraft(ownerUsername, draftId)`. Lỗi localStorage không được biến việc xóa máy chủ thành thất bại; frontend hiển thị cảnh báo nhẹ nếu cần nhưng vẫn tải lại Action Center.

## Nội dung giao diện

Nút trên thẻ:

> Xóa bản nháp

Hộp thoại:

> **Xóa bản nháp này?**
>
> Bản nháp “{resourceLabel}” sẽ bị xóa khỏi máy chủ. Đề đã xuất bản và dữ liệu học sinh không bị ảnh hưởng. Thao tác này không thể hoàn tác.

Nút:

- **Giữ lại**
- **Xóa bản nháp**

Toast thành công:

> Đã xóa bản nháp.

## Xử lý lỗi

- Mất mạng hoặc API lỗi: giữ nguyên thẻ, đóng trạng thái loading, hiển thị thông báo lỗi.
- API trả 404: dùng `deleteRemoteManualQuizDraftIfExists`, coi bản nháp đã được dọn và tải lại Action Center.
- Xóa localStorage lỗi: không rollback xóa máy chủ; tải lại dữ liệu và thông báo bản máy chủ đã được xóa.
- Double click: khóa nút xác nhận và nút xóa của item khi request đang chạy.

## Kiểm thử

- Worker service trả đúng `secondaryAction` cho bản nháp gần nhất và đúng owner.
- Validator frontend chấp nhận action hợp lệ, từ chối action thiếu trường hoặc kind không hỗ trợ.
- UI chỉ hiển thị nút xóa cho item có `secondaryAction`.
- Bấm nút mở dialog đúng tên bản nháp.
- Bấm **Giữ lại** không gọi API.
- Bấm **Xóa bản nháp** gọi đúng draft ID, dọn local draft, tải lại Action Center và hiển thị thành công.
- API lỗi giữ item và hiển thị lỗi.
- Các item không phải bản nháp không thay đổi.

## Tiêu chí nghiệm thu

1. Người dùng xóa được bản nháp gần nhất ngay tại Tổng quan.
2. Không thể xóa nhầm chỉ bằng một lần bấm.
3. Không xóa đề đã xuất bản hoặc dữ liệu học sinh.
4. Sau xóa, số lượng và CTA bản nháp được cập nhật không cần tải lại trang thủ công.
5. Nút bị khóa trong lúc request chạy và không gửi request trùng.
6. Luồng cũ **Tiếp tục bản nháp** vẫn hoạt động.
