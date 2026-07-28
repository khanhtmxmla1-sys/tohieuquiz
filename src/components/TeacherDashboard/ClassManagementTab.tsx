import React, { useEffect, memo } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { 
    useClassManagement, 
    ClassListView, 
    ClassDetailView, 
    CreateClassModal, 
    TransferTeacherModal 
} from '../../features/class-management';

interface ClassManagementTabProps {
    isAdmin: boolean;
    username: string | null;
}

const ClassManagementTab: React.FC<ClassManagementTabProps> = memo(({ isAdmin, username }) => {
    const { isOnline } = useOnlineStatus();
    const {
        selectedClass,
        setSelectedClass,
        showCreateModal,
        setShowCreateModal,
        handleCreateClass,
        handleDeleteClass,
        openTransferModal,
        closeTransferModal,
        transferClassroom,
        transferTeacherUsername,
        setTransferTeacherUsername,
        teachers,
        handleTransferTeacher,
        isLoadingTeachers,
        isTransferring,
        transferError,
        store,
    } = useClassManagement(isAdmin, username);

    const { classes, fetchClasses, fetchStudents } = store;

    // Load classes initially
    useEffect(() => {
        if (username && isOnline) fetchClasses(isAdmin ? undefined : username);
    }, [username, isAdmin, fetchClasses, isOnline]);

    // Refresh the roster whenever a class is opened so cached data cannot masquerade as current data.
    useEffect(() => {
        if (selectedClass && isOnline) void fetchStudents(selectedClass.id);
    }, [selectedClass?.id, fetchStudents, isOnline]);

    return (
        <div className="animate-fade-in relative min-h-[500px]">
            {!selectedClass ? (
                <ClassListView
                    classes={classes}
                    isAdmin={isAdmin}
                    onSelectClass={setSelectedClass}
                    onCreateClick={() => {
                        if (isOnline) setShowCreateModal(true);
                    }}
                    onTransferClick={(classroom) => {
                        if (isOnline) void openTransferModal(classroom);
                    }}
                    onDeleteClick={(classroom) => {
                        if (isOnline) handleDeleteClass(classroom);
                    }}
                    isLoading={store.isLoading}
                    error={store.error}
                    onRetry={() => username && isOnline && fetchClasses(isAdmin ? undefined : username)}
                    isOnline={isOnline}
                    lastUpdatedAt={store.lastUpdatedAt}
                />
            ) : (
                <ClassDetailView
                    classroom={selectedClass}
                    onBack={() => {
                        setSelectedClass(null);
                        if (username) void fetchClasses(isAdmin ? undefined : username);
                    }}
                />
            )}

            {showCreateModal && isOnline && (
                <CreateClassModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateClass}
                    isLoading={store.isLoading}
                />
            )}

            {transferClassroom && isOnline && (
                <TransferTeacherModal
                    classroom={transferClassroom}
                    teachers={teachers}
                    selectedTeacherUsername={transferTeacherUsername}
                    onSelectTeacher={setTransferTeacherUsername}
                    onClose={closeTransferModal}
                    onSubmit={handleTransferTeacher}
                    isLoadingTeachers={isLoadingTeachers}
                    isSaving={isTransferring}
                    error={transferError}
                />
            )}
        </div>
    );
});

export default ClassManagementTab;
