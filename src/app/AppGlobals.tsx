import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Toaster } from 'react-hot-toast';
import { ChatBot } from '../components/ChatBot';

export const AppGlobals: React.FC<{ showChatbot: boolean }> = ({ showChatbot }) => (
    <>
        {showChatbot && <ChatBot />}
        <Analytics />
        <Toaster
            position="top-center"
            containerStyle={{ top: 64 }}
            toastOptions={{
                style: {
                    fontFamily: "'Baloo 2', sans-serif",
                    fontWeight: 600,
                    fontSize: '0.93rem',
                    borderRadius: '14px',
                    padding: '12px 16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                },
                duration: 3500,
            }}
        />
    </>
);
