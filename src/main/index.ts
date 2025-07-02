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
  console.log('Creating tray icon...');
  
  try {
    // Create a simple 16x16 bitmap icon using Canvas-like approach
    // We'll create a minimal template icon programmatically
    const size = 16;
    const canvas = Buffer.alloc(size * size * 4); // RGBA
    
    // Fill with transparent pixels first
    for (let i = 0; i < canvas.length; i += 4) {
      canvas[i] = 0;     // R
      canvas[i + 1] = 0; // G  
      canvas[i + 2] = 0; // B
      canvas[i + 3] = 0; // A (transparent)
    }
    
    // Draw three horizontal lines (simple menu icon)
    const lines = [4, 7, 10]; // Y positions for lines
    lines.forEach(y => {
      for (let x = 2; x < 14; x++) {
        const pixelIndex = (y * size + x) * 4;
        canvas[pixelIndex] = 0;     // R
        canvas[pixelIndex + 1] = 0; // G
        canvas[pixelIndex + 2] = 0; // B  
        canvas[pixelIndex + 3] = 255; // A (opaque)
      }
    });
    
    const icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
    icon.setTemplateImage(true);
    
    console.log('Icon created, setting up tray...');
    
    // Create the tray instance
    tray = new Tray(icon);
    
    console.log('Tray created successfully');
    
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
        label: 'Open Console (Debug)',
        click: () => {
          console.log('Debug console clicked');
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Quit',
        click: () => {
          console.log('Quit clicked');
          app.quit();
        },
      },
    ]);
    
    // Set the context menu
    tray.setContextMenu(contextMenu);
    
    // Set tooltip
    tray.setToolTip('DryPrompt - AI-powered text automation');
    
    console.log('Tray setup complete - should be visible in menu bar');
    
  } catch (error) {
    console.error('Error creating tray:', error);
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create the tray.
app.on('ready', () => {
  console.log('App ready event fired');
  
  // Hide dock icon on macOS
  if (process.platform === 'darwin') {
    console.log('Hiding dock icon on macOS');
    app.dock.hide();
  }
  
  createTray();
});

// Prevent the app from quitting when all windows are closed
// since we're running as a menu bar app
app.on('window-all-closed', (event: Event) => {
  console.log('Window all closed event - preventing quit');
  event.preventDefault();
});

// Handle app activation (for macOS)
app.on('activate', () => {
  console.log('App activate event');
  // For tray apps, we don't need to recreate windows on activate
});

// Cleanup tray on quit
app.on('before-quit', () => {
  console.log('App before quit - cleaning up tray');
  if (tray) {
    tray.destroy();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
