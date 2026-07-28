import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GiftOrderStatus } from '../../../types/giftShop.types';
import type { GiftShopFiltersState } from './types';
import { useBrowserSearchParams } from '../../../hooks/useBrowserSearchParams';

interface Options {
  username?: string | null;
  isAdmin: boolean;
  teacherClass?: string | null;
}

const VALID_STATUSES: ReadonlySet<GiftOrderStatus | 'ALL'> = new Set([
  'ALL',
  'CREATED',
  'VOUCHER_ISSUED',
  'DELIVERED',
  'CANCELLED_REFUNDED',
]);

export const useGiftShopFilters = ({ username, isAdmin, teacherClass }: Options): GiftShopFiltersState => {
  const [searchParams, setSearchParams] = useBrowserSearchParams();
  const rawStatus = searchParams.get('status');
  const statusFilter: GiftOrderStatus | 'ALL' = rawStatus && VALID_STATUSES.has(rawStatus as GiftOrderStatus | 'ALL')
    ? rawStatus as GiftOrderStatus | 'ALL'
    : 'VOUCHER_ISSUED';
  const [classFilter, setClassFilter] = useState('');
  const [debouncedClassFilter, setDebouncedClassFilter] = useState('');

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedClassFilter(classFilter.trim()), 350);
    return () => window.clearTimeout(timeoutId);
  }, [classFilter]);

  const setStatusFilter = useCallback((status: GiftOrderStatus | 'ALL') => {
    const next = new URLSearchParams(searchParams);
    next.set('status', status);
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

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
