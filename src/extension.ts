import * as vscode from 'vscode';
import { HostManager } from './hostManager';
import { HostTreeProvider } from './hostTreeProvider';
import { CommandHandler } from './commandHandler';
import { logger } from './logger';

/**
 * Called when extension is activated
 */
export async function activate(context: vscode.ExtensionContext) {
  logger.info('Extension activated');

  // Initialize host manager
  const hostManager = new HostManager(context);
  await hostManager.initialize();

  // Create TreeView provider
  const treeProvider = new HostTreeProvider(hostManager);
  const treeView = vscode.window.createTreeView('simpleScp.hosts', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  context.subscriptions.push(treeView);

  // Register command handler
  const commandHandler = new CommandHandler(hostManager, treeProvider);
  commandHandler.registerCommands(context);

  logger.info('Extension ready');
}

/**
 * Called when extension is deactivated
 */
export function deactivate() {
  logger.info('Extension deactivated');
}
