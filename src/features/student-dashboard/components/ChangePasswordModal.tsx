import { AnimatePresence, motion } from 'framer-motion';
import type { StudentAccountController } from '../hooks/useStudentAccount';

export const ChangePasswordModal = ({ account }: { account: StudentAccountController }) => (
  <AnimatePresence>
    {account.isOpen && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-0 md:p-4 flex items-end md:items-center justify-center"
        onClick={account.close}>
        <motion.form initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(event) => event.stopPropagation()} onSubmit={account.submit}
          className="w-full h-dvh md:h-auto md:max-w-md bg-white rounded-none md:rounded-3xl p-4 md:p-6 shadow-2xl overflow-y-auto">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div><p className="text-xs font-black text-blue-600 uppercase tracking-wider mb-1">Tài khoản</p>
              <h3 className="text-xl font-black text-slate-800">Đổi mật khẩu</h3></div>
            <button type="button" onClick={account.close}
              className="text-slate-400 hover:text-slate-600 text-sm font-bold">Đóng</button>
          </div>
          <div className="space-y-4">
            <PasswordField label="Mật khẩu cũ" value={account.currentPassword}
              onChange={account.setCurrentPassword} placeholder="Nhập mật khẩu hiện tại"
              autoComplete="current-password" autoFocus />
            <PasswordField label="Mật khẩu mới" value={account.newPassword}
              onChange={account.setNewPassword} placeholder="Tối thiểu 6 ký tự"
              autoComplete="new-password" />
            <PasswordField label="Nhập lại mật khẩu mới" value={account.confirmNewPassword}
              onChange={account.setConfirmNewPassword} placeholder="Nhập lại mật khẩu mới"
              autoComplete="new-password" />
          </div>
          {account.errorMessage && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-semibold px-4 py-3">{account.errorMessage}</div>}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button type="button" onClick={account.close}
              className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50">Hủy</button>
            <button type="submit" disabled={account.isSubmitting}
              className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              {account.isSubmitting ? 'Đang lưu...' : 'Lưu mật khẩu'}
            </button>
          </div>
        </motion.form>
      </motion.div>
    )}
  </AnimatePresence>
);

const PasswordField = ({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: 'current-password' | 'new-password';
  autoFocus?: boolean;
}) => <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{label}</label>
  <input type="password" autoComplete={autoComplete} value={value}
    onChange={(event) => onChange(event.target.value)}
    className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
    placeholder={placeholder} autoFocus={autoFocus} /></div>;
