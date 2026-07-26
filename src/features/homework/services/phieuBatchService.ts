import { callApi } from '../../../services/apiAdapter';
import { PublishPhieuBatchInput, PublishPhieuBatchResult } from '../types/phieu.types';

export const phieuBatchService = {
  async publishBatch(input: PublishPhieuBatchInput): Promise<PublishPhieuBatchResult> {
    const response = await callApi<{ status: string; data: PublishPhieuBatchResult; message?: string }>('publish_phieu_batch', input);
    if (response.status === 'success') return response.data;
    throw new Error(response.message || 'Không thể xuất link phụ huynh');
  },

  async deactivatePublicLink(publicToken: string): Promise<void> {
    const response = await callApi<{ status: string; message?: string }>('deactivate_public_phieu_link', { publicToken });
    if (response.status !== 'success') {
      throw new Error(response.message || 'Không thể thu hồi link');
    }
  },
};
