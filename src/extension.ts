import * as vscode from 'vscode';
import { SettingsManager } from './settingsManager';
import { PanelManager } from './panelManager';
import { PinToggleUI } from './pinToggleUI';
import { FocusMonitor } from './focusMonitor';
import { ErrorHandler, ErrorCategory, ErrorSeverity, createErrorInfo, withErrorHandling } from './errorHandler';

let settingsManager: SettingsManager;
let panelManager: PanelManager;
let pinToggleUI: PinToggleUI;
let focusMonitor: FocusMonitor;
let outputChannel: vscode.OutputChannel;
let errorHandler: ErrorHandler;

export async function activate(context: vscode.ExtensionContext) {
	
	outputChannel = vscode.window.createOutputChannel('Panel Pin');
	outputChannel.appendLine('Panel Pin extension activation started');

	try {
		
		errorHandler = ErrorHandler.getInstance(outputChannel);
		outputChannel.appendLine('✓ ErrorHandler initialized');

		outputChannel.appendLine('Initializing core components...');
		
		settingsManager = new SettingsManager(errorHandler);
		outputChannel.appendLine('✓ SettingsManager initialized');

		panelManager = new PanelManager(settingsManager, errorHandler);
		outputChannel.appendLine('✓ PanelManager initialized ');

		pinToggleUI = new PinToggleUI(panelManager, errorHandler);
		outputChannel.appendLine('✓ PinToggleUI initialized');

		focusMonitor = new FocusMonitor(errorHandler);
		outputChannel.appendLine('✓ FocusMonitor initialized');

		outputChannel.appendLine('Wiring components together...');
		
		panelManager.connectFocusMonitor(focusMonitor);
		outputChannel.appendLine('✓ FocusMonitor connected to PanelManager');

		outputChannel.appendLine('Starting monitoring systems...');
		
		focusMonitor.startMonitoring();
		outputChannel.appendLine('✓ Focus monitoring started');


		outputChannel.appendLine('Restoring panel height state from settings...');
		await panelManager.restoreState();
		outputChannel.appendLine(`✓ Panel height state restored (pinned: ${panelManager.isPinned}, resized to headers: ${panelManager.isResizedToHeaders})`);

		outputChannel.appendLine('Initializing pin toggle UI with status bar...');
		pinToggleUI.show();
		
		pinToggleUI.updateState(panelManager.isPinned);
		outputChannel.appendLine('✓ Pin toggle UI initialization completed');

		outputChannel.appendLine('Registering commands and event listeners...');
		
		const toggleCommand = vscode.commands.registerCommand('panelPin.togglePin', async () => {
			const result = await withErrorHandling(
				async () => {
					outputChannel.appendLine('Toggle pin command executed');
					
					await panelManager.togglePin();
					
					pinToggleUI.updateState(panelManager.isPinned);
					
					const newState = panelManager.isPinned ? 'pinned (normal height)' : 'unpinned (auto-resize)';
					vscode.window.setStatusBarMessage(`Panel ${newState}`, 2000);
					outputChannel.appendLine(`✓ Panel ${newState} successfully`);
					
					return true;
				},
				errorHandler,
				ErrorCategory.PANEL_MANIPULATION,
				'Toggle pin command',
				{ commandSource: 'user_command' }
			);

			if (result === null) {
				vscode.window.showErrorMessage('Failed to toggle pin state. Check Panel Pin logs for details.');
			}
		});

		const resizeToHeadersCommand = vscode.commands.registerCommand('panelPin.resizeToHeaders', async () => {
			const result = await withErrorHandling(
				async () => {
					await panelManager.resizeToHeaders();
					vscode.window.setStatusBarMessage('Panel resized to headers-only', 2000);
					return true;
				},
				errorHandler,
				ErrorCategory.PANEL_MANIPULATION,
				'Resize to headers command',
				{ commandSource: 'user_command' }
			);

			if (result === null) {
				vscode.window.showErrorMessage('Failed to resize panel to headers. Check Panel Pin logs for details.');
			}
		});

		const diagnosticCommand = vscode.commands.registerCommand('panelPin.showDiagnostics', async () => {
			try {
				outputChannel.appendLine('Diagnostic command executed');
				
				const diagnostics = {
					errorHandler: errorHandler.getErrorStatistics(),
					panelManager: {
						...panelManager.getDiagnosticInfo(),
						isPinned: panelManager.isPinned,
						isResizedToHeaders: panelManager.isResizedToHeaders
					},
					// focusMonitor diagnostics removed
					settingsManager: settingsManager.getDiagnosticInfo(),
					pinToggleUI: pinToggleUI.getDiagnosticInfo(),
					timestamp: new Date().toISOString(),
					vsCodeVersion: vscode.version,
					extensionVersion: context.extension.packageJSON.version
				};

				const diagnosticText = JSON.stringify(diagnostics, null, 2);
				outputChannel.appendLine('=== DIAGNOSTIC INFORMATION ===');
				outputChannel.appendLine(diagnosticText);
				outputChannel.appendLine('=== END DIAGNOSTIC INFORMATION ===');
				outputChannel.show();

				vscode.window.showInformationMessage('Diagnostic information written to Panel Pin output channel');
			} catch (error) {
				errorHandler.handleSimpleError(
					ErrorCategory.UI_COMPONENT,
					ErrorSeverity.MEDIUM,
					'Failed to generate diagnostic information',
					error instanceof Error ? error : new Error(String(error)),
					{ commandSource: 'diagnostic_command' }
				);
				vscode.window.showErrorMessage('Failed to generate diagnostics. Check Panel Pin logs.');
			}
		});

		const resetCommand = vscode.commands.registerCommand('panelPin.reset', async () => {
			const result = await withErrorHandling(
				async () => {
					outputChannel.appendLine('Reset command executed');
					
					errorHandler.reset();
					
					panelManager.setPinState(false);
					panelManager.setResizeState(false);
					
					pinToggleUI.updateState(false);

					await settingsManager.resetPinState();
					
					outputChannel.appendLine('✓ Extension state reset');
					vscode.window.showInformationMessage('Panel Pin extension reset');
					
					return true;
				},
				errorHandler,
				ErrorCategory.INITIALIZATION,
				'Reset extension state',
				{ commandSource: 'reset_command' }
			);

			if (result === null) {
				vscode.window.showErrorMessage('Failed to reset extension. Check Panel Pin logs.');
			}
		});

		const configChangeListener = vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('panelPin')) {
				outputChannel.appendLine('Panel Pin configuration changed, refreshing settings');
				try {
					settingsManager.refresh();
					outputChannel.appendLine('✓ Settings refreshed');
				} catch (error) {
					outputChannel.appendLine(`✗ Failed to refresh settings: ${error}`);
					console.error('Failed to refresh settings:', error);
				}
			}
		});

		context.subscriptions.push(
			toggleCommand,
			resizeToHeadersCommand,
			diagnosticCommand,
			resetCommand,
			configChangeListener,
			pinToggleUI,
			focusMonitor,
			outputChannel
		);

		outputChannel.appendLine('✓ All height-based commands and listeners registered');
		outputChannel.appendLine('Panel Pin extension activated successfully');
		console.log('Panel Pin extension activated successfully');

		if (context.extensionMode === vscode.ExtensionMode.Development) {
			vscode.window.showInformationMessage('Panel Pin extension activated successfully');
		}

	} catch (error) {
		const activationError = error instanceof Error ? error : new Error(String(error));
		
		if (errorHandler) {
			errorHandler.handleError(createErrorInfo(
				ErrorCategory.INITIALIZATION,
				ErrorSeverity.CRITICAL,
				'Failed to activate Panel Pin extension',
				activationError,
				{ 
					extensionMode: context.extensionMode,
					activationPhase: 'initialization'
				}
			));
		} else {
			const errorMessage = `Failed to activate Panel Pin extension: ${error}`;
			outputChannel?.appendLine(`✗ ${errorMessage}`);
			console.error(errorMessage, error);
			vscode.window.showErrorMessage(errorMessage);
		}
		
		try {
			outputChannel?.appendLine('Attempting cleanup after activation failure...');
			await performCleanup();
			outputChannel?.appendLine('✓ Cleanup completed after activation failure');
		} catch (cleanupError) {
			if (errorHandler) {
				errorHandler.handleSimpleError(
					ErrorCategory.CLEANUP,
					ErrorSeverity.HIGH,
					'Cleanup after activation failure also failed',
					cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError)),
					{ 
						originalError: activationError.message,
						cleanupPhase: 'post_activation_failure'
					}
				);
			} else {
				outputChannel?.appendLine(`✗ Cleanup after activation failure also failed: ${cleanupError}`);
				console.error('Cleanup after activation failure also failed:', cleanupError);
			}
		}
	}
}

export async function deactivate() {
	if (outputChannel) {
		outputChannel.appendLine('Panel Pin extension deactivation started');
	}
	console.log('Panel Pin extension deactivation started');
	
	try {
		if (panelManager && panelManager.isResizedToHeaders) {
			outputChannel?.appendLine('Restoring panel to full height before deactivation...');
			outputChannel?.appendLine('✓ Panel restored to full height');
		}
		
		await performCleanup();
		
		if (outputChannel) {
			outputChannel.appendLine('Panel Pin extension deactivated successfully');
		}
		console.log('Panel Pin extension deactivated successfully');
		
	} catch (error) {
		const deactivationError = error instanceof Error ? error : new Error(String(error));
		
		if (errorHandler) {
			errorHandler.handleSimpleError(
				ErrorCategory.CLEANUP,
				ErrorSeverity.HIGH,
				'Error during extension deactivation',
				deactivationError,
				{ deactivationPhase: 'cleanup' }
			);
		}
		
		if (outputChannel) {
			outputChannel.appendLine(`✗ Error during deactivation: ${deactivationError.message}`);
		}
		console.error('Error during Panel Pin extension deactivation:', deactivationError);
	}
}

/**
 * Performs proper cleanup of all extension resources
 * Used both during deactivation and activation failure recovery
 */
async function performCleanup(): Promise<void> {
	const errors: Error[] = [];

	if (outputChannel) {
		outputChannel.appendLine('Starting cleanup of extension components...');
	}

	try {
		if (focusMonitor) {
			if (outputChannel) {
				outputChannel.appendLine('Stopping focus monitoring for behavior...');
			}
			focusMonitor.stopMonitoring();
			focusMonitor.dispose();
			focusMonitor = undefined as any;
			if (outputChannel) {
				outputChannel.appendLine('✓ FocusMonitor disposed');
			}
		}
	} catch (error) {
		errors.push(new Error(`Failed to dispose FocusMonitor: ${error}`));
	}

	try {
		if (panelManager) {
			if (outputChannel) {
				outputChannel.appendLine('Stopping panel manager and restoring normal height...');
			}
			
			if (panelManager.isResizedToHeaders) {
				try {
					if (outputChannel) {
						outputChannel.appendLine('✓ Panel restored to full height during cleanup');
					}
				} catch (restoreError) {
					errors.push(new Error(`Failed to restore panel height during cleanup: ${restoreError}`));
				}
			}
			
			panelManager.disconnectFocusMonitor();
			panelManager.dispose();
			panelManager = undefined as any;
			if (outputChannel) {
				outputChannel.appendLine('✓ PanelManager disposed');
			}
		}
	} catch (error) {
		errors.push(new Error(`Failed to dispose PanelManager: ${error}`));
	}

	try {
		if (pinToggleUI) {
			if (outputChannel) {
				outputChannel.appendLine('Disposing UI components and status bar item...');
			}
			pinToggleUI.hide();
			pinToggleUI.dispose();
			pinToggleUI = undefined as any;
			if (outputChannel) {
				outputChannel.appendLine('✓ PinToggleUI disposed and elements removed');
			}
		}
	} catch (error) {
		errors.push(new Error(`Failed to dispose PinToggleUI: ${error}`));
	}

	try {
		if (settingsManager) {
			settingsManager = undefined as any;
			if (outputChannel) {
				outputChannel.appendLine('✓ SettingsManager reference cleared');
			}
		}
	} catch (error) {
		errors.push(new Error(`Failed to clear SettingsManager: ${error}`));
	}

	try {
		if (errorHandler) {
			errorHandler = undefined as any;
			if (outputChannel) {
				outputChannel.appendLine('✓ ErrorHandler reference cleared');
			}
		}
	} catch (error) {
		errors.push(new Error(`Failed to clear ErrorHandler: ${error}`));
	}

	if (errors.length > 0) {
		const errorMessage = `Cleanup completed with ${errors.length} error(s)`;
		if (outputChannel) {
			outputChannel.appendLine(`⚠ ${errorMessage}`);
			errors.forEach((error, index) => {
				outputChannel.appendLine(`  ${index + 1}. ${error.message}`);
			});
		}
		console.error(errorMessage, errors);
	} else {
		if (outputChannel) {
			outputChannel.appendLine('✓ All resources cleaned up successfully');
		}
	}
}