export interface AiGatewayBinding {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface Env {
    DB: D1Database;
    AI_GATEWAY: AiGatewayBinding;
    CLIPROXY_API: string;
    CLIPROXY_TOKEN: string;
    JWT_SECRET: string;
    AUTH_MIGRATION_MODE?: 'compat' | 'enforce';
    AUTH_TOKEN_TRANSPORT_MODE?: 'compat' | 'cookie';
    ENVIRONMENT?: 'production' | 'development' | 'test';
    ALLOWED_ORIGINS?: string;
    ANNOUNCEMENT_IMAGE_HOSTS?: string;
    OG_IMAGES: R2Bucket;
    R2_PUBLIC_URL: string;
    // Task 1.4: Cloudflare Queues binding
    CERTIFICATE_QUEUE: Queue<{ batchId: string }>;
    CERT_IMAGES: R2Bucket;           // R2 bucket for rendered certificate PNGs
}

export interface Quiz {
    id: string;
    title: string;
    class_level: string;
    category?: string;
    time_limit: number;
    created_at: string;
    access_code?: string;
    require_code: string; // 'TRUE' | 'FALSE'
    created_by?: string;
    show_on_home: string; // 'TRUE' | 'FALSE'
    tags: string; // JSON string or comma separated
}

export interface Question {
    id: string;
    quiz_id: string;
    type: string;
    question: string;
    options?: string;
    correct_answer: string;
    items?: string;
    text_field?: string;
    blanks?: string;
    distractors?: string;
    sentence?: string;
    words?: string;
    correct_word_indexes?: string;
    image?: string;
    tags?: string;
    subject?: string;
    skill_code?: string;
    subskill_code?: string;
    difficulty?: 1 | 2 | 3 | null;
    math_format_version?: number;
    points?: number | null;
    explanation?: string;
    image_alt?: string;
}

export interface Assignment {
    id: string;
    quiz_id: string;
    class_id: string;
    student_id?: string;
    deadline: string;
    max_attempts: number;
    status: string;
    created_at: string;
}

export interface ResultRow {
    id: number;
    student_id?: string | null;
    student_name: string;
    class_name: string;
    quiz_id: string;
    quiz_title: string;
    score: number;
    correct_count: number;
    total_questions: number;
    time_taken: number;
    submitted_at: string;
    answers?: string;
}

export interface PetData {
    pet_id: string;
    pet_name: string;
    level: number;
    exp: number;
    exp_to_next: number;
    mood: string;
    items: string; // JSON string
    last_active: string;
    image_url: string;
}

export interface ShopItem {
    item_id: string;
    name: string;
    price: number;
    type: string;
    category: string;
    asset_url: string;
}

