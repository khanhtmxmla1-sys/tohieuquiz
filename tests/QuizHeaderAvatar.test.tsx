import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import QuizHeader from '../src/features/quiz-player/components/QuizHeader';

describe('QuizHeader student avatar', () => {
  it('renders the student avatar when the standard quiz opts in', () => {
    render(
      <QuizHeader
        title="Bài kiểm tra"
        timeLeft={600}
        totalQuestions={10}
        completedCount={0}
        partialCount={0}
        isPractice
        studentName="An"
        avatar="https://assets.example.test/an.png"
        showAvatar
      />,
    );

    expect(screen.getByRole('img', { name: 'Ảnh đại diện của An' })).toHaveAttribute(
      'src',
      'https://assets.example.test/an.png',
    );
  });

  it('uses a compact student initial when avatar data is missing', () => {
    render(
      <QuizHeader
        title="Bài kiểm tra"
        timeLeft={600}
        totalQuestions={10}
        completedCount={0}
        partialCount={0}
        isPractice
        studentName="An"
        avatar={null}
        showAvatar
      />,
    );

    expect(screen.getByRole('img', { name: 'Ảnh đại diện của An' })).toHaveTextContent('A');
  });

  it('does not add an avatar to shared quiz headers unless explicitly enabled', () => {
    render(
      <QuizHeader
        title="Thi thử"
        timeLeft={600}
        totalQuestions={10}
        completedCount={0}
        partialCount={0}
        isPractice={false}
        studentName="Thi trực tiếp"
        avatar={null}
      />,
    );

    expect(screen.queryByRole('img', { name: 'Ảnh đại diện của Thi trực tiếp' })).not.toBeInTheDocument();
  });
});
