import * as vscode from 'vscode';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from './errorHandler';

export class PanelController {
    private _errorHandler: ErrorHandler;
    private _isInitialized: boolean = false;
    private _panelVisible: boolean = true;
    private _resizeToHeadersPromise: Promise<void> | null = null;
    private _resizeToFullPromise: Promise<void> | null = null;

    constructor(errorHandler?: ErrorHandler) {
        this._errorHandler = errorHandler || ErrorHandler.getInstance();
    }

    public async initialize(): Promise<void> {
        try {
            //await this.ensurePanelVisible();
            this._isInitialized = true;
            
            if ((this._errorHandler as any).outputChannel) {
                (this._errorHandler as any).outputChannel.appendLine('[PanelController] Initialized');
            }
        } catch (error) {
            this._errorHandler.handleSimpleError(
                ErrorCategory.PANEL_MANIPULATION,
                ErrorSeverity.HIGH,
                'Failed to initialize panel controller',
                error instanceof Error ? error : new Error(String(error))
            );
            throw error;
        }
    }

    public async resizeToHeaders(iterations: number = 50): Promise<void> {
        if (!this._isInitialized) {
            await this.initialize();
        }
        if (this._resizeToHeadersPromise) {
            return this._resizeToHeadersPromise;
        }

        this._resizeToHeadersPromise = this.runResizeSequence(
            'workbench.action.increaseViewHeight',
            iterations,
            'headers'
        ).finally(() => {
            this._resizeToHeadersPromise = null;
        });

        return this._resizeToHeadersPromise;
    }

    public async resizeToFull(iterations: number = 5): Promise<void> {
        if (!this._isInitialized) {
            await this.initialize();
        }
        if (this._resizeToFullPromise) {
            return this._resizeToFullPromise;
        }

        this._resizeToFullPromise = this.runResizeSequence(
            'workbench.action.decreaseViewHeight',
            iterations,
            'full height'
        ).finally(() => {
            this._resizeToFullPromise = null;
        });

        return this._resizeToFullPromise;
    }

    public isInitialized(): boolean {
        return this._isInitialized;
    }

    // private async ensurePanelVisible(): Promise<void> {
    //     try {
    //         const terminalBefore = vscode.window.activeTerminal;
            
    //         if (!vscode.window.terminals.length) {
    //             const terminal = vscode.window.createTerminal({
    //                 name: 'Panel Pin Helper',
    //                 hideFromUser: true
    //             });
    //             terminal.dispose(); // Clean up immediately
    //         }
            
    //         await vscode.commands.executeCommand('workbench.action.terminal.toggleTerminal');
    //         await new Promise(resolve => setTimeout(resolve, 100));
            
    //         if (terminalBefore) {
    //             terminalBefore.show();
    //         }
            
    //         this._panelVisible = true;
    //     } catch (error) {
    //         // Fallback: try the generic toggle but only once
    //         try {
    //             await vscode.commands.executeCommand('workbench.action.togglePanel');
    //             this._panelVisible = true;
    //         } catch (fallbackError) {
    //             this._errorHandler.handleSimpleError(
    //                 ErrorCategory.PANEL_MANIPULATION,
    //                 ErrorSeverity.HIGH,
    //                 'Failed to ensure panel visibility',
    //                 fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError))
    //             );
    //             throw fallbackError;
    //         }
    //     }
    // }

    public dispose(): void {
        this._isInitialized = false;
    }

    public getDiagnosticInfo(): Record<string, any> {
        return {
            isInitialized: this._isInitialized,
            panelVisible: this._panelVisible
        };
    }

    private async runResizeSequence(commandId: string, iterations: number, targetLabel: string): Promise<void> {
        try {
            await this.focusPanel(targetLabel);

            for (let i = 0; i < iterations; i++) {
                await vscode.commands.executeCommand(commandId);
            }
        } catch (error) {
            console.log(`Error during resize to ${targetLabel}:`, error);
            this._errorHandler.handleSimpleError(
                ErrorCategory.PANEL_MANIPULATION,
                ErrorSeverity.MEDIUM,
                `Failed to resize panel to ${targetLabel}`,
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }

    private async focusPanel(targetLabel: string): Promise<void> {
        await vscode.commands.executeCommand('workbench.action.focusPanel');
        await new Promise(resolve => setTimeout(resolve, 25));
    }
}