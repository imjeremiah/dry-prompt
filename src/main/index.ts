import { app, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let tray: Tray | null = null;

/**
 * Creates and configures the system tray icon with context menu
 */
const createTray = () => {
  // Load the icon for the menu bar
  const iconPath = path.join(__dirname, '../renderer/assets/icon.svg');
  const icon = nativeImage.createFromPath(iconPath);
  
  // Create the tray instance
  tray = new Tray(icon);
  
  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'DryPrompt',
      enabled: false, // This serves as a title
    },
    {
      type: 'separator',
    },
    {
      label: 'Status: Ready',
      enabled: false,
    },
    {
      type: 'separator',
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);
  
  // Set the context menu
  tray.setContextMenu(contextMenu);
  
  // Set tooltip
  tray.setToolTip('DryPrompt - AI-powered text automation');
};

// This method will be called when Electron has finished
// initialization and is ready to create the tray.
app.on('ready', () => {
  // Hide dock icon on macOS
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
  
  createTray();
});

// Prevent the app from quitting when all windows are closed
// since we're running as a menu bar app
app.on('window-all-closed', (event: Event) => {
  event.preventDefault();
});

// Handle app activation (for macOS)
app.on('activate', () => {
  // For tray apps, we don't need to recreate windows on activate
});

// Cleanup tray on quit
app.on('before-quit', () => {
  if (tray) {
    tray.destroy();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
