import React from 'react';
import { FLUENT_CDN } from '../constants/dashboard.constants';

export const DashboardDecoration: React.FC = () => {
    return (
        <>
            {/* Sun Decoration */}
            <div className="sticker-land__sun">
                <img
                    src={`${FLUENT_CDN}/Sun/3D/sun_3d.png`}
                    alt=""
                    className="sticker-land__sun-img"
                />
            </div>

            {/* Cloud 1 */}
            <div className="sticker-land__cloud sticker-land__cloud--1">
                <img src={`${FLUENT_CDN}/Cloud/3D/cloud_3d.png`} alt="" />
            </div>
            {/* Cloud 2 */}
            <div className="sticker-land__cloud sticker-land__cloud--2">
                <img src={`${FLUENT_CDN}/Cloud/3D/cloud_3d.png`} alt="" />
            </div>
        </>
    );
};
