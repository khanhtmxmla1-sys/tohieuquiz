import { useEffect } from 'react';
import { Quiz } from '../types';

const DEFAULT_TITLE = 'TôHiệuQuiz - Nền tảng kiểm tra và học tập tiểu học';
const DEFAULT_DESCRIPTION = 'TôHiệuQuiz giúp giáo viên tạo đề trắc nghiệm nhanh, hỗ trợ học sinh ôn thi chương trình GDPT 2018.';
const DEFAULT_KEYWORDS = 'TôHiệuQuiz, kiểm tra tiểu học, giao bài trực tuyến, tạo đề AI, học tập trực tuyến';
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
    const organization = {
        '@type': 'EducationalOrganization',
        name: 'TôHiệuQuiz',
        alternateName: 'TôHiệuQuiz',
        url: 'https://www.thtohieu.com',
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
            publisher: organization,
        };
    }

    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebSite',
                name: 'TôHiệuQuiz',
                url: 'https://www.thtohieu.com/',
                inLanguage: 'vi',
                description,
            },
            organization,
            {
                '@type': 'WebPage',
                name: title,
                url: canonicalUrl,
                description,
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

        if (pathname === '/about') {
            title = 'Giới thiệu TôHiệuQuiz';
            description = 'Thông tin giới thiệu TôHiệuQuiz, quá trình phát triển và hoạt động nổi bật.';
            keywords = 'giới thiệu TôHiệuQuiz, nền tảng giáo dục tiểu học';
        } else if (pathname === '/contact') {
            title = 'Liên hệ TôHiệuQuiz';
            description = 'Kênh liên hệ TôHiệuQuiz: địa chỉ, hotline, fanpage và bản đồ.';
            keywords = 'liên hệ TôHiệuQuiz, hỗ trợ TôHiệuQuiz';
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
        upsertMetaByProperty('twitter:title', title);
        upsertMetaByProperty('twitter:description', description);
        upsertMetaByProperty('twitter:url', canonicalUrl);

        upsertMetaByName('twitter:title', title);
        upsertMetaByName('twitter:description', description);

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
