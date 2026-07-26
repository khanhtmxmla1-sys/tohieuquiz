/**
 * Compatibility facade — public surface is preserved exactly.
 * All routing logic now lives in ./api/apiClient.ts and ./api/routes/.
 *
 * Callers must NOT be changed: callApi(action, payload) works as before.
 */
import { executeApiAction } from './api/apiClient';

export const callApi = executeApiAction;
