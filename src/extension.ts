import * as vscode from 'vscode';
import { HostManager } from './hostManager';
import { HostTreeProvider } from './hostTreeProvider';
import { CommandHandler } from './commandHandler';

/**
 * Called when extension is activated
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('Simple SCP extension activated');

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

  vscode.window.showInformationMessage('Simple SCP is ready');
}

/**
 * Called when extension is deactivated
 */
export function deactivate() {
  console.log('Simple SCP extension deactivated');
}
