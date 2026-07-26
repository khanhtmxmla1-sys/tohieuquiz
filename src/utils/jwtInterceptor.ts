/**
 * JWT Interceptor
 * 
 * Handles JWT token expiration and authentication errors
 * - Intercepts 401 errors and shows user-friendly messages
 * - Redirects to login when session expires
 * - Can be extended to auto-refresh tokens
 */

import { showError } from './toast';

export interface JWTInterceptorConfig {
    onUnauthorized?: () => void;
    showToast?: boolean;
    redirectOnUnauthorized?: boolean;
}

/**
 * Wrap fetch calls to intercept 401 errors
 */
export async function fetchWithJWTInterceptor(
    url: string,
    options: RequestInit = {},
    config: JWTInterceptorConfig = {}
): Promise<Response> {
    const { onUnauthorized, showToast = true, redirectOnUnauthorized = false } = config;

    try {
        const response = await fetch(url, options);

        // Intercept 401 Unauthorized
        if (response.status === 401) {
            if (showToast) {
                showError('Không có quyền truy cập hoặc phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại nếu cần.');
            }

            // Call custom handler if provided
            if (onUnauthorized) {
                onUnauthorized();
            } else if (redirectOnUnauthorized) {
                // Default: redirect to home after a short delay
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            }
        }

        return response;
    } catch (error) {
        throw error;
    }
}
