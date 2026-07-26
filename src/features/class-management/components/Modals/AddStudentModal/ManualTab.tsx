import React, { useState, useEffect, useRef } from 'react';
import { EyeOff, Eye, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '../../../../../components/common';
import { CreateStudentPayload } from '../../../types';

interface ManualTabProps {
    classId: string;
    onClose: () => void;
    onSubmit: (payload: CreateStudentPayload) => Promise<void>;
    isLoading: boolean;
}

export const ManualTab: React.FC<ManualTabProps> = ({ classId, onClose, onSubmit, isLoading }) => {
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [parentPhone, setParentPhone] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const usernameEditedRef = useRef(false);
    const usernameSuffixRef = useRef(Math.floor(Math.random() * 900 + 100));

    // Auto-generate username from full name
    useEffect(() => {
        if (fullName.trim() && !usernameEditedRef.current) {
            const parts = fullName.trim().toLowerCase().split(/\s+/);
            const firstName = parts[parts.length - 1] || '';
            const lastInitial = parts[0]?.[0] || '';
            const mid = parts.length > 2 ? parts.slice(1, -1).map(p => p[0]).join('') : '';
            const clean = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
            setUsername(clean(`${firstName}.${lastInitial}${mid}.${usernameSuffixRef.current}`));
        }
    }, [fullName]);

    // Auto-generate password on mount
    useEffect(() => {
        const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
        let pw = '';
        for (let i = 0; i < 6; i++) pw += chars[Math.floor(Math.random() * chars.length)];
        setPassword(pw);
    }, []);

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim() || !username.trim() || !password.trim()) return;
        await onSubmit({
            fullName: fullName.trim(),
            username: username.trim(),
            password: password.trim(),
            classId,
            parentPhone: parentPhone.trim() || undefined,
        });
    };

    return (
        <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Họ và tên <span className="text-red-400">*</span>
                </label>
                <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Hoc Sinh Mau"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    autoFocus
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên đăng nhập <span className="text-red-400">*</span>
                </label>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                        usernameEditedRef.current = true;
                        setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''));
                    }}
                    placeholder="an.nv.123"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">Tự động tạo từ tên. Có thể chỉnh sửa.</p>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mật khẩu <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                    <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-mono pr-10"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Mật khẩu sẽ được mã hóa khi lưu. Ghi lại để gửi cho HS.</p>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    SĐT phụ huynh <span className="text-gray-400">(không bắt buộc)</span>
                </label>
                <input
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="0987654321"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
            </div>

            <div className="flex gap-3 pt-2">
                <Button onClick={onClose} variant="secondary" className="flex-1">
                    Hủy
                </Button>
                <Button
                    type="submit"
                    variant="primary"
                    className="flex-1"
                    disabled={!fullName.trim() || username.trim().length < 3 || password.trim().length < 6 || isLoading}
                    icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                >
                    {isLoading ? 'Đang thêm...' : 'Thêm HS'}
                </Button>
            </div>
        </form>
    );
};
