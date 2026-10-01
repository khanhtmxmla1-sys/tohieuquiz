import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LoginMediaImageViewport from '../src/components/HomePage/components/login-media/LoginMediaImageViewport';

describe('LoginMediaImageViewport', () => {
  it('uses intrinsic dimensions so zoom and focal crop can pan without exposing empty space', () => {
    render(
      <div style={{ width: 630, height: 286 }}>
        <LoginMediaImageViewport
          imageUrl="https://res.cloudinary.com/demo/image/upload/banner.webp"
          imageWidth={1200}
          imageHeight={520}
          alt="Banner crop"
          cropX={0.55}
          cropY={0.55}
          cropZoom={1.25}
        />
      </div>,
    );

    const image = screen.getByRole('img', { name: 'Banner crop' });
    expect(image.style.width).toBe('130.9524%');
    expect(image.style.height).toBe('125%');
    expect(image.style.left).toBe('-22.0238%');
    expect(image.style.top).toBe('-18.75%');
    expect(image.style.transform).toBe('');
  });
});
