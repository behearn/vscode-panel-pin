import * as vscode from 'vscode';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from './errorHandler';

export class PanelController {
    private _errorHandler: ErrorHandler;
    private _isInitialized: boolean = false;
    private _panelVisible: boolean = true;

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

    public async resizeToHeaders(): Promise<void> {
        if (!this._isInitialized) {
            await this.initialize();
        }
        try {            
            for (let i = 0; i < 25; i++) {
                await vscode.commands.executeCommand('workbench.action.terminal.resizePaneDown');
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        } catch (error) {
            console.log('Error during resize to headers:', error);
            this._errorHandler.handleSimpleError(
                ErrorCategory.PANEL_MANIPULATION,
                ErrorSeverity.MEDIUM,
                'Failed to resize panel to headers',
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }

    public async resizeToFull(): Promise<void> {
        if (!this._isInitialized) {
            await this.initialize();
        }
        try {
            for (let i = 0; i < 5; i++) {
                await vscode.commands.executeCommand('workbench.action.terminal.resizePaneUp');
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        } catch (error) {
            this._errorHandler.handleSimpleError(
                ErrorCategory.PANEL_MANIPULATION,
                ErrorSeverity.MEDIUM,
                'Failed to resize panel to full height',
                error instanceof Error ? error : new Error(String(error))
            );
        }
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
}