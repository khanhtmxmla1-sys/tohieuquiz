import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGiftShopFilters } from '../src/components/TeacherDashboard/gift-shop-tab/useGiftShopFilters';

const Harness = () => {
  const filters = useGiftShopFilters({
    username: 'teacher-a',
    isAdmin: false,
    teacherClass: '4A',
  });
  return (
    <div>
      <output data-testid="status">{filters.statusFilter}</output>
      <output data-testid="query-status">{filters.query.status}</output>
      <button type="button" onClick={() => filters.setStatusFilter('DELIVERED')}>Đã trao</button>
    </div>
  );
};

describe('Gift Shop URL filters', () => {
  it('hydrates the pending status from the Action Center URL', () => {
    window.history.replaceState({}, '', '/teacher/gift-shop?status=VOUCHER_ISSUED');
    render(<Harness />);

    expect(screen.getByTestId('status')).toHaveTextContent('VOUCHER_ISSUED');
    expect(screen.getByTestId('query-status')).toHaveTextContent('VOUCHER_ISSUED');
  });

  it('keeps status changes in the canonical URL', () => {
    window.history.replaceState({}, '', '/teacher/gift-shop?status=VOUCHER_ISSUED');
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Đã trao' }));

    expect(screen.getByTestId('status')).toHaveTextContent('DELIVERED');
    expect(`${window.location.pathname}${window.location.search}`).toBe('/teacher/gift-shop?status=DELIVERED');
  });
});
