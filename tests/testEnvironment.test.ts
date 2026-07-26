describe('Vitest environment defaults', () => {
    it('disables the Gift Shop feature flag independently of local env files', () => {
        expect(import.meta.env.VITE_FEATURE_GIFT_SHOP_V2).toBe('false');
    });
});
