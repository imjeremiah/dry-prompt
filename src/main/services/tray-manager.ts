/**
 * @file Tray manager for handling dynamic menu bar icons and context menus
 * @module tray-manager
 */

import { Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { AppState } from './app-controller';

let tray: Tray | null = null;
let currentState: AppState = 'starting';

// Icon cache to avoid reloading
const iconCache = new Map<AppState, Electron.NativeImage>();

/**
 * Loads an icon for a specific state from the assets directory
 * @param state - The application state
 * @returns Native image for the tray
 */
function loadIcon(state: AppState): Electron.NativeImage {
  // Check cache first
  if (iconCache.has(state)) {
    return iconCache.get(state)!;
  }

  try {
    const iconDir = path.join(__dirname, '..', '..', 'renderer', 'assets', 'icons');
    const iconPath = path.join(iconDir, `icon-${state}.raw`);
    
    if (fs.existsSync(iconPath)) {
      const iconBuffer = fs.readFileSync(iconPath);
      const icon = nativeImage.createFromBuffer(iconBuffer, { width: 16, height: 16 });
      icon.setTemplateImage(true); // Make it a template image for proper macOS styling
      
      // Cache the icon
      iconCache.set(state, icon);
      return icon;
    }
  } catch (error) {
    console.error(`Error loading icon for state ${state}:`, error);
  }

  // Fallback: create a simple programmatic icon
  return createFallbackIcon(state);
}

/**
 * Creates a fallback icon programmatically if file loading fails
 * @param state - The application state
 * @returns Native image for the tray
 */
function createFallbackIcon(state: AppState): Electron.NativeImage {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4); // RGBA
  
  // Fill with transparent pixels first
  for (let i = 0; i < canvas.length; i += 4) {
    canvas[i] = 0;     // R
    canvas[i + 1] = 0; // G  
    canvas[i + 2] = 0; // B
    canvas[i + 3] = 0; // A (transparent)
  }
  
  // Simple patterns based on state
  const setPixel = (x: number, y: number, opacity = 255) => {
    if (x >= 0 && x < size && y >= 0 && y < size) {
      const pixelIndex = (y * size + x) * 4;
      canvas[pixelIndex] = 0;     // R
      canvas[pixelIndex + 1] = 0; // G
      canvas[pixelIndex + 2] = 0; // B
      canvas[pixelIndex + 3] = opacity; // A
    }
  };
  
  switch (state) {
    case 'analyzing':
      // Three dots
      [4, 8, 12].forEach(x => {
        setPixel(x, 8);
        setPixel(x - 1, 8, 128);
        setPixel(x + 1, 8, 128);
      });
      break;
      
    case 'error':
      // X pattern
      for (let i = 0; i < 6; i++) {
        setPixel(5 + i, 5 + i);
        setPixel(10 - i, 5 + i);
      }
      break;
      
    default:
      // Three horizontal lines (default)
      [5, 8, 11].forEach(y => {
        for (let x = 3; x < 13; x++) {
          setPixel(x, y);
        }
      });
  }
  
  const icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  icon.setTemplateImage(true);
  
  // Cache the fallback icon
  iconCache.set(state, icon);
  return icon;
}

/**
 * Gets the status text for display in the menu
 * @param state - The application state
 * @param isAnalyzing - Whether analysis is currently running
 * @returns Human-readable status text
 */
function getStatusText(state: AppState, isAnalyzing: boolean): string {
  if (isAnalyzing) return 'Status: Analyzing...';
  
  switch (state) {
    case 'starting': return 'Status: Starting...';
    case 'configuration-needed': return 'Status: Configuration needed';
    case 'permission-needed': return 'Status: Permission required';
    case 'idle': return 'Status: Ready and monitoring';
    case 'analyzing': return 'Status: Analyzing...';
    case 'error': return 'Status: Error occurred';
    default: return 'Status: Unknown';
  }
}

/**
 * Creates the context menu based on current state
 * @param state - Current application state
 * @param isAnalyzing - Whether analysis is currently running
 * @param callbacks - Callback functions for menu actions
 * @returns Menu instance
 */
function createContextMenu(
  state: AppState, 
  isAnalyzing: boolean,
  callbacks: {
    openSettings: () => void;
    addSampleData: () => void;
    clearLogAndAddTestData: () => void;
    analyzeNow: () => void;
    testNotification: () => void;
    testEditDialog: () => void;
    openConsole: () => void;
    quit: () => void;
    requestPermission?: () => void;
  }
): Menu {
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'DryPrompt',
      enabled: false, // Title item
    },
    {
      type: 'separator',
    },
    {
      label: getStatusText(state, isAnalyzing),
      enabled: false,
    },
    {
      type: 'separator',
    },
  ];

  // Settings (always available)
  menuTemplate.push({
    label: 'Settings...',
    click: callbacks.openSettings,
  });

  // Permission request (only when needed)
  if (state === 'permission-needed' && callbacks.requestPermission) {
    menuTemplate.push({
      label: 'Grant Accessibility Permission',
      click: callbacks.requestPermission,
    });
  }

  // Development/testing tools (only when not in error state)
  if (state !== 'error') {
    menuTemplate.push(
      {
        type: 'separator',
      },
      {
        label: 'Add Sample Data (Test)',
        click: callbacks.addSampleData,
        enabled: state === 'idle',
      },
      {
        label: 'Clear Log & Add Test Data',
        click: callbacks.clearLogAndAddTestData,
        enabled: state === 'idle',
      },
      {
        label: 'Analyze Now',
        click: callbacks.analyzeNow,
        enabled: state === 'idle' && !isAnalyzing,
      }
    );
  }

  // Debug tools
  menuTemplate.push(
    {
      type: 'separator',
    },
    {
      label: 'Test Notification',
      click: callbacks.testNotification,
    },
    {
      label: 'Test Edit Dialog',
      click: callbacks.testEditDialog,
      enabled: state === 'idle',
    },
    {
      label: 'Open Console (Debug)',
      click: callbacks.openConsole,
    }
  );

  // Quit
  menuTemplate.push(
    {
      type: 'separator',
    },
    {
      label: 'Quit',
      click: callbacks.quit,
    }
  );

  return Menu.buildFromTemplate(menuTemplate);
}

/**
 * Initializes the system tray
 * @param callbacks - Callback functions for menu actions
 * @returns Whether tray was created successfully
 */
export function initializeTray(callbacks: {
  openSettings: () => void;
  addSampleData: () => void;
  clearLogAndAddTestData: () => void;
  analyzeNow: () => void;
  testNotification: () => void;
  testEditDialog: () => void;
  openConsole: () => void;
  quit: () => void;
  requestPermission?: () => void;
}): boolean {
  if (tray) {
    console.log('Tray already initialized');
    return true;
  }

  try {
    console.log('Creating system tray...');
    
    // Create initial icon for starting state
    const icon = loadIcon('starting');
    tray = new Tray(icon);
    
    // Set initial menu
    const menu = createContextMenu('starting', false, callbacks);
    tray.setContextMenu(menu);
    
    // Set tooltip
    tray.setToolTip('DryPrompt - AI-powered text automation');
    
    console.log('System tray initialized successfully');
    return true;
    
  } catch (error) {
    console.error('Failed to create system tray:', error);
    return false;
  }
}

/**
 * Updates the tray icon and menu based on current state
 * @param state - Current application state
 * @param isAnalyzing - Whether analysis is currently running
 * @param callbacks - Callback functions for menu actions
 */
export function updateTray(
  state: AppState, 
  isAnalyzing: boolean,
  callbacks: {
    openSettings: () => void;
    addSampleData: () => void;
    clearLogAndAddTestData: () => void;
    analyzeNow: () => void;
    testNotification: () => void;
    testEditDialog: () => void;
    openConsole: () => void;
    quit: () => void;
    requestPermission?: () => void;
  }
): void {
  if (!tray) {
    console.warn('Tray not initialized, cannot update');
    return;
  }

  // Only update if state actually changed
  if (currentState === state) {
    return;
  }

  currentState = state;
  
  try {
    // Update icon
    const icon = loadIcon(state);
    tray.setImage(icon);
    
    // Update menu
    const menu = createContextMenu(state, isAnalyzing, callbacks);
    tray.setContextMenu(menu);
    
    // Update tooltip
    const statusText = getStatusText(state, isAnalyzing);
    tray.setToolTip(`DryPrompt - ${statusText.replace('Status: ', '')}`);
    
    console.log(`Tray updated for state: ${state}`);
    
  } catch (error) {
    console.error('Error updating tray:', error);
  }
}

/**
 * Forces a tray menu update even if state hasn't changed (useful for analyzing flag changes)
 * @param state - Current application state
 * @param isAnalyzing - Whether analysis is currently running
 * @param callbacks - Callback functions for menu actions
 */
export function forceUpdateTray(
  state: AppState, 
  isAnalyzing: boolean,
  callbacks: {
    openSettings: () => void;
    addSampleData: () => void;
    clearLogAndAddTestData: () => void;
    analyzeNow: () => void;
    testNotification: () => void;
    testEditDialog: () => void;
    openConsole: () => void;
    quit: () => void;
    requestPermission?: () => void;
  }
): void {
  if (!tray) {
    console.warn('Tray not initialized, cannot update');
    return;
  }

  try {
    // Update menu (analyzing status might have changed)
    const menu = createContextMenu(state, isAnalyzing, callbacks);
    tray.setContextMenu(menu);
    
    // Update tooltip
    const statusText = getStatusText(state, isAnalyzing);
    tray.setToolTip(`DryPrompt - ${statusText.replace('Status: ', '')}`);
    
  } catch (error) {
    console.error('Error force updating tray:', error);
  }
}

/**
 * Cleans up the tray (call on app quit)
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
    console.log('Tray destroyed');
  }
  
  // Clear icon cache
  iconCache.clear();
}

/**
 * Gets the current tray instance (for advanced usage)
 * @returns Current tray instance or null
 */
export function getTray(): Tray | null {
  return tray;
} 