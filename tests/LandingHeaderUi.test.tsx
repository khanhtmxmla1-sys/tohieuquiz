import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import LandingHeader from '../src/components/HomePage/components/LandingHeader';

describe('landing header visual accessibility', () => {
  it('keeps the Quiz brand accent readable against the white header', () => {
    render(
      <MemoryRouter>
        <LandingHeader />
      </MemoryRouter>,
    );

    expect(screen.getByText('Quiz')).toHaveClass('text-[#946f00]');
  });
});
