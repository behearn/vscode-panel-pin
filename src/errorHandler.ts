import * as vscode from 'vscode';

export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

export enum ErrorCategory {
    PANEL_MANIPULATION = 'panel_manipulation',
    FOCUS_MONITORING = 'focus_monitoring',
    SETTINGS_PERSISTENCE = 'settings_persistence',
    UI_COMPONENT = 'ui_component',
    INITIALIZATION = 'initialization',
    CLEANUP = 'cleanup'
}

export interface ErrorInfo {
    category: ErrorCategory;
    severity: ErrorSeverity;
    message: string;
    originalError?: Error;
    context?: Record<string, any>;
    timestamp: Date;
}

export class ErrorHandler {
    private static instance: ErrorHandler;
    private outputChannel: vscode.OutputChannel;
    private errorCount: Map<ErrorCategory, number> = new Map();
    private lastErrors: ErrorInfo[] = [];
    private maxErrorHistory = 50;
    private notificationThrottleMap: Map<string, number> = new Map();
    private notificationThrottleDelay = 5000; // 5 seconds

    private constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.initializeErrorCounts();
    }

    public static getInstance(outputChannel?: vscode.OutputChannel): ErrorHandler {
        if (!ErrorHandler.instance) {
            if (!outputChannel) {
                throw new Error('OutputChannel required for first initialization');
            }
            ErrorHandler.instance = new ErrorHandler(outputChannel);
        }
        return ErrorHandler.instance;
    }

    public handleError(errorInfo: ErrorInfo): void {
        if (!errorInfo.timestamp) {
            errorInfo.timestamp = new Date();
        }

        if (errorInfo.severity === ErrorSeverity.LOW && !errorInfo.originalError && (!errorInfo.context || Object.keys(errorInfo.context).length === 0)) {
            return;
        }

        this.logError(errorInfo);
        this.updateErrorCount(errorInfo);
        this.addToErrorHistory(errorInfo);
        this.showUserNotification(errorInfo);        
    }

    public handleSimpleError(
        category: ErrorCategory,
        severity: ErrorSeverity,
        message: string,
        originalError?: Error,
        context?: Record<string, any>
    ): void {
        const errorInfo: ErrorInfo = {
            category,
            severity,
            message,
            originalError,
            context,
            timestamp: new Date()
        };

        this.handleError(errorInfo);
    }

    public getErrorStatistics(): Record<string, any> {
        return {
            errorCounts: Object.fromEntries(this.errorCount),
            recentErrors: this.lastErrors.slice(-10),
            totalErrors: this.lastErrors.length
        };
    }

    public reset(): void {
        this.errorCount.clear();
        this.lastErrors = [];
        this.notificationThrottleMap.clear();
        this.initializeErrorCounts();
        this.outputChannel.appendLine('ErrorHandler reset - all counters cleared');
    }

    public static resetGlobal(): void {
        if (ErrorHandler.instance) {
            ErrorHandler.instance.reset();
        }
    }

    private initializeErrorCounts(): void {
        Object.values(ErrorCategory).forEach(category => {
            this.errorCount.set(category, 0);
        });
    }

    private logError(errorInfo: ErrorInfo): void {
        const timestamp = errorInfo.timestamp.toISOString();
        const prefix = this.getSeverityPrefix(errorInfo.severity);
        
        this.outputChannel.appendLine(`${prefix} [${timestamp}] ${errorInfo.category.toUpperCase()}: ${errorInfo.message}`);
        
        if (errorInfo.originalError) {
            this.outputChannel.appendLine(`  Original error: ${errorInfo.originalError.message}`);
            if (errorInfo.originalError.stack) {
                this.outputChannel.appendLine(`  Stack trace: ${errorInfo.originalError.stack}`);
            }
        }
        
        if (errorInfo.context) {
            this.outputChannel.appendLine(`  Context: ${JSON.stringify(errorInfo.context, null, 2)}`);
        }
    }

    private getSeverityPrefix(severity: ErrorSeverity): string {
        switch (severity) {
            case ErrorSeverity.LOW:
                return '⚪';
            case ErrorSeverity.MEDIUM:
                return '🟡';
            case ErrorSeverity.HIGH:
                return '🟠';
            case ErrorSeverity.CRITICAL:
                return '🔴';
            default:
                return '❓';
        }
    }

    private updateErrorCount(errorInfo: ErrorInfo): void {
        const category = errorInfo.category;
        const currentCount = this.errorCount.get(category) || 0;
        const newCount = currentCount + 1;
        this.errorCount.set(category, newCount);
        const detailParts: string[] = [`severity=${errorInfo.severity}`, `message=${errorInfo.message}`];

        if (errorInfo.originalError) {
            detailParts.push(`originalError=${errorInfo.originalError.message}`);
        }

        if (errorInfo.context && Object.keys(errorInfo.context).length > 0) {
            detailParts.push(`context=${JSON.stringify(errorInfo.context)}`);
        }

        this.outputChannel.appendLine(`[ErrorHandler] Error count for ${category}: ${newCount} (${detailParts.join(', ')})`);
        if (category === ErrorCategory.PANEL_MANIPULATION) {
            const stack = new Error().stack;
            this.outputChannel.appendLine(`[ErrorHandler][DEBUG] PANEL_MANIPULATION incremented. Stack:\n${stack}`);
            this.outputChannel.appendLine(`[ErrorHandler][DEBUG] Recent errors: ${JSON.stringify(this.lastErrors.slice(-3), null, 2)}`);
        }
    }

    private addToErrorHistory(errorInfo: ErrorInfo): void {
        this.lastErrors.push(errorInfo);
        
        if (this.lastErrors.length > this.maxErrorHistory) {
            this.lastErrors = this.lastErrors.slice(-this.maxErrorHistory);
        }
    }

    private showUserNotification(errorInfo: ErrorInfo): void {
        // Throttle notifications to avoid spam
        const notificationKey = `${errorInfo.category}_${errorInfo.severity}`;
        const lastNotification = this.notificationThrottleMap.get(notificationKey) || 0;
        const now = Date.now();
        
        if (now - lastNotification < this.notificationThrottleDelay) {
            return; // Skip notification due to throttling
        }
        
        this.notificationThrottleMap.set(notificationKey, now);

        switch (errorInfo.severity) {
            case ErrorSeverity.CRITICAL:
                vscode.window.showErrorMessage(
                    `Panel Pin: Critical error - ${errorInfo.message}`,
                    'View Logs',
                    'Disable Extension'
                ).then(selection => {
                    if (selection === 'View Logs') {
                        this.outputChannel.show();
                    }
                });
                break;
                
            case ErrorSeverity.HIGH:
                vscode.window.showWarningMessage(
                    `Panel Pin: ${errorInfo.message}`,
                    'View Logs'
                ).then(selection => {
                    if (selection === 'View Logs') {
                        this.outputChannel.show();
                    }
                });
                break;
                
            case ErrorSeverity.MEDIUM:
            case ErrorSeverity.LOW:
                // Medium/Low severity errors are only logged, not shown to user
                break;
        }
    }

}

export function createErrorInfo(
    category: ErrorCategory,
    severity: ErrorSeverity,
    message: string,
    originalError?: Error,
    context?: Record<string, any>,
    recoveryAction?: string
): ErrorInfo {
    return {
        category,
        severity,
        message,
        originalError,
        context,
        timestamp: new Date()
    };
}

export async function withErrorHandling<T>(
    operation: () => Promise<T>,
    errorHandler: ErrorHandler,
    category: ErrorCategory,
    operationName: string,
    context?: Record<string, any>
): Promise<T | null> {
    try {
        return await operation();
    } catch (error) {
        errorHandler.handleSimpleError(
            category,
            ErrorSeverity.MEDIUM,
            `${operationName} failed: ${error}`,
            error instanceof Error ? error : new Error(String(error)),
            context
        );
        return null;
    }
}