import type { GiftCatalogItem } from '../../../types/giftShop.types';
import type { useGiftCatalogEditor } from './useGiftCatalogEditor';
import { GiftCatalogForm } from './GiftCatalogForm';
import { GiftCatalogList } from './GiftCatalogList';

interface Props {
  catalog: GiftCatalogItem[];
  editor: ReturnType<typeof useGiftCatalogEditor>;
}

export const GiftCatalogAdminSection = ({ catalog, editor }: Props) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
    <div className="mb-4">
      <h3 className="text-lg font-bold text-slate-900">Kho quà</h3>
      <p className="mt-1 text-sm text-slate-500">Thêm, chỉnh sửa hoặc ngừng hiển thị phần thưởng trong cửa hàng học sinh.</p>
    </div>
    <GiftCatalogForm
      form={editor.form}
      setForm={editor.setForm}
      editingItemId={editor.editingItemId}
      onSubmit={editor.submit}
      onCancelEdit={editor.resetAdminForm}
    />
    <GiftCatalogList catalog={catalog} onEdit={editor.startEditing} onDelete={editor.remove} />
  </section>
);
