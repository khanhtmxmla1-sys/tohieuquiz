import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MediaDropzone from '../src/features/manual-quiz-workspace/components/MediaDropzone';

const mediaMocks = vi.hoisted(() => ({
    compress: vi.fn(),
    upload: vi.fn(),
}));

vi.mock('../src/services/cloudinaryService', () => ({
    compressImageForUpload: mediaMocks.compress,
    uploadToCloudinary: mediaMocks.upload,
}));

const Harness = () => {
    const [value, setValue] = useState('');
    const [altText, setAltText] = useState('');
    return (
        <>
            <MediaDropzone
                label="Ảnh câu hỏi"
                value={value}
                altText={altText}
                onChange={setValue}
                onAltTextChange={setAltText}
            />
            <output data-testid="media-value">{value}</output>
            <output data-testid="alt-value">{altText}</output>
        </>
    );
};

const imageFile = (name = 'question.png', type = 'image/png') =>
    new File(['image-data'], name, { type });

const setFileSize = (file: File, size: number): File => {
    Object.defineProperty(file, 'size', { configurable: true, value: size });
    return file;
};

beforeEach(() => {
    vi.clearAllMocks();
    mediaMocks.compress.mockImplementation(async (file: File, options?: { onProgress?: (value: number) => void }) => {
        options?.onProgress?.(100);
        return file;
    });
    mediaMocks.upload.mockImplementation(async (_file: File, options?: { onProgress?: (value: number) => void }) => {
        options?.onProgress?.(50);
        options?.onProgress?.(100);
        return 'https://res.cloudinary.com/demo/image/upload/question.webp';
    });
});

describe('MediaDropzone', () => {
    it('rejects unsupported MIME and oversized images before compression', async () => {
        render(<Harness />);
        const input = screen.getByLabelText('Chọn ảnh Ảnh câu hỏi');

        fireEvent.change(input, { target: { files: [imageFile('notes.txt', 'text/plain')] } });
        expect(await screen.findByRole('alert')).toHaveTextContent('JPG, PNG hoặc WebP');
        expect(mediaMocks.compress).not.toHaveBeenCalled();

        const large = setFileSize(imageFile(), 10 * 1024 * 1024 + 1);
        fireEvent.change(input, { target: { files: [large] } });
        expect(await screen.findByRole('alert')).toHaveTextContent('10 MB');
        expect(mediaMocks.compress).not.toHaveBeenCalled();
    });

    it('compresses and uploads a selected file while exposing progress', async () => {
        let resolveUpload!: (url: string) => void;
        mediaMocks.upload.mockImplementation((_file: File, options?: { onProgress?: (value: number) => void }) => {
            options?.onProgress?.(25);
            return new Promise<string>((resolve) => { resolveUpload = resolve; });
        });
        render(<Harness />);

        fireEvent.change(screen.getByLabelText('Chọn ảnh Ảnh câu hỏi'), {
            target: { files: [imageFile()] },
        });

        expect(await screen.findByRole('progressbar', { name: 'Tiến độ tải Ảnh câu hỏi' })).toHaveAttribute('value', '55');
        expect(mediaMocks.compress).toHaveBeenCalledTimes(1);
        expect(mediaMocks.upload).toHaveBeenCalledTimes(1);

        await act(async () => {
            resolveUpload('https://res.cloudinary.com/demo/image/upload/final.webp');
        });
        expect(screen.getByTestId('media-value')).toHaveTextContent('https://res.cloudinary.com/demo/image/upload/final.webp');
        expect(screen.getByTestId('media-value').textContent).not.toContain('data:image');
        expect(screen.getByRole('img', { name: 'Ảnh câu hỏi' })).toHaveAttribute('src', expect.stringContaining('cloudinary.com'));
    });

    it('uploads an image pasted from clipboard', async () => {
        render(<Harness />);
        const region = screen.getByRole('region', { name: 'Tải ảnh Ảnh câu hỏi' });
        const file = imageFile('pasted.webp', 'image/webp');

        fireEvent.paste(region, {
            clipboardData: {
                items: [{ type: 'image/webp', getAsFile: () => file }],
            },
        });

        await waitFor(() => expect(mediaMocks.upload).toHaveBeenCalledTimes(1));
        expect(screen.getByTestId('media-value')).toHaveTextContent('cloudinary.com');
    });

    it('supports retry after failure without losing the selected file', async () => {
        mediaMocks.upload
            .mockRejectedValueOnce(new Error('Mạng bị gián đoạn'))
            .mockResolvedValueOnce('https://res.cloudinary.com/demo/retry.webp');
        render(<Harness />);

        fireEvent.change(screen.getByLabelText('Chọn ảnh Ảnh câu hỏi'), {
            target: { files: [imageFile()] },
        });
        expect(await screen.findByRole('alert')).toHaveTextContent('Mạng bị gián đoạn');

        fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại Ảnh câu hỏi' }));
        await waitFor(() => expect(screen.getByTestId('media-value')).toHaveTextContent('retry.webp'));
        expect(mediaMocks.upload).toHaveBeenCalledTimes(2);
    });

    it('sanitizes alt text and supports replace, URL and remove controls', async () => {
        render(<Harness />);
        fireEvent.change(screen.getByLabelText('Chọn ảnh Ảnh câu hỏi'), {
            target: { files: [imageFile()] },
        });
        await waitFor(() => expect(screen.getByRole('img', { name: 'Ảnh câu hỏi' })).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText('Mô tả ảnh Ảnh câu hỏi'), {
            target: { value: '  Hình\u0000   vuông   màu xanh  ' },
        });
        expect(screen.getByTestId('alt-value')).toHaveTextContent('Hình vuông màu xanh');
        expect(screen.getByRole('img', { name: 'Hình vuông màu xanh' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Thay ảnh Ảnh câu hỏi' }));
        expect(screen.getByLabelText('Chọn ảnh Ảnh câu hỏi')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Dùng URL cho Ảnh câu hỏi' }));
        fireEvent.change(screen.getByLabelText('URL Ảnh câu hỏi'), {
            target: { value: 'https://example.com/manual.png' },
        });
        expect(screen.getByTestId('media-value')).toHaveTextContent('https://example.com/manual.png');

        fireEvent.click(screen.getByRole('button', { name: 'Xóa ảnh Ảnh câu hỏi' }));
        expect(screen.getByTestId('media-value')).toBeEmptyDOMElement();
    });
});
