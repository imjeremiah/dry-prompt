import { app, Tray, Menu, nativeImage, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import * as keychainService from './services/keychain-service';
import * as monitoringService from './services/monitoring-service';
import * as notificationService from './services/notification-service';
import * as permissionService from './services/permission-service';
import { runAnalysisWorkflow } from './workflow/ai-workflow';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let tray: Tray | null = null;
let configWindow: BrowserWindow | null = null;
let permissionMonitor: (() => void) | null = null;

/**
 * Triggers manual analysis workflow
 */
async function triggerManualAnalysis(): Promise<void> {
  try {
    console.log('Starting manual AI analysis...');
    updateTrayStatus('Analyzing...');
    
    const result = await runAnalysisWorkflow();
    
    if (result.suggestions && result.suggestions.length > 0) {
      console.log(`Analysis complete: ${result.suggestions.length} suggestions generated`);
      updateTrayStatus(`Ready (${result.suggestions.length} suggestions)`);
      
      // Show analysis complete notification
      notificationService.showAnalysisCompleteNotification(result.suggestions.length);
      
      // Show individual suggestion notifications with user action callbacks
      await notificationService.showMultipleSuggestions(
        result.suggestions,
        {
          onAccepted: (suggestion) => {
            console.log(`User accepted suggestion: ${suggestion.trigger}`);
            updateTrayStatus('Ready (shortcut created)');
          },
          onRejected: (suggestion) => {
            console.log(`User rejected suggestion: ${suggestion.trigger}`);
          }
        }
      );
    } else {
      console.log('Analysis complete: No suggestions generated');
      updateTrayStatus('Ready (no suggestions)');
      
      // Show analysis complete notification even with no suggestions
      notificationService.showAnalysisCompleteNotification(0);
    }
  } catch (error) {
    console.error('Manual analysis failed:', error);
    updateTrayStatus('Error');
  }
}

/**
 * Updates the tray menu status label by rebuilding the context menu
 * @param status - The status text to display
 */
function updateTrayStatus(status: string): void {
  if (!tray) return;
  
  // Rebuild the entire context menu with the new status
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'DryPrompt',
      enabled: false, // This serves as a title
    },
    {
      type: 'separator',
    },
    {
      label: `Status: ${status}`,
      enabled: false,
    },
    {
      type: 'separator',
    },
    {
      label: 'Settings...',
      click: () => {
        console.log('Settings clicked - opening configuration window');
        createConfigWindow();
      },
    },
    {
      label: 'Grant Permissions...',
      click: async () => {
        console.log('Grant Permissions clicked');
        try {
          const hasPermission = await permissionService.hasAccessibilityPermission();
          if (hasPermission) {
            updateTrayStatus('Permissions already granted');
          } else {
            await permissionService.requestAccessibilityPermission();
            updateTrayStatus('Check System Preferences');
          }
        } catch (error) {
          console.error('Error requesting permissions:', error);
          updateTrayStatus('Permission error');
        }
      },
      visible: status.includes('Permission') || status.includes('Error')
    },
    {
      label: 'Add Sample Data (Test)',
      click: async () => {
        console.log('Adding sample data for testing...');
        await monitoringService.addSampleData();
        updateTrayStatus('Sample data added');
      },
    },
    {
      label: 'Check Monitoring Status',
      click: () => {
        const status = monitoringService.getMonitoringStatus();
        console.log('Current monitoring status:', status);
        
        let statusMsg = 'Status checked';
        if (status.isRunning) {
          statusMsg = `Active (${status.captureMode} mode)`;
        } else {
          statusMsg = 'Monitoring stopped';
        }
        updateTrayStatus(statusMsg);
      },
    },
    {
      label: 'Analyze Now',
      click: async () => {
        console.log('Analyze Now clicked - starting manual analysis');
        await triggerManualAnalysis();
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Open Console (Debug)',
      click: () => {
        console.log('Debug console clicked');
        if (configWindow && !configWindow.isDestroyed()) {
          configWindow.webContents.openDevTools();
        }
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
  
  tray.setContextMenu(contextMenu);
}

/**
 * Initializes monitoring and checks for API key and permissions
 */
async function initializeApp(): Promise<void> {
  try {
    // Check if API key is configured
    const hasApiKey = await keychainService.hasApiKey();
    
    if (!hasApiKey) {
      console.log('No API key found, please configure in settings');
      updateTrayStatus('Configuration needed');
      return;
    }
    
    // Check for Accessibility permissions
    const hasPermission = await permissionService.hasAccessibilityPermission();
    
    if (!hasPermission) {
      console.log('Accessibility permission required');
      updateTrayStatus('Permission needed');
      
      // Start monitoring permission changes
      startPermissionMonitoring();
      return;
    }
    
    // Both API key and permissions are available, start monitoring
    console.log('API key and permissions found, starting monitoring...');
    monitoringService.startMonitoring();
    updateTrayStatus('Monitoring active');
    
    // Show monitoring started notification with capture mode
    const status = monitoringService.getMonitoringStatus();
    notificationService.showMonitoringStartedNotification(status.captureMode);
    
  } catch (error) {
    console.error('Error initializing app:', error);
    updateTrayStatus('Error');
  }
}

/**
 * Starts monitoring for permission changes
 */
function startPermissionMonitoring(): void {
  if (permissionMonitor) {
    return; // Already monitoring
  }
  
  console.log('Starting permission monitoring...');
  
  permissionMonitor = permissionService.monitorPermissionChanges(async (hasPermission) => {
    if (hasPermission) {
      console.log('Accessibility permission granted, starting monitoring');
      
      // Check if we also have API key
      const hasApiKey = await keychainService.hasApiKey();
      
             if (hasApiKey) {
         monitoringService.startMonitoring();
         updateTrayStatus('Monitoring active');
         
         const status = monitoringService.getMonitoringStatus();
         notificationService.showMonitoringStartedNotification(status.captureMode);
       } else {
         updateTrayStatus('Configuration needed');
       }
      
      // Stop permission monitoring
      stopPermissionMonitoring();
    }
  });
}

/**
 * Stops monitoring for permission changes
 */
function stopPermissionMonitoring(): void {
  if (permissionMonitor) {
    permissionMonitor();
    permissionMonitor = null;
    console.log('Stopped permission monitoring');
  }
}

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
        label: 'Status: Starting...',
        enabled: false,
      },
      {
        type: 'separator',
      },
      {
        label: 'Settings...',
        click: () => {
          console.log('Settings clicked - opening configuration window');
          createConfigWindow();
        },
      },
      {
        label: 'Add Sample Data (Test)',
        click: async () => {
          console.log('Adding sample data for testing...');
          await monitoringService.addSampleData();
          updateTrayStatus('Sample data added');
        },
      },
      {
        label: 'Analyze Now',
        click: async () => {
          console.log('Analyze Now clicked - starting manual analysis');
          await triggerManualAnalysis();
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Open Console (Debug)',
        click: () => {
          console.log('Debug console clicked');
          if (configWindow && !configWindow.isDestroyed()) {
            configWindow.webContents.openDevTools();
          }
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

/**
 * Sets up IPC handlers for communication with renderer processes
 */
const setupIpcHandlers = () => {
  // Handle API key saving
  ipcMain.handle('save-api-key', async (event, apiKey: string) => {
    try {
      await keychainService.saveApiKey(apiKey);
      
      // Check permissions before starting monitoring
      const hasPermission = await permissionService.hasAccessibilityPermission();
      
      if (hasPermission) {
        // Start monitoring now that we have both API key and permissions
        console.log('API key saved, starting monitoring...');
        monitoringService.startMonitoring();
        updateTrayStatus('Monitoring active');
        
        // Show monitoring started notification with capture mode
        const status = monitoringService.getMonitoringStatus();
        notificationService.showMonitoringStartedNotification(status.captureMode);
      } else {
        console.log('API key saved, but Accessibility permission needed');
        updateTrayStatus('Permission needed');
        
        // Start monitoring for permission changes
        startPermissionMonitoring();
        
        // Request permission
        await permissionService.requestAccessibilityPermission();
      }
      
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
      return await keychainService.getApiKey();
    } catch (error) {
      console.error('Failed to get API key:', error);
      return null;
    }
  });

  // Handle API key existence check
  ipcMain.handle('check-api-key', async () => {
    try {
      return await keychainService.hasApiKey();
    } catch (error) {
      console.error('Failed to check API key:', error);
      return false;
    }
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create the tray.
app.on('ready', async () => {
  console.log('App ready event fired');
  
  // Hide dock icon on macOS
  if (process.platform === 'darwin') {
    console.log('Hiding dock icon on macOS');
    app.dock.hide();
  }
  
  // Set up IPC handlers
  setupIpcHandlers();
  
  createTray();
  
  // Initialize the app (check API key, start monitoring)
  await initializeApp();
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
  console.log('App before quit - cleaning up');
  
  // Stop monitoring
  monitoringService.stopMonitoring();
  
  // Stop permission monitoring
  stopPermissionMonitoring();
  
  // Cleanup tray
  if (tray) {
    tray.destroy();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
