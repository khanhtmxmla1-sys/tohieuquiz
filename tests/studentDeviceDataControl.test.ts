import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('student device data control', () => {
  it('exposes a visible cleanup action wired to the account controller', () => {
    const header = readFileSync('src/components/HomePage/student-dashboard/StudentDashboardHeader.tsx', 'utf8');
    const account = readFileSync('src/features/student-dashboard/hooks/useStudentAccount.ts', 'utf8');
    const shell = readFileSync('src/components/HomePage/StudentDashboardUI.tsx', 'utf8');
    expect(header).toContain('Xóa dữ liệu trên thiết bị này');
    expect(header).toContain('onClearDeviceData');
    expect(account).toContain('clearDeviceData');
    expect(account).toContain('logoutStudent()');
    expect(shell).toContain('onClearDeviceData={account.clearDeviceData}');
  });
});
