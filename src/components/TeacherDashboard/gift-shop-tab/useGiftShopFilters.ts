import { useEffect, useMemo, useState } from 'react';
import type { GiftOrderStatus } from '../../../types/giftShop.types';
import type { GiftShopFiltersState } from './types';

interface Options {
  username?: string | null;
  isAdmin: boolean;
  teacherClass?: string | null;
}

export const useGiftShopFilters = ({ username, isAdmin, teacherClass }: Options): GiftShopFiltersState => {
  const [statusFilter, setStatusFilter] = useState<GiftOrderStatus | 'ALL'>('VOUCHER_ISSUED');
  const [classFilter, setClassFilter] = useState('');
  const [debouncedClassFilter, setDebouncedClassFilter] = useState('');

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedClassFilter(classFilter.trim()), 350);
    return () => window.clearTimeout(timeoutId);
  }, [classFilter]);

  const actor = useMemo(() => ({
    username: username || 'teacher',
    isAdmin,
    teacherClass,
  }), [username, isAdmin, teacherClass]);

  const query = useMemo(() => {
    const forcedClassId = isAdmin ? debouncedClassFilter : (teacherClass || '').trim();
    return {
      status: statusFilter,
      classId: forcedClassId || undefined,
      actorUsername: actor.username,
      actorIsAdmin: actor.isAdmin,
      actorTeacherClass: actor.teacherClass || undefined,
    };
  }, [statusFilter, debouncedClassFilter, isAdmin, teacherClass, actor.username, actor.isAdmin, actor.teacherClass]);

  return { statusFilter, setStatusFilter, classFilter, setClassFilter, actor, query };
};
