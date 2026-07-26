import type { ParentStudentProfile } from '../../../shared/parent-portal.contract';

export type ParentLinkStatus = 'PENDING' | 'ACTIVE' | 'REVOKED';

export interface ParentLinkRecord {
  id: string;
  studentId: string;
  accessCode: string;
  pinHash: string | null;
  status: ParentLinkStatus;
  tokenVersion: number;
  createdBy: string;
  createdAt: string;
  activatedAt: string | null;
  revokedAt: string | null;
  lastAccessedAt: string | null;
}

export interface ParentActivationRecord {
  id: string;
  linkId: string;
  tokenHash: string;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
  link: ParentLinkRecord;
}

export interface CreateParentLinkRecord {
  id: string;
  studentId: string;
  accessCode: string;
  createdBy: string;
  createdAt: string;
  activation: {
    id: string;
    tokenHash: string;
    expiresAt: string;
    createdAt: string;
  };
}

export interface ParentSessionPayload {
  linkId: string;
  studentId: string;
  tokenVersion: number;
  purpose: 'parent_session';
}

export interface ParentLinkRepository {
  findById(linkId: string): Promise<ParentLinkRecord | null>;
  findActiveByStudentId(studentId: string): Promise<ParentLinkRecord | null>;
  findByAccessCode(accessCode: string): Promise<ParentLinkRecord | null>;
  findActivationByHash(tokenHash: string): Promise<ParentActivationRecord | null>;
  createLink(input: CreateParentLinkRecord): Promise<ParentLinkRecord>;
  reissueLink(
    linkId: string,
    activation: CreateParentLinkRecord['activation'],
    now: string,
  ): Promise<ParentLinkRecord>;
  activateLink(linkId: string, pinHash: string, consumedTokenId: string, now: string): Promise<void>;
  revokeLink(linkId: string, now: string): Promise<void>;
  touchLastAccessed(linkId: string, now: string): Promise<void>;
  loadProfile(studentId: string): Promise<ParentStudentProfile | null>;
}

export interface ParentSessionLinkLoader {
  findById(linkId: string): Promise<ParentLinkRecord | null>;
}
