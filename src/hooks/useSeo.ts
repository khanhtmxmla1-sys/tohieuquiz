import { useEffect } from 'react';
import { Quiz } from '../types';
import {
    SEO_LOGO_URL,
    SEO_SOCIAL_IMAGE_ALT,
    SEO_SOCIAL_IMAGE_URL,
} from '../config/branding';
import {
    BRAND_RELATIONSHIP_LINE,
    SCHOOL_IDENTIFIER,
    SCHOOL_LOCALITY,
    SCHOOL_LOCATION_LABEL,
    SCHOOL_NAME,
    SCHOOL_OFFICIAL_EMAIL,
    SCHOOL_PROFILE_PATH,
    SCHOOL_REGION,
    SITE_URL,
} from '../config/schoolIdentity';

const DEFAULT_TITLE = `${SCHOOL_NAME} ${SCHOOL_REGION} | TôHiệuQuiz`;
const DEFAULT_DESCRIPTION =
    `TôHiệuQuiz là nền tảng học tập trực tuyến gắn với ${SCHOOL_NAME}, ${SCHOOL_LOCATION_LABEL}.`;
const DEFAULT_KEYWORDS =
    `${SCHOOL_NAME}, Tiểu học Tô Hiệu Sơn La, Tô Hiệu Sơn La, TôHiệuQuiz`;
const SEO_CATEGORY_WHITELIST = new Set(['all', 'vioedu', 'trang-nguyen', 'on-tap', 'toan', 'tieng-viet']);

// SEO Utility Functions
const upsertMetaByName = (name: string, content: string) => {
    let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
    if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', name);
        document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
};

const upsertMetaByProperty = (property: string, content: string) => {
    let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
    if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
};

const upsertCanonical = (href: string) => {
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', href);
};

const upsertJsonLd = (id: string, payload: Record<string, unknown>) => {
    let tag = document.getElementById(id) as HTMLScriptElement | null;
    if (!tag) {
        tag = document.createElement('script');
        tag.id = id;
        tag.type = 'application/ld+json';
        document.head.appendChild(tag);
    }
    tag.textContent = JSON.stringify(payload);
};

const getCanonicalUrl = (pathname: string, view: string, selectedQuiz: Quiz | null): string => {
    if (pathname !== '/') {
        return new URL(pathname, `${window.location.origin}/`).toString();
    }

    const canonical = new URL(window.location.origin + '/');

    if (view === 'student' && selectedQuiz?.id) {
        canonical.searchParams.set('quizId', selectedQuiz.id);
        return canonical.toString();
    }

    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');
    if (category && SEO_CATEGORY_WHITELIST.has(category)) {
        canonical.searchParams.set('category', category);
    }

    return canonical.toString();
};

const buildStructuredData = (canonicalUrl: string, title: string, description: string, selectedQuiz: Quiz | null) => {
    const school = {
        '@type': 'EducationalOrganization',
        '@id': `${SITE_URL}/#school`,
        name: SCHOOL_NAME,
        identifier: SCHOOL_IDENTIFIER,
        email: SCHOOL_OFFICIAL_EMAIL,
        address: {
            '@type': 'PostalAddress',
            addressLocality: SCHOOL_LOCALITY,
            addressRegion: SCHOOL_REGION,
            addressCountry: 'VN',
        },
        url: `${SITE_URL}${SCHOOL_PROFILE_PATH}`,
        logo: SEO_LOGO_URL,
        image: SEO_SOCIAL_IMAGE_URL,
    };

    if (selectedQuiz) {
        return {
            '@context': 'https://schema.org',
            '@type': 'Quiz',
            name: selectedQuiz.title,
            description,
            url: canonicalUrl,
            educationalLevel: selectedQuiz.classLevel ? `Lớp ${selectedQuiz.classLevel}` : 'Tiểu học',
            about: selectedQuiz.category || 'Trắc nghiệm',
            inLanguage: 'vi',
            isAccessibleForFree: true,
            numberOfQuestions: selectedQuiz.questions?.length || 0,
            image: SEO_SOCIAL_IMAGE_URL,
            publisher: school,
        };
    }

    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebSite',
                name: 'TôHiệuQuiz',
                url: 'https://www.thtohieu.com',
                inLanguage: 'vi',
                description,
                logo: SEO_LOGO_URL,
                image: SEO_SOCIAL_IMAGE_URL,
            },
            school,
            {
                '@type': 'WebPage',
                name: title,
                url: canonicalUrl,
                description,
                image: SEO_SOCIAL_IMAGE_URL,
            },
            {
                '@type': 'SoftwareApplication',
                name: 'TôHiệuQuiz',
                applicationCategory: 'EducationalApplication',
                operatingSystem: 'Web',
                url: SITE_URL,
                description: BRAND_RELATIONSHIP_LINE,
                provider: { '@id': `${SITE_URL}/#school` },
                logo: SEO_LOGO_URL,
                image: SEO_SOCIAL_IMAGE_URL,
            },
        ],
    };
};

/**
 * Custom hook to manage SEO metadata and titles.
 */
export const useSeo = (
    pathname: string,
    view: string,
    selectedQuiz: Quiz | null,
    isGiftShopFeatureEnabled: boolean
) => {
    useEffect(() => {
        let title = DEFAULT_TITLE;
        let description = DEFAULT_DESCRIPTION;
        let keywords = DEFAULT_KEYWORDS;
        let robots = 'index, follow';

        if (pathname === SCHOOL_PROFILE_PATH) {
            title = `${SCHOOL_NAME} ${SCHOOL_REGION} | Giới thiệu chính thức`;
            description =
                `Thông tin nhận diện ${SCHOOL_NAME}, ${SCHOOL_LOCATION_LABEL} và nền tảng học tập TôHiệuQuiz.`;
            keywords =
                `${SCHOOL_NAME} ${SCHOOL_REGION}, Tiểu học Tô Hiệu, Tô Hiệu Sơn La, TôHiệuQuiz`;
        } else if (pathname === '/about') {
            title = `Giới thiệu ${SCHOOL_NAME} ${SCHOOL_REGION} | TôHiệuQuiz`;
            description =
                `Giới thiệu hoạt động giáo dục và nền tảng học tập TôHiệuQuiz của ${SCHOOL_NAME}, ${SCHOOL_REGION}.`;
            keywords = `giới thiệu ${SCHOOL_NAME}, nền tảng giáo dục tiểu học`;
        } else if (pathname === '/contact') {
            title = `Liên hệ ${SCHOOL_NAME} ${SCHOOL_REGION} | TôHiệuQuiz`;
            description =
                `Thông tin liên hệ và các kênh hỗ trợ liên quan đến ${SCHOOL_NAME}, ${SCHOOL_REGION} và TôHiệuQuiz.`;
            keywords = `liên hệ ${SCHOOL_NAME}, hỗ trợ TôHiệuQuiz`;
        } else if (pathname === '/privacy') {
            title = 'Chính sách bảo mật - TôHiệuQuiz';
        } else if (pathname === '/tos') {
            title = 'Điều khoản sử dụng - TôHiệuQuiz';
        } else if (view === 'teacher_dash') {
            title = 'Quản lý đề thi - TôHiệuQuiz';
            robots = 'noindex, nofollow, noarchive';
        } else if (view === 'student' && selectedQuiz) {
            title = `${selectedQuiz.title} - TôHiệuQuiz`;
            description = `Luyện tập bài thi ${selectedQuiz.title} trên hệ thống TôHiệuQuiz.`;
            robots = 'noindex, nofollow, noarchive';
            keywords = [
                selectedQuiz.title,
                `Lớp ${selectedQuiz.classLevel || 'Tiểu học'}`,
                selectedQuiz.category || 'trắc nghiệm',
                'TôHiệuQuiz',
                'ôn thi tiểu học',
            ].join(', ');
        } else if (view === 'student_portal') {
            title = 'Cổng học sinh - TôHiệuQuiz';
            robots = 'noindex, nofollow, noarchive';
        } else if (view === 'shop' && isGiftShopFeatureEnabled) {
            title = 'Tiệm quà TôHiệuQuiz';
            description = 'Đổi quà bằng xu và quản lý voucher trong hệ thống TôHiệuQuiz.';
            robots = 'noindex, nofollow, noarchive';
        }

        const canonicalUrl = getCanonicalUrl(pathname, view, selectedQuiz);
        const structuredData = buildStructuredData(
            canonicalUrl,
            title,
            description,
            pathname === '/' && view === 'student' ? selectedQuiz : null
        );

        document.title = title;

        upsertMetaByName('description', description);
        upsertMetaByName('keywords', keywords);
        upsertMetaByName('robots', robots);

        upsertMetaByProperty('og:title', title);
        upsertMetaByProperty('og:description', description);
        upsertMetaByProperty('og:url', canonicalUrl);
        upsertMetaByProperty('og:image', SEO_SOCIAL_IMAGE_URL);
        upsertMetaByProperty('og:image:width', '1200');
        upsertMetaByProperty('og:image:height', '630');
        upsertMetaByProperty('og:image:type', 'image/png');
        upsertMetaByProperty('og:image:alt', SEO_SOCIAL_IMAGE_ALT);
        upsertMetaByProperty('twitter:title', title);
        upsertMetaByProperty('twitter:description', description);
        upsertMetaByProperty('twitter:url', canonicalUrl);

        upsertMetaByName('twitter:title', title);
        upsertMetaByName('twitter:description', description);
        upsertMetaByName('twitter:card', 'summary_large_image');
        upsertMetaByName('twitter:image', SEO_SOCIAL_IMAGE_URL);
        upsertMetaByName('twitter:image:alt', SEO_SOCIAL_IMAGE_ALT);

        upsertCanonical(canonicalUrl);
        upsertJsonLd('seo-jsonld', structuredData);
    }, [
        pathname,
        view,
        selectedQuiz?.id,
        selectedQuiz?.title,
        selectedQuiz?.classLevel,
        selectedQuiz?.category,
        selectedQuiz?.questions?.length,
        isGiftShopFeatureEnabled,
    ]);
};
