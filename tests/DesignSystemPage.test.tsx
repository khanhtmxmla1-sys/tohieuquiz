import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import DesignSystemPage from '../src/components/design-system/DesignSystemPage';
describe('DesignSystemPage', () => { it('shows all nine icons at four supported sizes', () => { render(<MemoryRouter><DesignSystemPage /></MemoryRouter>); expect(screen.getByRole('heading', { name: 'Design System TôHiệuQuiz' })).toBeInTheDocument(); expect(document.querySelectorAll('[data-module-icon]')).toHaveLength(36); }); });
