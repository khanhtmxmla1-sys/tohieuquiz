// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ConfigEnv, PluginOption, UserConfig } from 'vite';
import viteConfig from '../vite.config';

const flattenPlugins = (plugins: PluginOption[] = []): Array<{ name?: string }> => {
    const flattened: Array<{ name?: string }> = [];
    for (const plugin of plugins) {
        if (!plugin) continue;
        if (Array.isArray(plugin)) flattened.push(...flattenPlugins(plugin));
        else flattened.push(plugin as { name?: string });
    }
    return flattened;
};

const resolveConfig = async (command: 'serve' | 'build'): Promise<UserConfig> => {
    if (typeof viteConfig !== 'function') return viteConfig;
    return viteConfig({
        command,
        mode: 'test',
        isSsrBuild: false,
        isPreview: command === 'serve',
    } satisfies ConfigEnv);
};

describe('Vite frontend configuration', () => {
    it('keeps the frontend dev server in Vite instead of routing page loads through workerd', async () => {
        const config = await resolveConfig('serve');
        const pluginNames = flattenPlugins(config.plugins).map(plugin => plugin.name || '');

        expect(pluginNames.some(name => name.toLowerCase().includes('cloudflare'))).toBe(false);
    });

    it('continues to proxy API calls to the separately running Worker', async () => {
        const config = await resolveConfig('serve');

        expect(config.server?.proxy?.['/api']).toMatchObject({
            changeOrigin: true,
        });
    });
});
