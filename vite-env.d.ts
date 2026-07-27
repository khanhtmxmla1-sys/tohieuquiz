/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_WORKERS_API_URL?: string;
    readonly VITE_APP_RELEASE?: string;
    readonly VITE_CLIENT_ERROR_REPORT_URL?: string;
    readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
    readonly VITE_CLOUDINARY_UPLOAD_PRESET?: string;
    readonly VITE_CLOUDINARY_AVATAR_BASE_URL?: string;
    readonly VITE_CLOUDINARY_AVATAR_FOLDER?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
