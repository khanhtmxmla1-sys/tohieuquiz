import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../services/api/errors';
import {
  createLoginMediaSlide,
  deleteLoginMediaSlide,
  getLoginMediaAdminState,
  reorderLoginMediaSlides,
  requestLoginMediaUploadSignature,
  updateLoginMediaSettings,
  updateLoginMediaSlide,
  uploadLoginMediaImage,
} from '../../../services/loginMediaAdminService';
import { showError, showSuccess } from '../../../utils/toast';
import type {
  LoginMediaAdminState,
  LoginMediaSettingsUpdate,
  LoginMediaSlideInput,
  LoginMediaSlideUpdate,
  LoginMediaUploadedImage,
} from '../loginMediaAdmin.types';

const conflict = (error: unknown): boolean => error instanceof ApiError && error.status === 409;

export function useLoginMediaAdmin() {
  const [state, setState] = useState<LoginMediaAdminState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setState(await getLoginMediaAdminState());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Không thể tải cấu hình banner đăng nhập.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveSettings = async (input: LoginMediaSettingsUpdate) => {
    setBusy(true);
    try {
      const settings = await updateLoginMediaSettings(input);
      setState((current) => current ? { ...current, settings } : current);
      showSuccess('Đã lưu cài đặt banner đăng nhập.');
    } catch (error) {
      if (conflict(error)) {
        showError('Cấu hình vừa được cập nhật ở nơi khác. Đã tải lại phiên bản mới nhất.');
        await load();
      } else {
        showError(error instanceof Error ? error.message : 'Không thể lưu cài đặt.');
      }
    } finally {
      setBusy(false);
    }
  };

  const uploadImage = async (file: File, onProgress: (percent: number) => void): Promise<LoginMediaUploadedImage> => {
    const signature = await requestLoginMediaUploadSignature();
    return uploadLoginMediaImage(file, signature, onProgress);
  };

  const saveNewSlide = async (input: LoginMediaSlideInput) => {
    setBusy(true);
    try {
      const created = await createLoginMediaSlide(input);
      setState((current) => current ? { ...current, slides: [...current.slides, created] } : current);
      showSuccess('Đã thêm banner. Banner mới mặc định tắt cho đến khi bạn bật hiển thị.');
      return true;
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Không thể thêm banner.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveExistingSlide = async (id: string, input: LoginMediaSlideUpdate) => {
    setBusy(true);
    try {
      const updated = await updateLoginMediaSlide(id, input);
      setState((current) => current ? {
        ...current,
        slides: current.slides.map((slide) => slide.id === id ? updated : slide),
      } : current);
      showSuccess('Đã cập nhật banner.');
      return true;
    } catch (error) {
      if (conflict(error)) {
        showError('Banner vừa được cập nhật ở nơi khác. Đã tải lại dữ liệu mới nhất.');
        await load();
      } else {
        showError(error instanceof Error ? error.message : 'Không thể cập nhật banner.');
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  const reorder = async (slideIds: string[]) => {
    setBusy(true);
    try {
      await reorderLoginMediaSlides(slideIds, 'Sắp xếp banner từ giao diện quản trị');
      setState((current) => current ? {
        ...current,
        slides: slideIds.map((id, index) => ({
          ...current.slides.find((slide) => slide.id === id)!,
          sortOrder: (index + 1) * 10,
        })),
      } : current);
      showSuccess('Đã cập nhật thứ tự banner.');
    } catch (error) {
      if (conflict(error)) await load();
      showError(error instanceof Error ? error.message : 'Không thể sắp xếp banner.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, expectedUpdatedAt: string) => {
    setBusy(true);
    try {
      await deleteLoginMediaSlide(id, expectedUpdatedAt);
      setState((current) => current ? {
        ...current,
        slides: current.slides.filter((slide) => slide.id !== id),
      } : current);
      showSuccess('Đã xóa banner khỏi danh sách. Ảnh Cloudinary được giữ lại để tránh xóa ngoài ý muốn.');
    } catch (error) {
      if (conflict(error)) await load();
      showError(error instanceof Error ? error.message : 'Không thể xóa banner.');
    } finally {
      setBusy(false);
    }
  };

  return {
    state,
    loading,
    busy,
    loadError,
    reload: load,
    saveSettings,
    uploadImage,
    saveNewSlide,
    saveExistingSlide,
    reorder,
    remove,
  };
}
