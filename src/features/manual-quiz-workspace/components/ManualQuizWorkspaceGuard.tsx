import React from 'react';
import { Navigate } from 'react-router';
import { useAuthStore } from '../../../../stores/authStore';

interface ManualQuizWorkspaceGuardProps {
    children: React.ReactNode;
}

const ManualQuizWorkspaceGuard: React.FC<ManualQuizWorkspaceGuardProps> = ({ children }) => {
    const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
    const username = useAuthStore((state) => state.username);

    if (!isLoggedIn || !username) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

export default ManualQuizWorkspaceGuard;
