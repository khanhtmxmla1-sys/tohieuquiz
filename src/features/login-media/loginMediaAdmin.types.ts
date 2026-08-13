import type {
  LoginMediaDisplayMode,
  LoginMediaTransition,
} from '../../components/HomePage/components/login-media/loginMedia.types';

export interface LoginMediaAdminSettings {
  id: string;
  displayMode: LoginMediaDisplayMode;
  autoplay: boolean;
  intervalMs: number;
  transition: LoginMediaTransition;
  showDots: boolean;
  showArrows: boolean;
  pauseOnHover: boolean;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
}

export interface LoginMediaAdminSlide {
  id: string;
  cloudinaryPublicId: string;
  imageUrl: string;
  imageWidth: number | null;
  imageHeight: number | null;
  altText: string;
  internalTitle: string;
  linkUrl: string | null;
  openNewTab: boolean;
  sortOrder: number;
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface LoginMediaAdminState {
  settings: LoginMediaAdminSettings;
  slides: LoginMediaAdminSlide[];
}

export interface LoginMediaSettingsUpdate {
  expectedVersion: number;
  displayMode: LoginMediaDisplayMode;
  autoplay: boolean;
  intervalMs: number;
  transition: LoginMediaTransition;
  showDots: boolean;
  showArrows: boolean;
  pauseOnHover: boolean;
  reason: string;
}

export interface LoginMediaSlideInput {
  cloudinaryPublicId: string;
  imageUrl: string;
  imageWidth: number | null;
  imageHeight: number | null;
  altText: string;
  internalTitle: string;
  linkUrl: string | null;
  openNewTab: boolean;
  sortOrder: number;
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export interface LoginMediaSlideUpdate extends LoginMediaSlideInput {
  expectedUpdatedAt: string;
}

export interface LoginMediaUploadSignatureData {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
  assetFolder: string;
  allowedFormats: string;
  uploadPreset: string;
  overwrite: 'false';
  uploadUrl: string;
}

export interface LoginMediaUploadedImage {
  secureUrl: string;
  publicId: string;
  width: number;
  height: number;
}
