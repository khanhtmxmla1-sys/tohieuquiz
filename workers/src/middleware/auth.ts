// Central route policy gate. Route handlers still enforce roles and row ownership;
// this registry ensures every dispatched API family is explicitly classified.

import { Env } from '../types';
import { errorResponse } from '../utils/response';
import { findApiAuthorizationPolicy } from '../security/apiAuthorizationPolicy';

export {
  apiAuthorizationPolicies,
  findApiAuthorizationPolicy,
} from '../security/apiAuthorizationPolicy';
export type {
  ApiAuthorizationClass,
  ApiAuthorizationPolicy,
  ApiOwnershipKey,
} from '../security/apiAuthorizationPolicy';

export function verifyToken(request: Request, _env: Env): Response | null {
  const { pathname } = new URL(request.url);
  if (request.method === 'OPTIONS') return null;

  if (findApiAuthorizationPolicy(pathname, request.method)) return null;
  return errorResponse('Unauthorized: route has no explicit authentication policy', 401);
}
