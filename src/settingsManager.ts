import * as vscode from 'vscode';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from './errorHandler';

export interface PanelPinConfiguration {
    showStatusBarPinButton: boolean;
    showPanelTitlePinButton: boolean;
    titleBarViewIds: string[];
    resizeStepCount: number;
}

export interface LegacyPinStateCleanupResult {
    hadGlobalValue: boolean;
    hadWorkspaceValue: boolean;
    hadWorkspaceFolderValue: boolean;
    errors: string[];
}

export interface DefaultBooleanSettingsMigrationResult {
    migrated: boolean;
    hadExplicitValue: boolean;
    errors: string[];
}

export class SettingsManager {
    private static readonly configurationSection = 'panelPin';
    private static readonly showStatusBarPinButtonKey = 'showStatusBarPinButton';
    private static readonly showPanelTitlePinButtonKey = 'showPanelTitlePinButton';
    private static readonly titleBarViewIdsKey = 'titleBarViewIds';
    private static readonly resizeStepCountKey = 'resizeStepCount';
    private static readonly legacyPinStateKey = 'pinState';
    private static readonly lastPinStateStorageKey = 'panelPin.lastPinState';
    private static readonly legacyCleanupMigrationKey = 'panelPin.legacyPinStateCleanup.v1';
    private static readonly defaultBooleanSettingsMigrationKey = 'panelPin.defaultBooleanSettingsMigration.v1';
    private context: vscode.ExtensionContext;
    private errorHandler: ErrorHandler;
    private settingsFailures: number = 0;
    private maxSettingsFailures: number = 3;

    constructor(context: vscode.ExtensionContext, errorHandler?: ErrorHandler) {
        this.context = context;
        this.errorHandler = errorHandler || ErrorHandler.getInstance();
    }

    public getPinState(): boolean {
        try {
            const lastPinState = this.context.globalState.get<boolean>(SettingsManager.lastPinStateStorageKey);
            return lastPinState ?? false;
        } catch (error) {
            this.errorHandler.handleSimpleError(
                ErrorCategory.SETTINGS_PERSISTENCE,
                ErrorSeverity.MEDIUM,
                'Failed to resolve saved pin state, using unpinned fallback',
                error instanceof Error ? error : new Error(String(error)),
                { fallbackToDefault: true }
            );
            return false;
        }
    }

    public async setPinState(pinned: boolean): Promise<void> {
        try {
            await this.context.globalState.update(SettingsManager.lastPinStateStorageKey, pinned);
            this.settingsFailures = 0; // Reset failure count on success
            return;
        } catch (error) {
            const globalStateError = error instanceof Error ? error : new Error(String(error));
            this.settingsFailures++;

            this.errorHandler.handleSimpleError(
                ErrorCategory.SETTINGS_PERSISTENCE,
                this.settingsFailures >= this.maxSettingsFailures ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
                'Failed to save pin state to extension global state',
                globalStateError,
                {
                    pinState: pinned,
                    failureCount: this.settingsFailures
                }
            );

            throw new Error(`Failed to save pin state: ${globalStateError.message}`);
        }
    }

    public getConfiguration(): PanelPinConfiguration {
        return {
            showStatusBarPinButton: this.getShowStatusBarPinButton(),
            showPanelTitlePinButton: this.getShowPanelTitlePinButton(),
            titleBarViewIds: this.getTitleBarViewIds(),
            resizeStepCount: this.getResizeStepCount()
        };
    }

    public getResizeStepCount(): number {
        const configuration = vscode.workspace.getConfiguration(SettingsManager.configurationSection);
        const configuredStepCount = configuration.get<number>(SettingsManager.resizeStepCountKey, 16);

        if (!Number.isFinite(configuredStepCount)) {
            return 16;
        }

        return Math.max(0, Math.min(50, Math.floor(configuredStepCount)));
    }

    public getShowStatusBarPinButton(): boolean {
        const configuration = vscode.workspace.getConfiguration(SettingsManager.configurationSection);
        return configuration.get<boolean>(SettingsManager.showStatusBarPinButtonKey, true);
    }

    public getShowPanelTitlePinButton(): boolean {
        const configuration = vscode.workspace.getConfiguration(SettingsManager.configurationSection);
        return configuration.get<boolean>(SettingsManager.showPanelTitlePinButtonKey, true);
    }

    public getTitleBarViewIds(): string[] {
        const configuration = vscode.workspace.getConfiguration(SettingsManager.configurationSection);
        const configuredViewIds = configuration.get<string[]>(SettingsManager.titleBarViewIdsKey, [
            'workbench.panel.markers.view',
            'workbench.panel.output',
            'workbench.panel.repl.view',
            '~remote.forwardedPorts',
            'terminal'
        ]);

        return configuredViewIds
            .map(viewId => viewId.trim())
            .filter((viewId, index, viewIds) => viewId.length > 0 && viewIds.indexOf(viewId) === index);
    }

    public refresh(): void {
        // Configuration is retrieved fresh each time, so no caching to refresh
    }

    public async resetPinState(): Promise<void> {
        try {
            await this.context.globalState.update(SettingsManager.lastPinStateStorageKey, undefined);
            return;
        } catch (error) {
            this.errorHandler.handleSimpleError(
                ErrorCategory.SETTINGS_PERSISTENCE,
                ErrorSeverity.HIGH,
                'Failed to reset pin state in extension global state',
                error instanceof Error ? error : new Error(String(error))
            );
            throw error;
        }
    }

    public async migrateDefaultBooleanSettingsOnce(): Promise<DefaultBooleanSettingsMigrationResult | undefined> {
        const alreadyMigrated = this.context.globalState.get<boolean>(SettingsManager.defaultBooleanSettingsMigrationKey, false);
        if (alreadyMigrated) {
            return undefined;
        }

        const showStatusBarInspect = vscode.workspace.getConfiguration(SettingsManager.configurationSection).inspect<boolean>(SettingsManager.showStatusBarPinButtonKey);
        const showPanelTitleInspect = vscode.workspace.getConfiguration(SettingsManager.configurationSection).inspect<boolean>(SettingsManager.showPanelTitlePinButtonKey);

        const hadExplicitValue =
            showStatusBarInspect?.globalValue !== undefined ||
            showStatusBarInspect?.workspaceValue !== undefined ||
            showStatusBarInspect?.workspaceFolderValue !== undefined ||
            showPanelTitleInspect?.globalValue !== undefined ||
            showPanelTitleInspect?.workspaceValue !== undefined ||
            showPanelTitleInspect?.workspaceFolderValue !== undefined;

        const result: DefaultBooleanSettingsMigrationResult = {
            migrated: false,
            hadExplicitValue,
            errors: []
        };

        if (!hadExplicitValue) {
            try {
                const configuration = vscode.workspace.getConfiguration(SettingsManager.configurationSection);
                await configuration.update(SettingsManager.showStatusBarPinButtonKey, true, vscode.ConfigurationTarget.Global);
            } catch (error) {
                result.errors.push(`showStatusBarPinButton: ${error instanceof Error ? error.message : String(error)}`);
            }

            try {
                const configuration = vscode.workspace.getConfiguration(SettingsManager.configurationSection);
                await configuration.update(SettingsManager.showPanelTitlePinButtonKey, true, vscode.ConfigurationTarget.Global);
            } catch (error) {
                result.errors.push(`showPanelTitlePinButton: ${error instanceof Error ? error.message : String(error)}`);
            }

            result.migrated = result.errors.length === 0;
        }

        if (result.migrated || (hadExplicitValue && result.errors.length === 0)) {
            await this.context.globalState.update(SettingsManager.defaultBooleanSettingsMigrationKey, true);
        }

        if (result.errors.length > 0) {
            this.errorHandler.handleSimpleError(
                ErrorCategory.SETTINGS_PERSISTENCE,
                ErrorSeverity.MEDIUM,
                'Default boolean settings migration completed with errors',
                new Error(result.errors.join('; ')),
                {
                    hadExplicitValue,
                    migrated: result.migrated
                }
            );
        }

        return result;
    }

    public async cleanupLegacyPinStateSetting(): Promise<LegacyPinStateCleanupResult> {
        const configuration = vscode.workspace.getConfiguration(SettingsManager.configurationSection);
        const inspected = configuration.inspect<boolean>(SettingsManager.legacyPinStateKey);

        const result: LegacyPinStateCleanupResult = {
            hadGlobalValue: inspected?.globalValue !== undefined,
            hadWorkspaceValue: inspected?.workspaceValue !== undefined,
            hadWorkspaceFolderValue: inspected?.workspaceFolderValue !== undefined,
            errors: []
        };

        if (result.hadGlobalValue) {
            try {
                await configuration.update(SettingsManager.legacyPinStateKey, undefined, vscode.ConfigurationTarget.Global);
            } catch (error) {
                result.errors.push(`global: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        if (result.hadWorkspaceValue) {
            try {
                await configuration.update(SettingsManager.legacyPinStateKey, undefined, vscode.ConfigurationTarget.Workspace);
            } catch (error) {
                result.errors.push(`workspace: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        if (result.hadWorkspaceFolderValue) {
            try {
                await configuration.update(SettingsManager.legacyPinStateKey, undefined, vscode.ConfigurationTarget.WorkspaceFolder);
            } catch (error) {
                result.errors.push(`workspaceFolder: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        if (result.errors.length > 0) {
            this.errorHandler.handleSimpleError(
                ErrorCategory.SETTINGS_PERSISTENCE,
                ErrorSeverity.MEDIUM,
                'Legacy pin state cleanup completed with errors',
                new Error(result.errors.join('; ')),
                {
                    hadGlobalValue: result.hadGlobalValue,
                    hadWorkspaceValue: result.hadWorkspaceValue,
                    hadWorkspaceFolderValue: result.hadWorkspaceFolderValue
                }
            );
        }

        return result;
    }

    public async runSilentLegacyCleanupOnce(): Promise<LegacyPinStateCleanupResult | undefined> {
        const alreadyMigrated = this.context.globalState.get<boolean>(SettingsManager.legacyCleanupMigrationKey, false);
        if (alreadyMigrated) {
            return undefined;
        }

        const result = await this.cleanupLegacyPinStateSetting();

        if (result.errors.length === 0) {
            await this.context.globalState.update(SettingsManager.legacyCleanupMigrationKey, true);
        }

        return result;
    }

    public getDiagnosticInfo(): Record<string, any> {
        const configuration = vscode.workspace.getConfiguration(SettingsManager.configurationSection);
        const legacyPinStateInspect = configuration.inspect<boolean>(SettingsManager.legacyPinStateKey);

        return {
            configurationSection: SettingsManager.configurationSection,
            settingsFailures: this.settingsFailures,
            maxFailures: this.maxSettingsFailures,
            currentConfiguration: this.getConfiguration(),
            hasPersistedLastState: this.context.globalState.get<boolean>(SettingsManager.lastPinStateStorageKey) !== undefined,
            resizeStepCount: this.getResizeStepCount(),
            legacyPinStatePresent: {
                global: legacyPinStateInspect?.globalValue !== undefined,
                workspace: legacyPinStateInspect?.workspaceValue !== undefined,
                workspaceFolder: legacyPinStateInspect?.workspaceFolderValue !== undefined
            },
            hasWorkspace: !!vscode.workspace.workspaceFolders?.length
        };
    }
}