/**
 * Phiếu kết quả dành riêng cho bài kiểm tra trắc nghiệm.
 * Dữ liệu định danh và điểm số được Worker lấy từ bảng results; frontend chỉ gửi
 * phần nhận xét mà giáo viên được phép chỉnh sửa.
 */
import { callApi } from '../../../services/apiAdapter';
import type {
  PhieuNhanXetInput,
  PhieuNhanXet,
  PhieuPublicLink,
  PublishPhieuBatchResult,
} from '../../homework/types/phieu.types';

export interface PublishResultLinkInput {
  resultId: string;
  phieuInput: PhieuNhanXetInput;
  existingPhieuId?: string;
}

type ResultPhieuLookupResponse = {
  status: string;
  data: {
    phieu: PhieuNhanXet | null;
    link: PhieuPublicLink | null;
  };
  message?: string;
};

export const resultPhieuLinkService = {
  async getByResult(
    resultId: string,
  ): Promise<{ phieu: PhieuNhanXet; link: PhieuPublicLink | null } | null> {
    const response = await callApi<ResultPhieuLookupResponse>('get_result_phieu', { resultId });
    if (response.status !== 'success') {
      throw new Error(response.message ?? 'Không thể tải phiếu kết quả');
    }
    if (!response.data.phieu) return null;
    return { phieu: response.data.phieu, link: response.data.link ?? null };
  },

  async upsertResult(
    resultId: string,
    phieuInput: PhieuNhanXetInput,
    existingPhieuId?: string,
  ): Promise<PhieuNhanXet> {
    const response = await callApi<{ status: string; data: PhieuNhanXet; message?: string }>(
      'upsert_result_phieu',
      {
        resultId,
        ...phieuInput,
        ...(existingPhieuId ? { id: existingPhieuId } : {}),
      },
    );
    if (response.status !== 'success' || !response.data) {
      throw new Error(response.message ?? 'Không thể lưu phiếu kết quả');
    }
    return response.data;
  },

  async upsertAndPublish(
    input: PublishResultLinkInput,
  ): Promise<{ phieu: PhieuNhanXet; link: PhieuPublicLink }> {
    const phieu = await this.upsertResult(
      input.resultId,
      input.phieuInput,
      input.existingPhieuId,
    );

    const response = await callApi<{
      status: string;
      data: PublishPhieuBatchResult;
      message?: string;
    }>('publish_phieu_batch', {
      assignmentId: phieu.submission_id,
      classId: phieu.class_id,
      teacherId: phieu.created_by,
      title: phieu.ten_bai_tap,
      phieuIds: [phieu.id],
      expiresInDays: undefined,
    });
    const link = response.data?.links?.[0];
    if (response.status !== 'success' || !link) {
      throw new Error(response.message ?? 'Không thể xuất link phụ huynh');
    }
    return { phieu, link };
  },

  async revokeLink(publicToken: string): Promise<void> {
    const response = await callApi<{ status: string; message?: string }>(
      'deactivate_public_phieu_link',
      { publicToken },
    );
    if (response.status !== 'success') {
      throw new Error(response.message ?? 'Không thể thu hồi link');
    }
  },
};
