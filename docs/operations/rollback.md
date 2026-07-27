# Rollback TôHiệuQuiz

## Nguyên tắc

- Rollback là khôi phục phiên bản đã biết tốt, không sửa nóng trực tiếp trên production.
- Frontend, Worker, migration và feature flag được đánh giá độc lập.
- Không xóa dữ liệu hoặc đảo migration chỉ để làm deployment cũ chạy lại.
- Mọi rollback phải ghi release nguồn, release đích, người thực hiện và kết quả smoke.

## Chuẩn bị trước mỗi release

Ghi vào release record:

- SHA dự kiến triển khai;
- SHA production đang ổn định;
- Vercel deployment ID hiện tại;
- Cloudflare Worker version hiện tại;
- migration mới và tính tương thích ngược;
- feature flags thay đổi;
- đường dẫn workflow production smoke.

## Frontend Vercel

1. Dừng rollout hoặc promotion đang chờ.
2. Chọn deployment production gần nhất đã qua smoke.
3. Promote deployment đã biết tốt về production bằng Vercel Dashboard hoặc CLI đã xác thực.
4. Không rebuild commit cũ nếu có thể dùng lại immutable deployment đã thành công.
5. Chạy production smoke với site/API/parent URL chính thức.

Ví dụ tham khảo, chỉ chạy sau khi xác nhận deployment ID:

```bash
vercel rollback <known-good-deployment-url-or-id>
```

## Cloudflare Worker

1. Xác định Worker version trước release lỗi.
2. Kiểm tra version đó tương thích với D1 schema hiện tại.
3. Rollback bằng Cloudflare Dashboard hoặc Wrangler version rollback đã xác thực.
4. Kiểm tra trực tiếp `/api/health` và header CORS.
5. Chạy production smoke và một request đọc cho route bị ảnh hưởng.

Không deploy lại source cũ bằng `wrangler deploy` nếu có thể rollback version: build lại có thể lấy dependency hoặc environment khác.

## Feature flag

Ưu tiên tắt flag khi:

- mã cũ vẫn tồn tại và được test;
- thay đổi không liên quan migration bắt buộc;
- flag có thể tắt mà không redeploy hoặc deployment tắt flag nhanh hơn rollback toàn bộ.

Sau khi tắt flag, chạy smoke và kiểm tra riêng luồng legacy.

## Migration D1

- Migration mới phải tương thích ngược ít nhất một release.
- Không `DROP`, đổi nghĩa cột hoặc xóa dữ liệu trong cùng release với code phụ thuộc thay đổi đó.
- Nếu code mới lỗi nhưng schema đã mở rộng, rollback code và giữ schema mở rộng.
- Chỉ đảo migration dữ liệu khi có backup, script đã test và phê duyệt riêng.

## Xác nhận rollback thành công

Rollback chỉ hoàn tất khi:

- production smoke đạt;
- health trực tiếp và same-origin đạt;
- không còn tăng lỗi 5xx;
- request ID mới truy vết được;
- luồng bị ảnh hưởng hoạt động trở lại;
- theo dõi 30 phút không tái phát SEV-1/2.

## Khi rollback thất bại

1. Không tiếp tục thử nhiều version ngẫu nhiên.
2. Giữ traffic ở phiên bản ít gây hại nhất hoặc maintenance mode có kiểm soát.
3. Khóa mutation rủi ro nếu có nguy cơ dữ liệu.
4. Escalate SEV-1, ghi rõ frontend version, Worker version và schema hiện tại.
5. Chuẩn bị forward fix nhỏ nhất có test tái hiện.
