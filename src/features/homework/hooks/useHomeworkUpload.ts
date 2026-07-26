import { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { uploadToCloudinary } from '../../../services/cloudinaryService';
import { IMAGE_CONFIG } from '../homework.constants';

interface UploadState {
  isCompressing: boolean;
  isUploading: boolean;
  progress: number;
  error: string | null;
  url: string | null;
}

/**
 * Hook to handle student homework submission with automatic compression
 */
export const useHomeworkUpload = () => {
  const [state, setState] = useState<UploadState>({
    isCompressing: false,
    isUploading: false,
    progress: 0,
    error: null,
    url: null,
  });

  const uploadHomework = async (file: File): Promise<string | null> => {
    setState({ ...state, isCompressing: true, error: null, progress: 10 });

    try {
      // 1. Compression Phase
      const options = {
        maxSizeMB: IMAGE_CONFIG.MAX_SIZE_MB,
        maxWidthOrHeight: IMAGE_CONFIG.MAX_WIDTH_HEIGHT,
        useWebWorker: true,
        initialQuality: IMAGE_CONFIG.COMPRESSION_LEVEL,
      };

      const compressedFile = file.type === 'application/pdf'
        ? file
        : await imageCompression(file, options);
      
      setState(prev => ({ 
        ...prev, 
        isCompressing: false, 
        isUploading: true, 
        progress: 40 
      }));

      // 2. Upload Phase
      // Note: We use the existing shared cloudinaryService
      const secureUrl = await uploadToCloudinary(compressedFile);

      setState(prev => ({ 
        ...prev, 
        isUploading: false, 
        progress: 100, 
        url: secureUrl 
      }));

      return secureUrl;
    } catch (err: unknown) {
      const normalizedError = err instanceof Error ? err : new Error(String(err));
      const errorMessage = normalizedError.message || 'Có lỗi xảy ra khi nộp bài.';
      setState(prev => ({ 
        ...prev, 
        isCompressing: false, 
        isUploading: false, 
        error: errorMessage 
      }));
      console.error('Homework Upload Error:', err);
      return null;
    }
  };

  const resetUpload = () => {
    setState({
      isCompressing: false,
      isUploading: false,
      progress: 0,
      error: null,
      url: null,
    });
  };

  return {
    ...state,
    uploadHomework,
    resetUpload,
  };
};
