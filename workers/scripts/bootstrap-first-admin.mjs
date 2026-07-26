#!/usr/bin/env node
// Sinh câu lệnh SQL tạo tài khoản quản trị đầu tiên trên một D1 rỗng.
//
// Vì sao cần script này: `POST /api/admin/teachers` yêu cầu một phiên admin, nên tài khoản admin
// đầu tiên không thể tạo qua API — phải INSERT trực tiếp. Hash bắt buộc khớp encoding của
// `workers/src/utils/password.ts` (`pbkdf2_sha256$<vòng>$<salt hex>$<hash hex>`), nếu tự tay tạo
// hash bằng công cụ khác thì đăng nhập sẽ luôn sai mật khẩu.
//
// Cách dùng (in ra stdout, KHÔNG ghi file, KHÔNG bao giờ commit kết quả):
//
//   node workers/scripts/bootstrap-first-admin.mjs <username> "<họ tên>"
//
// Rồi chạy phần SQL bằng wrangler (lưu ý `--config`, xem CURRENT_PROGRESS.md):
//
//   npx wrangler d1 execute tohieuquiz-db --remote --config wrangler.toml --command "<SQL>"
//
// Tài khoản được tạo với `must_change_password = 1`: lần đăng nhập đầu chỉ nhận token mục đích
// `password_change` và mọi route khác trả 403 cho tới khi gọi `/api/account/change-password`.
// Mật khẩu tạm bên dưới vì thế chỉ dùng một lần.
import { pbkdf2Sync, randomBytes } from 'node:crypto';

// Giữ đồng bộ với PBKDF2_ITERATIONS / SALT_BYTES / HASH_BYTES trong workers/src/utils/password.ts.
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
// Cùng bộ ký tự với generateTemporaryPassword(): đã bỏ các ký tự dễ đọc lẫn (0/O, 1/l/I).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

const username = process.argv[2];
const fullName = process.argv[3];

if (!username || !fullName) {
    console.error('Cách dùng: node workers/scripts/bootstrap-first-admin.mjs <username> "<họ tên>"');
    process.exit(1);
}
// Cùng luật với `POST /api/admin/teachers` để tài khoản seed không lệch với tài khoản tạo qua API.
if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username)) {
    console.error('Tên đăng nhập chỉ gồm chữ, số, dấu chấm, gạch dưới, gạch ngang (3-64 ký tự).');
    process.exit(1);
}

const temporaryPassword = Array.from(randomBytes(20), (byte) => ALPHABET[byte % ALPHABET.length]).join('');
const salt = randomBytes(SALT_BYTES);
const hash = pbkdf2Sync(Buffer.from(temporaryPassword, 'utf8'), salt, ITERATIONS, HASH_BYTES, 'sha256');
const encoded = `pbkdf2_sha256$${ITERATIONS}$${salt.toString('hex')}$${hash.toString('hex')}`;
const now = new Date().toISOString();

console.log('-- Mật khẩu tạm (dùng một lần, giao trực tiếp cho chủ sở hữu, không lưu vào repo):');
console.log(`--   ${temporaryPassword}`);
console.log('');
console.log(`INSERT INTO teachers
  (username, password, full_name, role, class, status, must_change_password,
   token_version, created_at, updated_at)
VALUES
  ('${username}', '${encoded}', '${fullName.replace(/'/g, "''")}', 'admin', '', 'ACTIVE', 1, 1, '${now}', '${now}');`);
