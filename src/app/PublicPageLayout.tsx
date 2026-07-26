import React from 'react';
import { Footer } from './lazyViews';
import type { RoutePath } from './routeTypes';

interface PublicPageLayoutProps {
    children: React.ReactNode;
    onNavigate: (path: RoutePath) => void;
    showPublicLinks?: boolean;
}

export const PublicPageLayout: React.FC<PublicPageLayoutProps> = ({ children, onNavigate, showPublicLinks }) => (
    <div className="flex flex-col min-h-screen">
        <main className="flex-1">{children}</main>
        <Footer onNavigate={onNavigate} showPublicLinks={showPublicLinks} />
    </div>
);
