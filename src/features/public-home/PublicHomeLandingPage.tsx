import React from 'react';
import AudienceAndFeatures from './components/AudienceAndFeatures';
import CompetitionHighlights from './components/CompetitionHighlights';
import GettingStarted from './components/GettingStarted';
import LandingFacts from './components/LandingFacts';
import LandingFooter from './components/LandingFooter';
import LandingHeader from './components/LandingHeader';
import LandingHero from './components/LandingHero';
import RoleBenefitsTabs from './components/RoleBenefitsTabs';
import { usePublicHomeHashNavigation } from './usePublicHomeHashNavigation';
import './PublicHomeLanding.css';

export interface PublicHomeLandingPageProps {
    giftShopEnabled?: boolean;
}

const PublicHomeLandingPage: React.FC<PublicHomeLandingPageProps> = ({ giftShopEnabled = false }) => {
    usePublicHomeHashNavigation();
    return (
        <div
            className="public-home-landing"
            style={{ overflowX: 'clip', overflowY: 'visible' }}
            data-testid="public-home-landing"
        >
            <a className="public-home__skip-link" href="#public-home-main">
                Bỏ qua đến nội dung chính
            </a>
            <LandingHeader />
            <main id="public-home-main">
                <div id="top">
                    <LandingHero />
                </div>
                <AudienceAndFeatures giftShopEnabled={giftShopEnabled} />
                <RoleBenefitsTabs />
                <CompetitionHighlights />
                <LandingFacts />
                <GettingStarted />
            </main>
            <LandingFooter />
        </div>
    );
};

export default PublicHomeLandingPage;
