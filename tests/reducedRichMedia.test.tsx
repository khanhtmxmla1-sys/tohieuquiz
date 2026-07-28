import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DashboardDecoration } from '../src/components/HomePage/components/DashboardDecoration';
import { DashboardHero } from '../src/components/HomePage/components/DashboardHero';
import { SubjectGrid } from '../src/components/HomePage/components/SubjectGrid';
import QuizListPage from '../src/components/HomePage/QuizListPage';
import PetDisplay from '../src/components/gamification/PetDisplay';

const subject = {
  id: 'math',
  label: 'Toán',
  title: 'Toán học',
  desc: 'Luyện tập',
  icon: 'https://cdn.example.test/Abacus/3D/abacus_3d.png',
  color: '#2563eb',
  bgColor: 'bg-blue-50',
  borderColor: 'border-blue-200',
  btnColor: 'bg-blue-500',
  btnBorder: 'border-blue-700',
  btnText: 'text-white',
  btnLabel: 'Bắt đầu',
  total: 3,
};

describe('reduced rich media rendering', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: {
        saveData: true,
        effectiveType: '3g',
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 8 });
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 8 });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps the dashboard usable without loading 3D images', () => {
    const { container } = render(
      <>
        <DashboardDecoration />
        <DashboardHero onScrollToSubjects={() => undefined} />
        <SubjectGrid subjectCards={[subject]} activeTab="all" onCategoryClick={() => undefined} />
      </>,
    );

    expect(screen.getByRole('button', { name: /chọn môn học/i })).toBeVisible();
    expect(screen.getByText('Toán học')).toBeVisible();
    expect(container.querySelector('img[src*="/3D/"]')).toBeNull();
    expect(screen.getByText(/chế độ tiết kiệm dữ liệu/i)).toBeVisible();
  });

  it('keeps the quiz list usable without decorative or card 3D images', () => {
    const { container } = render(
      <QuizListPage
        category="math"
        quizzes={[{
          id: 'quiz-1',
          title: 'Phép cộng cơ bản',
          category: 'math',
          timeLimit: 15,
          questions: [{ id: 'q1' }],
        }]}
        onBack={() => undefined}
        onQuizClick={() => undefined}
        searchTerm=""
        onSearchChange={() => undefined}
        selectedGrade={null}
        onGradeChange={() => undefined}
        isLoggedIn
      />,
    );

    expect(screen.getByText('Phép cộng cơ bản')).toBeVisible();
    expect(container.querySelector('img[src*="/3D/"]')).toBeNull();
  });

  it('uses an emoji pet and does not mount the CSS 3D pet in reduced mode', () => {
    const { container } = render(<PetDisplay pet={{
      petId: 'cat_01',
      petName: 'Mèo Ong',
      level: 1,
      exp: 0,
      expToNext: 10,
      mood: 'happy',
      items: [],
      lastActive: '2026-07-28T00:00:00.000Z',
    }} />);

    expect(screen.getByText('🐱')).toBeVisible();
    expect(container.querySelector('[data-rich-media="css-3d-pet"]')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});
