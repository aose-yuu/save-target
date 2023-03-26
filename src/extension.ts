import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const getAllPaths = async (workspaceRoot: string): Promise<string[]> => {
  const traverse = async (dir: string) => {
    const files = await fs.promises.readdir(dir);
    const filePaths: string[] = (
      await Promise.all(
        files.map(async (file) => {
          const fullPath = path.join(dir, file);
          const isDirectory = (await fs.promises.lstat(fullPath)).isDirectory();
          return isDirectory
            ? [
                path.relative(workspaceRoot, fullPath),
                ...(await traverse(fullPath)),
              ]
            : path.relative(workspaceRoot, fullPath);
        })
      )
    ).flat();
    return filePaths;
  };
  return traverse(workspaceRoot);
};

const saveFile = async (filePath: string) => {
  const openedDocuments = vscode.workspace.textDocuments;
  const document = await vscode.workspace.openTextDocument(filePath);
  const isOpenDocument = openedDocuments.find((document) => {
    return document.uri.fsPath === filePath;
  });
  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
  });
  await vscode.commands.executeCommand('editor.action.formatDocument');
  await editor.document.save();
  if (!isOpenDocument) {
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  }
};

const saveFilesInDirectory = async (directoryPath: string) => {
  const allPaths = await getAllPaths(directoryPath);
  const filePaths = allPaths.filter((_path: string) => {
    const isDirectory = fs
      .lstatSync(path.join(directoryPath, _path))
      .isDirectory();
    return !isDirectory;
  });
  for (const filePath of filePaths) {
    await saveFile(path.join(directoryPath, filePath));
  }
};

const generateQuickPick = (quickPickItems: any[]) => {
  const quickPick = vscode.window.createQuickPick();
  quickPick.items = quickPickItems;
  quickPick.placeholder = 'Type to search for file or directory';
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = true;

  return quickPick;
};

const selectFileOrDirectory = async (workspaceRoot: string) => {
  const allPaths = await getAllPaths(workspaceRoot);
  const quickPickItems = await Promise.all(
    allPaths.map(async (_path: string) => {
      const fullPath = path.join(workspaceRoot, _path);
      const isDirectory = (await fs.promises.lstat(fullPath)).isDirectory();
      return {
        label: _path,
        fullPath,
        isDirectory,
      };
    })
  );

  const quickPick = generateQuickPick(quickPickItems);

  quickPick.onDidChangeSelection(async ([item]) => {
    if (item) {
      const saveFunction = item.isDirectory ? saveFilesInDirectory : saveFile;
      await saveFunction(item.fullPath);
      quickPick.hide();
    }
  });

  quickPick.onDidHide(() => quickPick.dispose());
  quickPick.show();
};

export const activate = (context: any) => {
  const disposable = vscode.commands.registerCommand(
    'saveTarget.selectFileOrDirectory',
    async () => {
      const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
      await selectFileOrDirectory(workspaceRoot);
    }
  );

  context.subscriptions.push(disposable);
};

export const deactivate = () => {};
