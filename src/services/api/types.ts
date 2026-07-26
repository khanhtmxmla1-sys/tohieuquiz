export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * session/studentSession: xác thực bằng HttpOnly cookie
 * public: không cần xác thực
 */
export type AuthPolicy = 'session' | 'studentSession' | 'public';

export type ApiPayload = Record<string, any>;

export interface ApiRoute {
  method: HttpMethod;
  auth: AuthPolicy;
  path: (payload: ApiPayload) => string;
  query?: (payload: ApiPayload) => URLSearchParams;
  body?: (action: string, payload: ApiPayload) => ApiPayload;
}

export type RouteRegistry = Record<string, ApiRoute>;
