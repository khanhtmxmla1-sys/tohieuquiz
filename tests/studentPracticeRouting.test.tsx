import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentDashboardUI from '../src/components/HomePage/StudentDashboardUI';
import { useStudentPracticeCatalog } from '../src/features/student-dashboard/hooks/useStudentPracticeCatalog';

const routingMocks = vi.hoisted(() => ({
  closeSubject: vi.fn(),
  topics: [
    { name: '#phep_nhan', count: 40 },
    { name: '#english', count: 20 },
  ],
}));

vi.mock('../src/features/student-dashboard/hooks/usePracticeTopics', () => ({
  usePracticeTopics: () => ({
    topics: routingMocks.topics,
    isLoading: false,
    errorMessage: null,
    retry: vi.fn(async () => undefined),
  }),
}));

vi.mock('../src/components/student/PracticeLibrary/SubjectLibrary', () => ({
  default: ({
    subjectId,
    isValidSubject,
    onBack,
  }: {
    subjectId: string;
    isValidSubject: boolean;
    onBack: () => void;
  }) => (
    <div>
      <h1>{isValidSubject ? `Môn ${subjectId}` : 'Không tìm thấy môn học'}</h1>
      <button type="button" onClick={onBack}>Trở về thư viện</button>
    </div>
  ),
}));

vi.mock('../src/components/gamification/StudentFloatingSidebar', () => ({
  StudentFloatingSidebar: () => null,
}));

vi.mock('../src/features/student-dashboard', () => ({
  StudentDashboardContent: () => <div>Dashboard học sinh</div>,
  StudentDashboardModals: () => null,
  StudentLiveExamScreen: () => null,
  useStudentDashboardController: () => ({
    studentSession: {
      studentId: 'student-1',
      username: 'student-one',
      fullName: 'Nguyễn Minh An',
      classId: 'class-1',
      className: '5A',
    },
    liveExam: { shouldRenderScreen: false },
    practice: { closeSubject: routingMocks.closeSubject },
    activeSection: 'dashboard',
    giftShopEnabled: false,
    assignments: {},
    attendance: {},
    rewards: {},
    account: {},
    setActiveSection: vi.fn(),
    openGiftShop: vi.fn(),
    openAvatar: vi.fn(),
    openBadgeGallery: vi.fn(),
    selectedHomework: null,
    homeworkSubmission: undefined,
    isAvatarOpen: false,
    isBadgeGalleryOpen: false,
    closeAvatar: vi.fn(),
    closeBadgeGallery: vi.fn(),
    setSelectedHomework: vi.fn(),
  }),
}));

const LocationProbe = () => {
  const location = useLocation();
  return <output aria-label="Đường dẫn hiện tại">{location.pathname}</output>;
};

const CatalogHarness = () => {
  const catalog = useStudentPracticeCatalog();
  return (
    <div>
      <button type="button" onClick={() => catalog.selectSubject('toan')}>Mở Toán</button>
      <button type="button" onClick={() => catalog.selectSubject('tin-hoc')}>Mở môn chưa có</button>
      <button type="button" onClick={catalog.closeSubject}>Đóng môn</button>
      <LocationProbe />
    </div>
  );
};

describe('student practice routing', () => {
  beforeEach(() => {
    routingMocks.closeSubject.mockReset();
  });

  it('navigates only available subjects to stable canonical routes', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="*" element={<CatalogHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mở Toán' }));
    expect(screen.getByLabelText('Đường dẫn hiện tại')).toHaveTextContent('/student/practice/toan');

    fireEvent.click(screen.getByRole('button', { name: 'Mở môn chưa có' }));
    expect(screen.getByLabelText('Đường dẫn hiện tại')).toHaveTextContent('/student/practice/toan');
  });

  it('returns to the dashboard route without local selectedSubject state', () => {
    render(
      <MemoryRouter initialEntries={['/student/practice/toan']}>
        <Routes>
          <Route path="*" element={<CatalogHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Đóng môn' }));
    expect(screen.getByLabelText('Đường dẫn hiện tại')).toHaveTextContent('/');
  });

  it('renders a direct canonical subject route after a refresh-equivalent mount', () => {
    render(
      <MemoryRouter initialEntries={['/student/practice/tieng-viet']}>
        <Routes>
          <Route path="/student/practice/:subjectId" element={<StudentDashboardUI />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Môn tieng-viet' })).toBeVisible();
  });

  it('renders an invalid subject state instead of a blank page', () => {
    render(
      <MemoryRouter initialEntries={['/student/practice/tn-xh']}>
        <Routes>
          <Route path="/student/practice/:subjectId" element={<StudentDashboardUI />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Không tìm thấy môn học' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Trở về thư viện' }));
    expect(routingMocks.closeSubject).toHaveBeenCalledTimes(1);
  });
});
