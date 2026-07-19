import * as vscode from 'vscode';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from './errorHandler';

export interface IFocusMonitor {
    onEditorFocus: vscode.Event<void>;
    startMonitoring(): void;
    stopMonitoring(): void;
    dispose(): void;
}

export class FocusMonitor implements IFocusMonitor {
    private readonly _onEditorFocus = new vscode.EventEmitter<void>();
    public readonly onEditorFocus: vscode.Event<void> = this._onEditorFocus.event;

    private disposables: vscode.Disposable[] = [];
    private debounceTimer: NodeJS.Timeout | undefined;
    private readonly debounceDelay: number = 500;
    private isMonitoring: boolean = false;
    private errorHandler: ErrorHandler;

    constructor(errorHandler?: ErrorHandler) {
        this.errorHandler = errorHandler || ErrorHandler.getInstance();
    }

    public startMonitoring(): void {
        if (this.isMonitoring) {
            return;
        }

        try {
            this.isMonitoring = true;

            const activeEditorChangeDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor && editor.document && editor.document.uri.scheme === 'file') {
                    // Only react to actual editor focus changes, not typing/cursor movement.
                    this.debounceEditorFocus(editor);
                }
            });

            this.disposables.push(activeEditorChangeDisposable);

            this.errorHandler.handleSimpleError(
                ErrorCategory.FOCUS_MONITORING,
                ErrorSeverity.LOW,
                'Focus monitoring started successfully',
                undefined,
                { debounceDelay: this.debounceDelay }
            );
        } catch (error) {
            this.isMonitoring = false;
            this.errorHandler.handleSimpleError(
                ErrorCategory.FOCUS_MONITORING,
                ErrorSeverity.HIGH,
                'Failed to start focus monitoring',
                error instanceof Error ? error : new Error(String(error)),
                { attemptedStart: true }
            );
            throw error;
        }
    }

    public stopMonitoring(): void {
        if (!this.isMonitoring) {
            return;
        }
        this.isMonitoring = false;
        this.clearDebounceTimer();
        this.dispose();
    }

    public dispose(): void {
        this.clearDebounceTimer();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this._onEditorFocus.dispose();
    }

    private debounceEditorFocus(editor?: vscode.TextEditor): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this._onEditorFocus.fire();
        }, this.debounceDelay);
    }

    private clearDebounceTimer(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = undefined;
        }
    }
}