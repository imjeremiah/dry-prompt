/**
 * @file Permission service for managing macOS system permissions
 * @module permission-service
 */

import { systemPreferences, shell } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Checks if the app has Accessibility permissions
 * @returns Promise resolving to boolean indicating permission status
 */
export async function hasAccessibilityPermission(): Promise<boolean> {
  try {
    // Use Electron's built-in method first
    const trusted = systemPreferences.isTrustedAccessibilityClient(false);
    
    if (trusted) {
      console.log('Accessibility permission: GRANTED');
      return true;
    }
    
    console.log('Accessibility permission: DENIED');
    return false;
    
  } catch (error) {
    console.error('Error checking accessibility permission:', error);
    return false;
  }
}

/**
 * Requests Accessibility permissions and guides user to system settings
 * @returns Promise resolving to boolean indicating if permission was granted
 */
export async function requestAccessibilityPermission(): Promise<boolean> {
  try {
    console.log('Requesting Accessibility permission...');
    
    // This will show the system dialog if permission hasn't been granted
    const trusted = systemPreferences.isTrustedAccessibilityClient(true);
    
    if (trusted) {
      console.log('Accessibility permission already granted');
      return true;
    }
    
    // If not trusted, guide user to system settings
    console.log('Opening System Preferences for Accessibility settings');
    await openAccessibilitySettings();
    
    return false; // Permission not granted yet, user needs to enable it manually
    
  } catch (error) {
    console.error('Error requesting accessibility permission:', error);
    return false;
  }
}

/**
 * Opens macOS System Preferences to the Security & Privacy > Accessibility section
 * @returns Promise resolving when System Preferences is opened
 */
export async function openAccessibilitySettings(): Promise<void> {
  try {
    // Use the direct URL scheme to open the specific preference pane
    await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
    console.log('Opened Accessibility settings in System Preferences');
  } catch (error) {
    console.error('Error opening Accessibility settings:', error);
    
    // Fallback: try using osascript
    try {
      const script = `
        tell application "System Preferences"
          activate
          reveal pane "Security & Privacy"
        end tell
        
        tell application "System Events"
          tell process "System Preferences"
            try
              click button "Privacy" of tab group 1 of window 1
              delay 0.5
              select row 1 of table 1 of scroll area 1 of group 1 of tab group 1 of window 1 where value of static text 1 of UI element 1 is "Accessibility"
            on error
              -- Accessibility row might not be visible or selectable
            end try
          end tell
        end tell
      `;
      
      await execAsync(`osascript -e '${script}'`);
      console.log('Opened System Preferences via AppleScript fallback');
    } catch (fallbackError) {
      console.error('Fallback method also failed:', fallbackError);
      throw new Error('Could not open System Preferences');
    }
  }
}

/**
 * Periodically checks for permission changes
 * @param callback - Function to call when permission status changes
 * @param intervalMs - Check interval in milliseconds (default: 2 seconds)
 * @returns Function to stop checking
 */
export function monitorPermissionChanges(
  callback: (hasPermission: boolean) => void,
  intervalMs: number = 2000
): () => void {
  let lastPermissionState: boolean | null = null;
  
  const checkPermission = async () => {
    try {
      const currentState = await hasAccessibilityPermission();
      
      if (lastPermissionState !== null && lastPermissionState !== currentState) {
        console.log(`Permission state changed: ${lastPermissionState} -> ${currentState}`);
        callback(currentState);
      }
      
      lastPermissionState = currentState;
    } catch (error) {
      console.error('Error monitoring permission changes:', error);
    }
  };
  
  // Initial check
  checkPermission();
  
  // Set up periodic checking
  const interval = setInterval(checkPermission, intervalMs);
  
  // Return cleanup function
  return () => {
    clearInterval(interval);
    console.log('Stopped monitoring permission changes');
  };
}

/**
 * Gets permission status with detailed information
 * @returns Promise resolving to detailed permission status
 */
export async function getPermissionStatus(): Promise<{
  hasPermission: boolean;
  isSupported: boolean;
  platformVersion: string;
}> {
  try {
    const hasPermission = await hasAccessibilityPermission();
    const isSupported = process.platform === 'darwin';
    const platformVersion = process.platform === 'darwin' ? 
      await getMacOSVersion() : 'N/A';
    
    return {
      hasPermission,
      isSupported,
      platformVersion
    };
  } catch (error) {
    console.error('Error getting permission status:', error);
    return {
      hasPermission: false,
      isSupported: false,
      platformVersion: 'Unknown'
    };
  }
}

/**
 * Gets the macOS version
 * @returns Promise resolving to macOS version string
 */
async function getMacOSVersion(): Promise<string> {
  try {
    const { stdout } = await execAsync('sw_vers -productVersion');
    return stdout.trim();
  } catch (error) {
    console.error('Error getting macOS version:', error);
    return 'Unknown';
  }
} 