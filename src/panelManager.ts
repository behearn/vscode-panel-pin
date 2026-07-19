import * as vscode from 'vscode';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from './errorHandler';
import { SettingsManager } from './settingsManager';
import { PanelController } from './panelController';

export interface IPanelManager {
    isPinned: boolean;
    isResizedToHeaders: boolean;
    togglePin(): Promise<void>;
    resizeToHeaders(): Promise<void>;
    restoreState(): Promise<void>;
    saveState(): Promise<void>;
    dispose(): void;
}

export interface ExtensionState {
    isPinned: boolean;
    isResizedToHeaders: boolean;
    lastFocusTime: number;
}

export class PanelManager implements IPanelManager {
    private _isPinned: boolean = false;
    private _isResizedToHeaders: boolean = false;
    private _lastFocusTime: number = 0;
    
    private _errorHandler: ErrorHandler;
    private _settingsManager: SettingsManager;
    private _panelController: PanelController;
    private _onPinStateChanged: vscode.EventEmitter<boolean> = new vscode.EventEmitter<boolean>();
    private _onResizeStateChanged: vscode.EventEmitter<boolean> = new vscode.EventEmitter<boolean>();

    public readonly onPinStateChanged: vscode.Event<boolean> = this._onPinStateChanged.event;
    public readonly onResizeStateChanged: vscode.Event<boolean> = this._onResizeStateChanged.event;

    constructor(settingsManager: SettingsManager, errorHandler: ErrorHandler) {
        this._errorHandler = errorHandler;
        this._settingsManager = settingsManager;
        this._panelController = new PanelController(errorHandler);
    }

    public get isPinned(): boolean {
        return this._isPinned;
    }

    public get isResizedToHeaders(): boolean {
        return this._isResizedToHeaders;
    }

    public get isCollapsed(): boolean {
        return this._isResizedToHeaders;
    }

    public getState(): ExtensionState {
        return {
            isPinned: this._isPinned,
            isResizedToHeaders: this._isResizedToHeaders,
            lastFocusTime: this._lastFocusTime
        };
    }

    public async togglePin(): Promise<void> {
        try {
            this._isPinned = !this._isPinned;

            if (this._isPinned) {
                await this._panelController.resizeToFull();
                this._isResizedToHeaders = false;
            } else {
                await this._panelController.resizeToHeaders();                
                this._isResizedToHeaders = true;
            }

            this._onPinStateChanged.fire(this._isPinned);
            await this.saveState();

        } catch (error) {
            this._errorHandler.handleSimpleError(
                ErrorCategory.PANEL_MANIPULATION,
                ErrorSeverity.MEDIUM,
                'Failed to toggle pin state',
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }

    public async resizeToHeaders(): Promise<void> {
        try {
            await this._panelController.resizeToHeaders();
            this._isResizedToHeaders = true;
            this._onResizeStateChanged.fire(true);

        } catch (error) {
            this._errorHandler.handleSimpleError(
                ErrorCategory.PANEL_MANIPULATION,
                ErrorSeverity.MEDIUM,
                'Failed to resize panel to headers',
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }

    public async restoreState(): Promise<void> {
        try {
            const savedPinState = this._settingsManager.getPinState();
            this._isPinned = savedPinState;

            await this._panelController.initialize();

            if (this._isPinned) {
                await this._panelController.resizeToFull();
                this._isResizedToHeaders = false;
            } else {
                await this._panelController.resizeToHeaders();
                this._isResizedToHeaders = true;
            }

            this._onPinStateChanged.fire(this._isPinned);
            this._onResizeStateChanged.fire(this._isResizedToHeaders);

        } catch (error) {
            this._errorHandler.handleSimpleError(
                ErrorCategory.PANEL_MANIPULATION,
                ErrorSeverity.MEDIUM,
                'Failed to restore panel state',
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }

    public async saveState(): Promise<void> {
        try {
            await this._settingsManager.setPinState(this._isPinned);

            if ((this._errorHandler as any).outputChannel) {
                (this._errorHandler as any).outputChannel.appendLine(`[PanelManager] Panel state saved successfully (isPinned=${this._isPinned})`);
            }
        } catch (error) {
            this._errorHandler.handleSimpleError(
                ErrorCategory.PANEL_MANIPULATION,
                ErrorSeverity.LOW,
                'Failed to save panel state',
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }

    public dispose(): void {
        this._panelController.dispose();
        this._onPinStateChanged.dispose();
        this._onResizeStateChanged.dispose();
    }

    public connectFocusMonitor(focusMonitor: any): void {
        focusMonitor.onEditorFocus(() => {
            if (!this._isPinned && !this._isResizedToHeaders) {
                void this.resizeToHeaders();
            }
        });
    }

    public setPinState(pinned: boolean): void {
        this._isPinned = pinned;
        this._onPinStateChanged.fire(this._isPinned);
    }

    public setResizeState(resized: boolean): void {
        this._isResizedToHeaders = resized;
        this._onResizeStateChanged.fire(this._isResizedToHeaders);
    }

    public disconnectFocusMonitor(): void {
        console.log('Focus monitor disconnected');
    }

    public getDiagnosticInfo(): Record<string, any> {
        return {
            isPinned: this._isPinned,
            isResizedToHeaders: this._isResizedToHeaders,
            lastFocusTime: this._lastFocusTime,
            status: 'ENABLED',
            panelController: this._panelController.getDiagnosticInfo()
        };
    }
}