import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import GiftShop from '../src/components/gamification/GiftShop';

const giftShopStore = {
  catalog: [],
  myOrders: [],
  loading: { catalog: false, studentOrders: false, action: false },
  error: null,
  pendingAction: null,
  lastPurchase: null,
  loadCatalog: vi.fn(async () => undefined),
  loadStudentOrders: vi.fn(async () => undefined),
  purchaseGift: vi.fn(async () => null),
  clearError: vi.fn(),
  clearLastPurchase: vi.fn(),
};

vi.mock('../src/stores/useClassroomStore', () => ({
  useClassroomStore: () => ({
    studentSession: {
      studentId: 'student-1',
      username: 'student.one',
      fullName: 'Học sinh Một',
      classId: 'class-1',
      className: '4A',
    },
  }),
}));

vi.mock('../src/stores/useGamificationStore', () => ({
  useGamificationStore: (selector: (state: { coins: number }) => unknown) => selector({ coins: 20 }),
}));

vi.mock('../src/stores/useGiftShopStore', () => ({
  useGiftShopStore: () => giftShopStore,
}));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

describe('student Gift Shop route', () => {
  it('returns to the canonical student dashboard URL', () => {
    render(
      <MemoryRouter initialEntries={['/student/shop']}>
        <LocationProbe />
        <Routes>
          <Route path="/student/shop" element={<GiftShop />} />
          <Route path="/student/dashboard" element={<div>student-dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Quay lại trang học tập/ }));

    expect(screen.getByTestId('location')).toHaveTextContent('/student/dashboard');
    expect(screen.getByText('student-dashboard')).toBeInTheDocument();
  });
});
