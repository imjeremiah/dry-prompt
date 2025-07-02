import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import * as appController from './services/app-controller';
import * as trayManager from './services/tray-manager';
import * as monitoringService from './services/monitoring-service';
import * as permissionService from './services/permission-service';
import { createEditDialog, globalCleanupEditDialogHandlers } from './services/edit-dialog-window';

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
 * Shows a test notification
 */
function showTestNotification(): void {
  try {
    const { Notification } = require('electron');
    const testNotification = new Notification({
      title: 'DryPrompt Test',
      body: 'This is a test notification. If you see this, notifications are working!',
      hasReply: false
    });
    testNotification.show();
    console.log('✅ Test notification shown');
  } catch (error) {
    console.error('❌ Test notification failed:', error);
  }
}

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
    addSampleData: async () => {
      console.log('Adding sample data for testing...');
      try {
        await monitoringService.addSampleData();
        console.log('✅ Sample data added');
      } catch (error) {
        console.error('Error adding sample data:', error);
      }
    },
    clearLogAndAddTestData: async () => {
      console.log('Clearing log and adding fresh test data...');
      try {
        const loggingService = await import('./services/logging-service');
        await loggingService.clearLog();
        console.log('✅ Log cleared');
        
        await monitoringService.addSampleData();
        console.log('✅ Fresh test data added');
      } catch (error) {
        console.error('Error clearing and adding test data:', error);
      }
    },
    analyzeNow: async () => {
      console.log('Analyze Now clicked - starting manual analysis');
      try {
        await appController.triggerManualAnalysis();
      } catch (error) {
        console.error('Error triggering manual analysis:', error);
      }
    },
    testNotification: showTestNotification,
    testEditDialog: () => {
      console.log('Test Edit Dialog clicked');
      try {
        const testSuggestion = {
          trigger: ';explaincode',
          replacement: 'Explain the following code:',
          sourceTexts: ['explain this code', 'explain the code', 'what does this code do'],
          confidence: 0.85
        };
        createEditDialog(testSuggestion, {
          onConfirm: (edited) => console.log('Test edit confirmed:', edited),
          onCancel: () => console.log('Test edit cancelled')
        });
      } catch (error) {
        console.error('Error testing edit dialog:', error);
      }
    },
    openConsole: openDebugConsole,
    quit: () => {
      console.log('Quit clicked');
      app.quit();
    },
    requestPermission: requestAccessibilityPermission
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
