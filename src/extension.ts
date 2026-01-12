import * as vscode from 'vscode';
import { HostManager } from './hostManager';
import { AuthManager } from './authManager';
import { HostTreeProvider } from './hostTreeProvider';
import { CommandHandler } from './commandHandler';
import { logger } from './logger';

/**
 * Called when extension is activated
 */
export async function activate(context: vscode.ExtensionContext) {
  logger.info('=== Extension Activated ===');

  // Initialize host manager (synced via globalState)
  const hostManager = new HostManager(context);
  await hostManager.initialize();

  // Initialize auth manager (local SecretStorage, not synced)
  const authManager = new AuthManager(context);
  logger.info('Auth manager initialized (local storage, not synced)');

  // Create TreeView provider
  const treeProvider = new HostTreeProvider(hostManager, authManager, context.extensionPath);
  const treeView = vscode.window.createTreeView('simpleScp.hosts', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
    canSelectMany: true,
  });

  context.subscriptions.push(treeView);

  // Register command handler
  const commandHandler = new CommandHandler(hostManager, authManager, treeProvider);
  commandHandler.registerCommands(context);

  logger.info('=== Extension Ready ===');
}

/**
 * Called when extension is deactivated
 */
export function deactivate() {
  logger.info('Extension deactivated');
}
