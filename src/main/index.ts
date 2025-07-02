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
  // Create a simple template icon for the menu bar
  // This creates a small 16x16 icon with three horizontal lines
  const iconData = Buffer.from(`
    <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="12" height="1" fill="black"/>
      <rect x="2" y="7" width="8" height="1" fill="black"/>
      <rect x="2" y="10" width="10" height="1" fill="black"/>
    </svg>
  `);
  
  const icon = nativeImage.createFromBuffer(iconData);
  icon.setTemplateImage(true); // This makes it adapt to menu bar appearance
  
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
