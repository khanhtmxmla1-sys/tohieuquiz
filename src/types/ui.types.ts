/**
 * UI Component Types
 * 
 * TypeScript types for React component props.
 */

import React from 'react';
import type { Quiz, Question, StudentResult } from './domain.types';

/**
 * Common Button Props
 */
export interface ButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    className?: string;
    type?: 'button' | 'submit' | 'reset';
}

/**
 * Modal Props
 */
export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Card Props
 */
export interface CardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    hoverable?: boolean;
}

/**
 * Input Field Props
 */
export interface InputFieldProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: 'text' | 'password' | 'email' | 'number';
    error?: string;
    disabled?: boolean;
    required?: boolean;
}

/**
 * Select Props
 */
export interface SelectProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    error?: string;
    disabled?: boolean;
}

/**
 * Tab Props
 */
export interface TabProps {
    tabs: { id: string; label: string; icon?: React.ReactNode }[];
    activeTab: string;
    onChange: (tabId: string) => void;
}

/**
 * Table Column Definition
 */
export interface TableColumn<T> {
    key: keyof T | string;
    header: string;
    render?: (item: T) => React.ReactNode;
    sortable?: boolean;
    width?: string;
}

/**
 * Table Props
 */
export interface TableProps<T> {
    data: T[];
    columns: TableColumn<T>[];
    onRowClick?: (item: T) => void;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
    onSort?: (field: string) => void;
}

/**
 * Pagination Props
 */
export interface PaginationProps {
    page: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
}

/**
 * Quiz Card Props
 */
export interface QuizCardProps {
    quiz: Quiz;
    onClick?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
}

/**
 * Question Renderer Props
 */
export interface QuestionRendererProps {
    question: Question;
    index: number;
    answer?: any;
    onAnswerChange: (value: any) => void;
    showResult?: boolean;
}

/**
 * Result Card Props
 */
export interface ResultCardProps {
    result: StudentResult;
    quiz?: Quiz;
}

/**
 * Progress Bar Props
 */
export interface ProgressBarProps {
    value: number;
    max?: number;
    showLabel?: boolean;
    variant?: 'default' | 'success' | 'warning' | 'danger';
}

/**
 * Badge Props
 */
export interface BadgeProps {
    children: React.ReactNode;
    variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

/**
 * Alert Props
 */
export interface AlertProps {
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    onClose?: () => void;
}

/**
 * Loading Spinner Props
 */
export interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}
