import { useState } from 'react';
import type { GiftCatalogItem, GiftOrderActor } from '../../../types/giftShop.types';
import type { GiftCatalogDeleteInput, GiftCatalogUpsertInput } from '../../../services/giftShop.service';
import { showConfirm, showError } from '../../../utils/toast';
import { EMPTY_CATALOG_FORM } from './giftShopConfig';
import type { GiftCatalogFormState } from './types';

interface Options {
  actor: GiftOrderActor;
  saveCatalogItem: (input: GiftCatalogUpsertInput) => Promise<GiftCatalogItem | null>;
  removeCatalogItem: (input: GiftCatalogDeleteInput) => Promise<boolean>;
}

export const useGiftCatalogEditor = ({ actor, saveCatalogItem, removeCatalogItem }: Options) => {
  const [form, setForm] = useState<GiftCatalogFormState>(EMPTY_CATALOG_FORM);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const resetAdminForm = () => {
    setForm(EMPTY_CATALOG_FORM);
    setEditingItemId(null);
  };

  const startEditing = (item: GiftCatalogItem) => {
    setEditingItemId(item.id);
    setForm({
      name: item.name,
      category: item.category,
      priceCoins: String(item.priceCoins),
      imageUrl: item.imageUrl,
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const price = Number(form.priceCoins);
    if (!form.name.trim() || !form.imageUrl.trim() || !Number.isFinite(price) || price <= 0) {
      showError('Vui lòng nhập đầy đủ tên, giá hợp lệ và link ảnh.');
      return;
    }
    const saved = await saveCatalogItem({
      id: editingItemId || undefined,
      name: form.name.trim(),
      category: form.category,
      priceCoins: Math.floor(price),
      imageUrl: form.imageUrl.trim(),
      isActive: true,
      actorIsAdmin: actor.isAdmin,
    });
    if (saved) resetAdminForm();
  };

  const remove = (item: GiftCatalogItem) => showConfirm({
    message: `Xóa vật phẩm "${item.name}" khỏi danh mục?`,
    confirmLabel: 'Xóa',
    destructive: true,
    onConfirm: async () => {
      const removed = await removeCatalogItem({
        id: item.id,
        actorIsAdmin: actor.isAdmin,
        actorUsername: actor.username,
      });
      if (removed && editingItemId === item.id) resetAdminForm();
    },
  });

  return { form, setForm, editingItemId, resetAdminForm, startEditing, submit, remove };
};
