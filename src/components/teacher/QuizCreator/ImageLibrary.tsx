/**
 * Image Library Component
 * 
 * Upload and manage images for quiz questions.
 */

import React from 'react';
import toast from 'react-hot-toast';
import { ImageLibraryItem } from '../../../types';
import { Image, Upload, X, Loader2 } from 'lucide-react';
import { uploadToCloudinary } from '../../../services/cloudinaryService';

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_COUNT = 20;

interface ImageLibraryProps {
    images: ImageLibraryItem[];
    onChange: (images: ImageLibraryItem[]) => void;
    topic?: string;
}

export const ImageLibrary: React.FC<ImageLibraryProps> = ({
    images,
    onChange,
    topic = '',
}) => {
    const [isUploading, setIsUploading] = React.useState(false);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        if (images.length >= MAX_IMAGE_COUNT) {
            toast.error(`Tối đa ${MAX_IMAGE_COUNT} hình. Vui lòng xóa bớt để upload thêm.`);
            return;
        }

        setIsUploading(true);
        const newImages: ImageLibraryItem[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
                toast.error(`${file.name} quá lớn (>${MAX_IMAGE_SIZE_MB}MB). Bỏ qua.`);
                continue;
            }

            if (images.length + newImages.length >= MAX_IMAGE_COUNT) {
                toast(`Chỉ có thể upload thêm ${MAX_IMAGE_COUNT - images.length} hình.`, { icon: '⚠️' });
                break;
            }

            try {
                const imageUrl = await uploadToCloudinary(file);
                newImages.push({
                    id: `img-${Date.now()}-${i}`,
                    name: file.name,
                    data: imageUrl,
                    topic: topic,
                    createdAt: new Date().toISOString(),
                });
            } catch (err) {
                console.error('Error uploading:', err);
                toast.error(`Lỗi upload ${file.name}`);
            }
        }

        if (newImages.length > 0) {
            onChange([...images, ...newImages]);
        }
        setIsUploading(false);
        e.target.value = '';
    };

    const handleDelete = (id: string) => {
        onChange(images.filter((img) => img.id !== id));
    };

    return (
        <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
            <label className="block text-sm font-bold text-purple-800 mb-2 flex items-center">
                <Image className="w-4 h-4 mr-2" />
                Thư viện hình ảnh ({images.length}/{MAX_IMAGE_COUNT})
            </label>
            <p className="text-xs text-gray-500 mb-3">
                Upload hình ảnh để AI gắn vào câu hỏi. Tối đa {MAX_IMAGE_SIZE_MB}MB/hình.
            </p>

            {/* Upload Button */}
            <label className={`flex items-center justify-center w-full p-3 border-2 border-dashed border-purple-300 rounded-lg cursor-pointer hover:bg-purple-100 transition-colors mb-3 ${isUploading ? 'opacity-50 cursor-wait' : ''}`}>
                {isUploading ? (
                    <>
                        <Loader2 className="w-5 h-5 text-purple-500 mr-2 animate-spin" />
                        <span className="text-purple-600 font-medium">Đang upload...</span>
                    </>
                ) : (
                    <>
                        <Upload className="w-5 h-5 text-purple-500 mr-2" />
                        <span className="text-purple-600 font-medium">Upload hình ảnh</span>
                    </>
                )}
                <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleUpload}
                    disabled={isUploading}
                    className="hidden"
                />
            </label>

            {/* Image Grid */}
            {images.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                    {images.map((img) => (
                        <div key={img.id} className="relative group">
                            <img
                                src={img.data}
                                alt={img.name}
                                className="w-full h-16 object-cover rounded-lg border border-purple-200"
                            />
                            <button
                                onClick={() => handleDelete(img.id)}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                                <X className="w-3 h-3" />
                            </button>
                            <p className="text-xs text-gray-500 truncate mt-1">{img.name}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ImageLibrary;
