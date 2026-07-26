import React, { useEffect, memo } from 'react';
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
        if (username) fetchClasses(isAdmin ? undefined : username);
    }, [username, isAdmin, fetchClasses]);

    // Refresh the roster whenever a class is opened so cached data cannot masquerade as current data.
    useEffect(() => {
        if (selectedClass) void fetchStudents(selectedClass.id);
    }, [selectedClass?.id, fetchStudents]);

    return (
        <div className="animate-fade-in relative min-h-[500px]">
            {!selectedClass ? (
                <ClassListView
                    classes={classes}
                    isAdmin={isAdmin}
                    onSelectClass={setSelectedClass}
                    onCreateClick={() => setShowCreateModal(true)}
                    onTransferClick={openTransferModal}
                    onDeleteClick={handleDeleteClass}
                    isLoading={store.isLoading}
                    error={store.error}
                    onRetry={() => username && fetchClasses(isAdmin ? undefined : username)}
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

            {showCreateModal && (
                <CreateClassModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateClass}
                    isLoading={store.isLoading}
                />
            )}

            {transferClassroom && (
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
