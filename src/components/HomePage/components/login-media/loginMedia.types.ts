export type LoginMediaDisplayMode = 'CONTENT' | 'SLIDER';
export type LoginMediaTransition = 'FADE' | 'SLIDE';

export interface LoginMediaPublicSettings {
  autoplay: boolean;
  intervalMs: number;
  transition: LoginMediaTransition;
  showDots: boolean;
  showArrows: boolean;
  pauseOnHover: boolean;
}

export interface LoginMediaPublicSlide {
  id: string;
  imageUrl: string;
  imageWidth: number | null;
  imageHeight: number | null;
  alt: string;
  linkUrl: string | null;
  openNewTab: boolean;
  cropX: number;
  cropY: number;
  cropZoom: number;
}

export interface LoginMediaPublicData {
  mode: LoginMediaDisplayMode;
  settings: LoginMediaPublicSettings;
  slides: LoginMediaPublicSlide[];
  degraded?: boolean;
}
