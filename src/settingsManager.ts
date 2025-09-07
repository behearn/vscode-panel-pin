import * as vscode from 'vscode';
import { ErrorHandler, ErrorCategory, ErrorSeverity, withErrorHandling } from './errorHandler';

export interface PanelPinConfiguration {
    defaultPinState: boolean;
}

export class SettingsManager {
    private static readonly configurationSection = 'panelPin';
    private static readonly defaultPinStateKey = 'defaultPinState';
    private static readonly pinStateKey = 'pinState';
    private errorHandler: ErrorHandler;
    private settingsFailures: number = 0;
    private maxSettingsFailures: number = 3;

    constructor(errorHandler?: ErrorHandler) {
        this.errorHandler = errorHandler || ErrorHandler.getInstance();
    }

    public getPinState(): boolean {
        try {
            const configuration = vscode.workspace.getConfiguration(SettingsManager.configurationSection);
            const pinState = configuration.get<boolean>(SettingsManager.pinStateKey);
            if (pinState !== undefined) {
                return pinState;
            }
            
            return this.getDefaultPinState();
        } catch (error) {
            this.errorHandler.handleSimpleError(
                ErrorCategory.SETTINGS_PERSISTENCE,
                ErrorSeverity.MEDIUM,
                'Failed to get pin state from settings, using default',
                error instanceof Error ? error : new Error(String(error)),
                { fallbackToDefault: true }
            );
            return false;
        }
    }

    public async setPinState(pinned: boolean): Promise<void> {
        
        const configuration = vscode.workspace.getConfiguration(SettingsManager.configurationSection);
        let workspaceError: Error | undefined;
        let globalError: Error | undefined;

        try {
            await configuration.update(
                SettingsManager.pinStateKey, 
                pinned, 
                vscode.ConfigurationTarget.Workspace
            );
            this.settingsFailures = 0; // Reset failure count on success
            return;
        } catch (error) {
            workspaceError = error instanceof Error ? error : new Error(String(error));
            this.errorHandler.handleSimpleError(
                ErrorCategory.SETTINGS_PERSISTENCE,
                ErrorSeverity.LOW,
                'Failed to save pin state to workspace settings, trying global',
                workspaceError,
                { pinState: pinned, target: 'workspace' }
            );
        }

        try {
            await configuration.update(
                SettingsManager.pinStateKey, 
                pinned, 
                vscode.ConfigurationTarget.Global
            );
            this.settingsFailures = 0; // Reset failure count on success
            return;
        } catch (error) {
            globalError = error instanceof Error ? error : new Error(String(error));
            this.settingsFailures++;
            
            this.errorHandler.handleSimpleError(
                ErrorCategory.SETTINGS_PERSISTENCE,
                this.settingsFailures >= this.maxSettingsFailures ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
                'Failed to save pin state to both workspace and global settings',
                globalError,
                { 
                    pinState: pinned, 
                    workspaceError: workspaceError?.message,
                    globalError: globalError?.message,
                    failureCount: this.settingsFailures
                }
            );
            
            throw new Error(`Failed to save pin state: ${globalError.message}`);
        }
    }

    public getDefaultPinState(): boolean {
        const configuration = vscode.workspace.getConfiguration(SettingsManager.configurationSection);
        return configuration.get<boolean>(SettingsManager.defaultPinStateKey, false);
    }


    public getConfiguration(): PanelPinConfiguration {
        return {
            defaultPinState: this.getDefaultPinState()
        };
    }

    public refresh(): void {
        // Configuration is retrieved fresh each time, so no caching to refresh
    }

    public async resetPinState(): Promise<void> {
        const configuration = vscode.workspace.getConfiguration(SettingsManager.configurationSection);
        let workspaceError: Error | undefined;
        let globalError: Error | undefined;

        try {
            await configuration.update(
                SettingsManager.pinStateKey, 
                undefined, 
                vscode.ConfigurationTarget.Workspace
            );
            return;
        } catch (error) {
            workspaceError = error instanceof Error ? error : new Error(String(error));
            this.errorHandler.handleSimpleError(
                ErrorCategory.SETTINGS_PERSISTENCE,
                ErrorSeverity.LOW,
                'Failed to reset pin state in workspace settings, trying global',
                workspaceError,
                { target: 'workspace' }
            );
        }

        try {
            await configuration.update(
                SettingsManager.pinStateKey, 
                undefined, 
                vscode.ConfigurationTarget.Global
            );
        } catch (error) {
            globalError = error instanceof Error ? error : new Error(String(error));
            this.errorHandler.handleSimpleError(
                ErrorCategory.SETTINGS_PERSISTENCE,
                ErrorSeverity.HIGH,
                'Failed to reset pin state in both workspace and global settings',
                globalError,
                { 
                    workspaceError: workspaceError?.message,
                    globalError: globalError?.message
                }
            );
            throw new Error(`Failed to reset pin state: ${globalError.message}`);
        }
    }

    public getDiagnosticInfo(): Record<string, any> {
        return {
            configurationSection: SettingsManager.configurationSection,
            settingsFailures: this.settingsFailures,
            maxFailures: this.maxSettingsFailures,
            currentConfiguration: this.getConfiguration(),
            hasWorkspace: !!vscode.workspace.workspaceFolders?.length
        };
    }
}