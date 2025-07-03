import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import * as appController from './services/app-controller';
import * as trayManager from './services/tray-manager';
import * as monitoringService from './services/monitoring-service';
import * as permissionService from './services/permission-service';
import { createEditDialog, globalCleanupEditDialogHandlers } from './services/edit-dialog-window';
import { createThreeLineIcon } from './utils/icon-generator';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let configWindow: BrowserWindow | null = null;

/**
 * Creates the configuration window for API key setup
 */
const createConfigWindow = () => {
  // Don't create multiple windows
  if (configWindow && !configWindow.isDestroyed()) {
    configWindow.focus();
    return;
  }

  configWindow = new BrowserWindow({
    width: 500,
    height: 400,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'DryPrompt - Configuration',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the configuration UI
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    configWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    configWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Clean up reference when window is closed
  configWindow.on('closed', () => {
    configWindow = null;
  });

  // Prevent new window creation
  configWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
};

/**
 * Opens the debug console for the config window
 */
function openDebugConsole(): void {
  if (configWindow && !configWindow.isDestroyed()) {
    configWindow.webContents.openDevTools();
  } else {
    console.log('No config window available for console');
  }
}

/**
 * Requests accessibility permission from the user
 */
async function requestAccessibilityPermission(): Promise<void> {
  try {
    await permissionService.requestAccessibilityPermission();
  } catch (error) {
    console.error('Error requesting permissions:', error);
  }
}

/**
 * Sets up IPC handlers for communication with renderer processes
 */
const setupIpcHandlers = () => {
  // Handle API key saving
  ipcMain.handle('save-api-key', async (event, apiKey: string) => {
    try {
      // Use the app controller to handle API key updates
      await appController.handleApiKeyUpdate(apiKey);
      return { success: true, message: 'API key saved successfully' };
    } catch (error) {
      console.error('Failed to save API key:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  });

  // Handle API key retrieval
  ipcMain.handle('get-api-key', async () => {
    try {
      const keychainService = await import('./services/keychain-service');
      return await keychainService.getApiKey();
    } catch (error) {
      console.error('Failed to get API key:', error);
      return null;
    }
  });

  // Handle API key existence check
  ipcMain.handle('check-api-key', async () => {
    try {
      const keychainService = await import('./services/keychain-service');
      return await keychainService.hasApiKey();
    } catch (error) {
      console.error('Failed to check API key:', error);
      return false;
    }
  });
};

/**
 * Initialize the application
 */
async function initializeApplication(): Promise<void> {
  console.log('Initializing DryPrompt application...');

  // Clean up any stale IPC handlers from previous runs
  globalCleanupEditDialogHandlers();

  // Set up IPC handlers
  setupIpcHandlers();

  // Define tray menu callbacks
  const trayCallbacks = {
    openSettings: () => {
      console.log('Settings clicked - opening configuration window');
      createConfigWindow();
    },
    tryDemo: async () => {
      console.log('Try Demo clicked - adding sample data for demonstration...');
      try {
        // First clear any existing log to ensure clean demo
        const loggingService = await import('./services/logging-service');
        await loggingService.clearLog();
        console.log('✅ Log cleared for clean demo');
        
        // Add sample data
        await monitoringService.addSampleData();
        console.log('✅ Demo data added successfully');
      } catch (error) {
        console.error('Error setting up demo:', error);
      }
    },
    runAnalysis: async () => {
      console.log('Run Analysis clicked - starting manual analysis');
      try {
        await appController.triggerManualAnalysis();
      } catch (error) {
        console.error('Error triggering manual analysis:', error);
      }
    },
    openShortcutEditor: () => {
      console.log('Open Shortcut Editor clicked - opening manual creation dialog');
      try {
        // Create an empty suggestion for manual entry
        createEditDialog(null, {
          onConfirm: async (editedSuggestion) => {
            console.log('Manual shortcut created:', editedSuggestion);
            
            // Create the shortcut using AppleScript
            const applescriptService = await import('./services/applescript-service');
            const success = await applescriptService.createShortcutWithWorkingFormat(
              editedSuggestion.trigger,
              editedSuggestion.replacement
            );
            
            // Get the branded icon for notifications
            let icon: Electron.NativeImage;
            try {
              icon = createThreeLineIcon(64);
            } catch (error) {
              console.error('Failed to create notification icon:', error);
              icon = createThreeLineIcon(32); // Fallback to smaller size
            }
            
            if (success) {
              // Show success notification
              const notification = new Notification({
                title: 'DryPrompt - Shortcut Created',
                body: `Shortcut "${editedSuggestion.trigger}" created successfully!`,
                icon, // Use the branded DryPrompt icon
                hasReply: false
              });
              notification.show();
            } else {
              // Show error notification
              const notification = new Notification({
                title: 'DryPrompt - Error',
                body: 'Failed to create shortcut. Please try manually.',
                icon, // Use the branded DryPrompt icon
                hasReply: false
              });
              notification.show();
            }
          },
          onCancel: () => console.log('Manual shortcut creation cancelled')
        });
      } catch (error) {
        console.error('Error opening shortcut editor:', error);
      }
    },
    testShortcutCreation: async () => {
      console.log('Test Shortcut Creation clicked - running comprehensive test');
      try {
        const applescriptService = await import('./services/applescript-service');
        const testResult = await applescriptService.testShortcutCreation();
        
        // Get the branded icon for notifications
        let icon: Electron.NativeImage;
        try {
          icon = createThreeLineIcon(64);
        } catch (error) {
          console.error('Failed to create notification icon:', error);
          icon = createThreeLineIcon(32); // Fallback to smaller size
        }
        
        // Show test results in notification
        if (testResult.success) {
          const notification = new Notification({
            title: 'DryPrompt - Test Successful',
            body: `Shortcut creation working! Method: ${testResult.method}\nCheck System Preferences > Keyboard > Text for test shortcut.`,
            icon,
            hasReply: false
          });
          notification.show();
        } else {
          const notification = new Notification({
            title: 'DryPrompt - Test Failed',
            body: 'Shortcut creation failed. Check console for detailed diagnostics.',
            icon,
            hasReply: false
          });
          notification.show();
        }
        
        // Log detailed diagnostics to console
        console.log('\n🧪 SHORTCUT CREATION TEST RESULTS:');
        testResult.diagnostics.forEach(diagnostic => console.log(diagnostic));
        
      } catch (error) {
        console.error('Error running shortcut creation test:', error);
        
        const icon = createThreeLineIcon(64);
        const notification = new Notification({
          title: 'DryPrompt - Test Error',
          body: 'Error running test. Check console for details.',
          icon,
          hasReply: false
        });
        notification.show();
      }
    },
    debugPlist: async () => {
      console.log('Debug Plist clicked - examining plist structure');
      try {
        const applescriptService = await import('./services/applescript-service');
        const plistDebug = await applescriptService.debugPlistStructure();
        
        // Get the branded icon for notifications
        let icon: Electron.NativeImage;
        try {
          icon = createThreeLineIcon(64);
        } catch (error) {
          console.error('Failed to create notification icon:', error);
          icon = createThreeLineIcon(32); // Fallback to smaller size
        }
        
        // Show summary in notification
        const notification = new Notification({
          title: 'DryPrompt - Plist Debug',
          body: `Array exists: ${plistDebug.hasArray}\nItems: ${plistDebug.itemCount}\nCheck console for details.`,
          icon,
          hasReply: false
        });
        notification.show();
        
        // Log detailed information to console
        console.log('\n🔍 PLIST DEBUG RESULTS:');
        console.log(`Array exists: ${plistDebug.hasArray}`);
        console.log(`Item count: ${plistDebug.itemCount}`);
        
        if (plistDebug.items.length > 0) {
          console.log('\nItems found:');
          plistDebug.items.forEach(item => {
            console.log(`  [${item.index}] replace: "${item.replace}" → with: "${item.with}" (on: ${item.on})`);
            if (item.structure.length < 200) {
              console.log(`    Structure: ${item.structure.replace(/\n/g, ' ')}`);
            }
          });
        } else {
          console.log('No items found in array');
        }
        
        if (plistDebug.rawContent && plistDebug.rawContent !== 'Array does not exist') {
          console.log('\nRaw plist content:');
          console.log(plistDebug.rawContent);
        }
        
      } catch (error) {
        console.error('Error debugging plist:', error);
        
        const icon = createThreeLineIcon(64);
        const notification = new Notification({
          title: 'DryPrompt - Debug Error',
          body: 'Error debugging plist. Check console for details.',
          icon,
          hasReply: false
        });
        notification.show();
      }
    },
    openConsole: openDebugConsole,
    quit: () => {
      console.log('Quit clicked');
      app.quit();
    },
    requestPermission: requestAccessibilityPermission,
    openTextReplacements: async () => {
      console.log('Open Text Replacements clicked - opening System Settings');
      try {
        const applescriptService = await import('./services/applescript-service');
        await applescriptService.openTextReplacementsForManualSetup();
        
        // Get the branded icon for notifications
        let icon: Electron.NativeImage;
        try {
          icon = createThreeLineIcon(64);
        } catch (error) {
          console.error('Failed to create notification icon:', error);
          icon = createThreeLineIcon(32); // Fallback to smaller size
        }
        
        // Show helpful notification
        const notification = new Notification({
          title: 'DryPrompt - Text Replacements',
          body: 'System Settings opened. Click the + button to add your shortcuts manually.',
          icon,
          hasReply: false
        });
        notification.show();
        
      } catch (error) {
        console.error('Error opening Text Replacements:', error);
        
        const icon = createThreeLineIcon(64);
        const notification = new Notification({
          title: 'DryPrompt - Error',
          body: 'Could not open System Settings. Please open manually: System Settings > Keyboard > Text Replacements',
          icon,
          hasReply: false
        });
        notification.show();
      }
    },
    openTextReplacementsOnly: async () => {
      console.log('Text Replacements... clicked - opening System Settings');
      try {
        const applescriptService = await import('./services/applescript-service');
        await applescriptService.openTextReplacementsOnly();
        
        // Get the branded icon for notifications
        let icon: Electron.NativeImage;
        try {
          icon = createThreeLineIcon(64);
        } catch (error) {
          console.error('Failed to create notification icon:', error);
          icon = createThreeLineIcon(32); // Fallback to smaller size
        }
        
        // Show simple notification
        const notification = new Notification({
          title: 'DryPrompt - Text Replacements',
          body: 'System Settings opened. Click + to add text replacements manually.',
          icon,
          hasReply: false
        });
        notification.show();
        
      } catch (error) {
        console.error('Error opening Text Replacements:', error);
        
        const icon = createThreeLineIcon(64);
        const notification = new Notification({
          title: 'DryPrompt - Error',
          body: 'Could not open System Settings. Please open manually.',
          icon,
          hasReply: false
        });
        notification.show();
      }
    }
  };

  // Initialize tray
  const trayCreated = trayManager.initializeTray(trayCallbacks);
  if (!trayCreated) {
    console.error('Failed to create system tray');
    app.quit();
    return;
  }

  // Set up state change listener to update tray
  appController.onStateChange((state) => {
    const status = appController.getDetailedStatus();
    trayManager.updateTray(state, status.isAnalyzing, trayCallbacks);
  });

  // Initialize app controller (this will determine initial state)
  await appController.initializeApp();
  
  console.log('Application initialization complete');
}

// This method will be called when Electron has finished initialization
app.on('ready', async () => {
  console.log('App ready event fired');
  
  // Hide dock icon on macOS
  if (process.platform === 'darwin') {
    console.log('Hiding dock icon on macOS');
    app.dock.hide();
  }
  
  await initializeApplication();
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

// Cleanup on quit
app.on('before-quit', () => {
  console.log('App before quit - cleaning up');
  
  // Clean up app controller (stops all timers and monitoring)
  appController.cleanup();
  
  // Destroy tray
  trayManager.destroyTray();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
