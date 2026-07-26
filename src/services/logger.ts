/**
 * Logger Service - Centralized logging with levels and context
 * Production: errors only | Development: all logs
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
    module?: string;
    action?: string;
    userId?: string;
    [key: string]: any;
}

const LOG_COLORS = {
    info: '#3b82f6',
    warn: '#f59e0b',
    error: '#ef4444',
    debug: '#8b5cf6'
} as const;

class Logger {
    private isDev = import.meta.env.DEV;

    private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const prefix = context?.module ? `[${context.module}]` : '';
        return `${timestamp} ${prefix} ${message}`;
    }

    private log(level: LogLevel, message: string, context?: LogContext, data?: any) {
        // In production, only log errors and warnings
        if (!this.isDev && level === 'debug') return;
        if (!this.isDev && level === 'info') return;

        const formattedMessage = this.formatMessage(level, message, context);
        const color = LOG_COLORS[level];

        switch (level) {
            case 'error':
                console.error(`%c❌ ${formattedMessage}`, `color: ${color}; font-weight: bold`);
                if (data) console.error(data);
                // Could send to external error tracking service here
                break;
            case 'warn':
                console.warn(`%c⚠️ ${formattedMessage}`, `color: ${color}; font-weight: bold`);
                if (data) console.warn(data);
                break;
            case 'info':
                console.info(`%cℹ️ ${formattedMessage}`, `color: ${color}`);
                if (data) console.info(data);
                break;
            case 'debug':
                console.debug(`%c🔍 ${formattedMessage}`, `color: ${color}`);
                if (data) console.debug(data);
                break;
        }
    }

    info(message: string, context?: LogContext, data?: any) {
        this.log('info', message, context, data);
    }

    warn(message: string, context?: LogContext, data?: any) {
        this.log('warn', message, context, data);
    }

    error(message: string, context?: LogContext, data?: any) {
        this.log('error', message, context, data);
    }

    debug(message: string, context?: LogContext, data?: any) {
        this.log('debug', message, context, data);
    }

    // Convenience methods for common modules
    api = {
        request: (endpoint: string, data?: any) =>
            this.debug(`API Request: ${endpoint}`, { module: 'API' }, data),
        response: (endpoint: string, data?: any) =>
            this.debug(`API Response: ${endpoint}`, { module: 'API' }, data),
        error: (endpoint: string, error: any) =>
            this.error(`API Error: ${endpoint}`, { module: 'API' }, error)
    };

    auth = {
        login: (username: string) =>
            this.info(`Login attempt: ${username}`, { module: 'Auth' }),
        logout: () =>
            this.info('User logged out', { module: 'Auth' }),
        error: (error: any) =>
            this.error('Authentication failed', { module: 'Auth' }, error)
    };

    quiz = {
        start: (quizId: string, student: string) =>
            this.info(`Quiz started: ${quizId}`, { module: 'Quiz', action: 'start' }),
        submit: (quizId: string, score: number) =>
            this.info(`Quiz submitted: ${quizId}, Score: ${score}`, { module: 'Quiz', action: 'submit' }),
        error: (error: any) =>
            this.error('Quiz error', { module: 'Quiz' }, error)
    };
}

export const logger = new Logger();
export default logger;
