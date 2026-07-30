import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/api/config', () => ({
  getWorkersApiBaseUrl: () => 'https://api.test',
}));

import { uploadMedia } from '../src/services/mediaUploadService';

interface MockResponse {
  status: number;
  body: string;
  networkError?: boolean;
}

class MockXMLHttpRequest {
  static next: MockResponse = {
    status: 201,
    body: JSON.stringify({
      status: 'success',
      data: { url: 'https://assets.thtohieu.com/media/test.png' },
    }),
  };
  static instances: MockXMLHttpRequest[] = [];

  method = '';
  url = '';
  withCredentials = false;
  status = 0;
  responseText = '';
  headers = new Map<string, string>();
  body: Document | XMLHttpRequestBodyInit | null = null;
  upload: XMLHttpRequestUpload = { onprogress: null } as XMLHttpRequestUpload;
  onload: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => any) | null = null;
  onerror: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => any) | null = null;

  constructor() {
    MockXMLHttpRequest.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers.set(name, value);
  }

  send(body?: Document | XMLHttpRequestBodyInit | null) {
    this.body = body ?? null;
    this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 } as ProgressEvent);
    if (MockXMLHttpRequest.next.networkError) {
      this.onerror?.call(this as unknown as XMLHttpRequest, new ProgressEvent('error'));
      return;
    }
    this.status = MockXMLHttpRequest.next.status;
    this.responseText = MockXMLHttpRequest.next.body;
    this.onload?.call(this as unknown as XMLHttpRequest, new ProgressEvent('load'));
  }
}

beforeEach(() => {
  MockXMLHttpRequest.instances = [];
  MockXMLHttpRequest.next = {
    status: 201,
    body: JSON.stringify({
      status: 'success',
      data: { url: 'https://assets.thtohieu.com/media/test.png' },
    }),
  };
  vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);
});

describe('mediaUploadService', () => {
  it('uploads the raw file with credentials, bounded metadata and progress', async () => {
    const progress = vi.fn();
    const file = new File(['png-bytes'], 'Bài tập số 1.png', { type: 'image/png' });

    await expect(uploadMedia(file, {
      purpose: 'homework-assignment',
      onProgress: progress,
    })).resolves.toBe('https://assets.thtohieu.com/media/test.png');

    const request = MockXMLHttpRequest.instances[0];
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://api.test/api/media/uploads');
    expect(request.withCredentials).toBe(true);
    expect(request.headers.get('Content-Type')).toBe('image/png');
    expect(request.headers.get('X-File-Name')).toBe(encodeURIComponent('Bài tập số 1.png'));
    expect(request.headers.get('X-Media-Purpose')).toBe('homework-assignment');
    expect(request.body).toBe(file);
    expect(progress).toHaveBeenCalledWith(50);
    expect(progress).toHaveBeenLastCalledWith(100);
  });

  it('surfaces a safe API error message', async () => {
    MockXMLHttpRequest.next = {
      status: 415,
      body: JSON.stringify({ status: 'error', message: 'Định dạng tệp không được hỗ trợ.' }),
    };

    await expect(uploadMedia(
      new File(['x'], 'notes.txt', { type: 'text/plain' }),
      { purpose: 'homework-assignment' },
    )).rejects.toThrow('Định dạng tệp không được hỗ trợ.');
  });

  it('normalizes malformed responses and network failures', async () => {
    MockXMLHttpRequest.next = { status: 201, body: '<html>bad</html>' };
    await expect(uploadMedia(
      new File(['x'], 'photo.png', { type: 'image/png' }),
      { purpose: 'homework-submission' },
    )).rejects.toThrow('Phản hồi tải tệp không hợp lệ.');

    MockXMLHttpRequest.next = { status: 0, body: '', networkError: true };
    await expect(uploadMedia(
      new File(['x'], 'photo.png', { type: 'image/png' }),
      { purpose: 'homework-submission' },
    )).rejects.toThrow('Mạng bị gián đoạn khi tải tệp.');
  });
});
