import * as vscode from 'vscode';
import { PanelManager } from './panelManager';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from './errorHandler';

export interface IPinToggleUI {
    show(): void;
    hide(): void;
    updateState(isPinned: boolean): void;
    dispose(): void;
}

export class PinToggleUI implements IPinToggleUI {
    private _panelManager: PanelManager;
    private _disposables: vscode.Disposable[] = [];
    private _errorHandler: ErrorHandler;
    private _uiUpdateFailures: number = 0;
    private _maxUIUpdateFailures: number = 3;
    private _statusBarItem: vscode.StatusBarItem | null = null;

    constructor(panelManager: PanelManager, errorHandler?: ErrorHandler) {
        this._panelManager = panelManager;
        this._errorHandler = errorHandler || ErrorHandler.getInstance();

        try {
            this.createStatusBarItem();

            this._errorHandler.handleSimpleError(
                ErrorCategory.UI_COMPONENT,
                ErrorSeverity.LOW,
                'PinToggleUI initialized with status bar item',
                undefined,
                {
                    initialPinState: this._panelManager.isPinned
                }
            );

        } catch (error) {
            this._errorHandler.handleSimpleError(
                ErrorCategory.UI_COMPONENT,
                ErrorSeverity.CRITICAL,
                'Failed to initialize PinToggleUI',
                error instanceof Error ? error : new Error(String(error)),
                { panelManagerPresent: !!this._panelManager }
            );
            throw error;
        }
    }

    public show(): void {
        if (this._statusBarItem) {
            this._statusBarItem.show();
        }
    }

    public hide(): void {
        if (this._statusBarItem) {
            this._statusBarItem.hide();
        }
    }

    public updateState(isPinned: boolean): void {
        try {
            this.updateStatusBarItem(isPinned);

            this._errorHandler.handleSimpleError(
                ErrorCategory.UI_COMPONENT,
                ErrorSeverity.LOW,
                'Pin state updated in status bar',
                undefined,
                {
                    isPinned,
                    mode: 'status_bar',
                    statusBarVisible: !!this._statusBarItem
                }
            );

            this._uiUpdateFailures = 0; // Reset failure count on success

        } catch (error) {
            this._uiUpdateFailures++;
            this._errorHandler.handleSimpleError(
                ErrorCategory.UI_COMPONENT,
                this._uiUpdateFailures >= this._maxUIUpdateFailures ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
                'Failed to update status bar state',
                error instanceof Error ? error : new Error(String(error)),
                {
                    isPinned,
                    failureCount: this._uiUpdateFailures,
                    statusBarExists: !!this._statusBarItem
                }
            );
        }
    }

    public dispose(): void {
        if (this._statusBarItem) {
            this._statusBarItem.dispose();
            this._statusBarItem = null;
        }

        this._disposables.forEach(disposable => {
            try {
                disposable.dispose();
            } catch (error) {
                console.warn('Error disposing resource:', error);
            }
        });
        this._disposables = [];
    }

    private createStatusBarItem(): void {
        try {
            this._statusBarItem = vscode.window.createStatusBarItem(
                vscode.StatusBarAlignment.Right,
                100 // Priority
            );

            this._statusBarItem.command = 'panelPin.togglePin';
            this._statusBarItem.tooltip = 'Toggle Panel Pin State';
            this.updateStatusBarItem(this._panelManager.isPinned);

            this._statusBarItem.show();

            this._errorHandler.handleSimpleError(
                ErrorCategory.UI_COMPONENT,
                ErrorSeverity.LOW,
                'Status bar item created successfully',
                undefined,
                { command: 'panelPin.togglePin' }
            );

        } catch (error) {
            this._errorHandler.handleSimpleError(
                ErrorCategory.UI_COMPONENT,
                ErrorSeverity.MEDIUM,
                'Failed to create status bar item',
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }

    private updateStatusBarItem(isPinned: boolean): void {
        if (!this._statusBarItem) {
            return;
        }

        if (isPinned) {
            this._statusBarItem.text = '$(pinned) Panel Pinned';
            this._statusBarItem.tooltip = 'Panel is pinned (click to unpin)';
        } else {
            this._statusBarItem.text = '$(pin) Panel Unpinned';
            this._statusBarItem.tooltip = 'Panel is unpinned (click to pin)';
        }
    }

    public getDiagnosticInfo(): Record<string, any> {
        return {
            hasStatusBarItem: !!this._statusBarItem,
            statusBarText: this._statusBarItem?.text,
            statusBarTooltip: this._statusBarItem?.tooltip,
            statusBarCommand: this._statusBarItem?.command,
            uiUpdateFailures: this._uiUpdateFailures,
            maxFailures: this._maxUIUpdateFailures,
            disposablesCount: this._disposables.length
        };
    }

}