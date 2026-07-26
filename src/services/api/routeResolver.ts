import type { ApiRoute } from './types';
import { routes } from './routes';

export function resolveApiRoute(action: string): ApiRoute {
    const route = routes[action];
    if (!route) {
        throw new Error(`Unknown API action: ${action}`);
    }
    return route;
}
