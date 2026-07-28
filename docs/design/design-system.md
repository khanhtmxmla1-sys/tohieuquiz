# TôHiệuQuiz Design System

## Principles

- Use semantic tokens rather than feature-specific colors.
- Keep interactive hit areas at least 44 × 44 px.
- Every control must have a visible focus state and an accessible name.
- Loading, error and empty states must be explicit; color is never the only signal.
- Respect `prefers-reduced-motion` and preserve layouts at 320, 768, 1024 and 1440 px.

## Foundations

The canonical tokens live in `src/styles/design-tokens.css`. Spacing follows a 4 px base scale. New common primitives must use semantic utility classes or CSS variables instead of introducing raw color values.

## Common primitives

- `Button`: loading uses `aria-busy` and keeps a 44 px hit area.
- `Input`: requires a label and connects description/error text with ARIA IDs.
- `Alert`: exposes state through icon, text and ARIA role.
- `Skeleton`, `EmptyState`, `AsyncState`: standard loading/error/empty/retry handling.
- `Modal`: portal dialog with focus trap, Escape handling, focus return and body scroll lock.
