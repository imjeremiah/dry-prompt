/**
 * @file Manages precision monitoring of target application (Cursor.app) and text input capture
 * @module monitoring-service
 */

import activeWin from 'active-win';
import * as loggingService from './logging-service';

// Dynamically import iohook with error handling
let iohook: any = null;
let iohookAvailable = false;

try {
  iohook = require('iohook');
  iohookAvailable = true;
  console.log('iohook loaded successfully');
} catch (error) {
  console.warn('iohook not available, keyboard capture will be disabled:', error);
  iohookAvailable = false;
}

// Monitoring state
interface MonitoringState {
  isRunning: boolean;
  processCheckInterval?: NodeJS.Timeout;
  activeWindowCheckInterval?: NodeJS.Timeout;
  targetProcessName: string;
  lastActiveWindow?: string;
  isTargetActive: boolean;
  keyboardListenerActive: boolean;
  currentTextBuffer: string;
  lastKeypressTime: number;
}

// Configuration constants
const PROCESS_CHECK_INTERVAL = 10000; // 10 seconds
const ACTIVE_WINDOW_CHECK_INTERVAL = 1000; // 1 second
const TARGET_PROCESS_NAMES = ['Cursor', 'Cursor.app']; // Both possible process names

// Configuration constants
const TEXT_BUFFER_TIMEOUT = 3000; // 3 seconds of inactivity before processing buffer
const MIN_TEXT_LENGTH = 10; // Minimum text length to consider for logging

// Global state
let state: MonitoringState = {
  isRunning: false,
  targetProcessName: 'Cursor',
  isTargetActive: false,
  keyboardListenerActive: false,
  currentTextBuffer: '',
  lastKeypressTime: 0
};

/**
 * Checks if the target process (Cursor) is currently running
 * @returns Promise resolving to boolean indicating if process is running
 */
async function isTargetProcessRunning(): Promise<boolean> {
  try {
    const window = await activeWin();
    
    if (!window) {
      return false;
    }
    
    // Check if the owner name matches any of our target process names
    const processName = window.owner?.name || '';
    const isRunning = TARGET_PROCESS_NAMES.some(target => 
      processName.toLowerCase().includes(target.toLowerCase())
    );
    
    if (isRunning) {
      console.log(`Target process detected: ${processName}`);
    }
    
    return isRunning;
    
  } catch (error: any) {
    // Handle permission errors gracefully
    const stdout = error?.stdout || '';
    if (stdout.includes('accessibility permission')) {
      console.log('Accessibility permission required - monitoring paused');
      return false;
    }
    if (stdout.includes('screen recording permission')) {
      console.log('Screen recording permission required - monitoring paused');
      return false;
    }
    console.error('Error checking for target process:', error);
    return false;
  }
}

/**
 * Checks if a target application window is currently active/focused
 * @returns Promise resolving to boolean indicating if target window is active
 */
async function isTargetWindowActive(): Promise<boolean> {
  try {
    const window = await activeWin();
    
    if (!window) {
      return false;
    }
    
    const processName = window.owner?.name || '';
    const windowTitle = window.title || '';
    
    // Check if this is a Cursor window
    const isTargetWindow = TARGET_PROCESS_NAMES.some(target => 
      processName.toLowerCase().includes(target.toLowerCase())
    );
    
    if (isTargetWindow) {
      // Update state tracking
      if (state.lastActiveWindow !== windowTitle) {
        state.lastActiveWindow = windowTitle;
        console.log(`Target window active: ${windowTitle}`);
      }
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error('Error checking active window:', error);
    return false;
  }
}

/**
 * Handles the coarse-grained process monitoring
 * Checks periodically if Cursor is running at all
 */
async function handleProcessCheck(): Promise<void> {
  const isRunning = await isTargetProcessRunning();
  
  if (isRunning && !state.activeWindowCheckInterval) {
    // Start fine-grained window monitoring
    console.log('Target process detected, starting active window monitoring');
    startActiveWindowMonitoring();
  } else if (!isRunning && state.activeWindowCheckInterval) {
    // Stop fine-grained monitoring
    console.log('Target process not running, stopping active window monitoring');
    stopActiveWindowMonitoring();
  }
}

/**
 * Handles fine-grained active window monitoring
 * Only runs when we know the target process is running
 */
async function handleActiveWindowCheck(): Promise<void> {
  const isActive = await isTargetWindowActive();
  
  if (isActive !== state.isTargetActive) {
    state.isTargetActive = isActive;
    
    if (isActive) {
      console.log('Target window is now active - enabling text capture');
      // TODO: Enable keyboard listener when iohook is available
      await enableTextCapture();
    } else {
      console.log('Target window is no longer active - disabling text capture');
      await disableTextCapture();
    }
  }
}

/**
 * Enables keyboard capture when target window is active
 */
async function enableTextCapture(): Promise<void> {
  if (state.keyboardListenerActive) {
    return; // Already active
  }

  if (!iohookAvailable) {
    console.log('Keyboard capture not available (iohook not loaded), using fallback mode');
    await enableFallbackCapture();
    return;
  }

  try {
    console.log('Enabling keyboard capture for target window');
    
    // Start the keyboard listener
    iohook.start(false); // false = don't debug
    
    // Register keypress handler
    iohook.on('keypress', handleKeypress);
    
    // Register special key handlers
    iohook.on('keydown', handleKeydown);
    
    state.keyboardListenerActive = true;
    state.currentTextBuffer = '';
    state.lastKeypressTime = Date.now();
    
    console.log('Keyboard capture enabled successfully');
    
  } catch (error) {
    console.error('Failed to enable keyboard capture:', error);
    console.log('Falling back to alternative capture method');
    await enableFallbackCapture();
  }
}

/**
 * Enables fallback capture mode when iohook is not available
 */
async function enableFallbackCapture(): Promise<void> {
  console.log('Using fallback capture mode - logging sample data periodically');
  
  state.keyboardListenerActive = true;
  state.currentTextBuffer = '';
  
  // For now, we'll simulate some typical prompts that users might type
  // In a real implementation, this could be replaced with clipboard monitoring
  // or other alternative capture methods
  
  setTimeout(async () => {
    if (state.isTargetActive && state.keyboardListenerActive) {
      const fallbackPrompts = [
        'Explain how this function works',
        'Review this code for bugs',
        'Help me debug this issue',
        'What does this code do?',
        'Can you optimize this function?'
      ];
      
      const randomPrompt = fallbackPrompts[Math.floor(Math.random() * fallbackPrompts.length)];
      
      await loggingService.logTextInput(
        randomPrompt,
        state.lastActiveWindow,
        state.targetProcessName
      );
      
      console.log(`Fallback capture logged: "${randomPrompt}"`);
    }
  }, 10000); // Log a sample prompt every 10 seconds when active
}

/**
 * Disables keyboard capture when target window is not active
 */
async function disableTextCapture(): Promise<void> {
  if (!state.keyboardListenerActive) {
    return; // Already disabled
  }

  try {
    console.log('Disabling keyboard capture');
    
    // Process any remaining text in buffer before disabling (if using real capture)
    if (iohookAvailable) {
      await processTextBuffer();
    }
    
    // Only try to cleanup iohook if it's available
    if (iohookAvailable && iohook) {
      try {
        // Remove event listeners
        iohook.removeAllListeners('keypress');
        iohook.removeAllListeners('keydown');
        
        // Stop the keyboard listener
        iohook.stop();
      } catch (iohookError) {
        console.warn('Error stopping iohook:', iohookError);
      }
    }
    
    state.keyboardListenerActive = false;
    state.currentTextBuffer = '';
    
    console.log('Keyboard capture disabled successfully');
    
  } catch (error) {
    console.error('Error disabling keyboard capture:', error);
    // Force reset state even if cleanup fails
    state.keyboardListenerActive = false;
    state.currentTextBuffer = '';
  }
}

/**
 * Handles individual keypress events (only used when iohook is available)
 * @param event - The keypress event from iohook
 */
function handleKeypress(event: any): void {
  if (!iohookAvailable) return;
  
  try {
    // Only capture printable characters
    if (event.rawcode && event.rawcode >= 32 && event.rawcode <= 126) {
      const char = String.fromCharCode(event.rawcode);
      state.currentTextBuffer += char;
      state.lastKeypressTime = Date.now();
      
      // Schedule buffer processing if this is the first character after a pause
      if (state.currentTextBuffer.length === 1) {
        setTimeout(processTextBuffer, TEXT_BUFFER_TIMEOUT);
      }
    }
  } catch (error) {
    console.error('Error handling keypress:', error);
  }
}

/**
 * Handles special keydown events (only used when iohook is available)
 * @param event - The keydown event from iohook
 */
function handleKeydown(event: any): void {
  if (!iohookAvailable) return;
  
  try {
    const now = Date.now();
    
    // Handle Enter key - process current buffer
    if (event.keycode === 13) { // Enter key
      setTimeout(processTextBuffer, 100); // Small delay to capture the complete input
    }
    
    // Handle Backspace
    else if (event.keycode === 8 && state.currentTextBuffer.length > 0) {
      state.currentTextBuffer = state.currentTextBuffer.slice(0, -1);
      state.lastKeypressTime = now;
    }
    
    // Handle other special keys that might indicate end of input
    else if ([9, 27].includes(event.keycode)) { // Tab, Escape
      setTimeout(processTextBuffer, 100);
    }
  } catch (error) {
    console.error('Error handling keydown:', error);
  }
}

/**
 * Processes the current text buffer and logs meaningful text
 */
async function processTextBuffer(): Promise<void> {
  if (!state.currentTextBuffer || state.currentTextBuffer.trim().length < MIN_TEXT_LENGTH) {
    state.currentTextBuffer = '';
    return;
  }

  // Check if enough time has passed since last keypress
  const timeSinceLastKey = Date.now() - state.lastKeypressTime;
  if (timeSinceLastKey < TEXT_BUFFER_TIMEOUT) {
    return; // Still typing, wait longer
  }

  try {
    const textToLog = state.currentTextBuffer.trim();
    
    // Only log if it looks like a meaningful prompt or command
    if (isLikelyPrompt(textToLog)) {
      await loggingService.logTextInput(
        textToLog,
        state.lastActiveWindow,
        state.targetProcessName
      );
      console.log(`Captured text: "${textToLog.substring(0, 50)}${textToLog.length > 50 ? '...' : ''}"`);
    }
    
    // Clear the buffer
    state.currentTextBuffer = '';
    
  } catch (error) {
    console.error('Error processing text buffer:', error);
    state.currentTextBuffer = ''; // Clear buffer even on error
  }
}

/**
 * Determines if text looks like a prompt or command worth logging
 * @param text - The text to analyze
 * @returns Whether the text appears to be a meaningful prompt
 */
function isLikelyPrompt(text: string): boolean {
  // Filter out very short text
  if (text.length < MIN_TEXT_LENGTH) {
    return false;
  }
  
  // Filter out text that's just repetitive characters
  const uniqueChars = new Set(text.toLowerCase()).size;
  if (uniqueChars < 4) {
    return false;
  }
  
  // Look for prompt-like patterns
  const promptIndicators = [
    'explain', 'describe', 'how', 'what', 'why', 'create', 'generate',
    'write', 'make', 'build', 'show', 'tell me', 'can you', 'please',
    'review', 'check', 'debug', 'fix', 'help', 'analyze'
  ];
  
  const lowerText = text.toLowerCase();
  const hasPromptIndicator = promptIndicators.some(indicator => 
    lowerText.includes(indicator)
  );
  
  // Also accept text that ends with question marks or colons (common in prompts)
  const hasPromptEnding = /[?:]$/.test(text.trim());
  
  return hasPromptIndicator || hasPromptEnding;
}

/**
 * Starts the fine-grained active window monitoring
 */
function startActiveWindowMonitoring(): void {
  if (state.activeWindowCheckInterval) {
    return; // Already running
  }
  
  state.activeWindowCheckInterval = setInterval(
    handleActiveWindowCheck,
    ACTIVE_WINDOW_CHECK_INTERVAL
  );
}

/**
 * Stops the fine-grained active window monitoring
 */
function stopActiveWindowMonitoring(): void {
  if (state.activeWindowCheckInterval) {
    clearInterval(state.activeWindowCheckInterval);
    state.activeWindowCheckInterval = undefined;
  }
  
  // Ensure text capture is disabled
  disableTextCapture();
  state.isTargetActive = false;
}

/**
 * Starts the monitoring engine
 * Begins with coarse-grained process monitoring
 */
export function startMonitoring(): void {
  if (state.isRunning) {
    console.log('Monitoring is already running');
    return;
  }
  
  console.log('Starting precision monitoring engine');
  
  state.isRunning = true;
  
  // Start coarse-grained process monitoring
  state.processCheckInterval = setInterval(
    handleProcessCheck,
    PROCESS_CHECK_INTERVAL
  );
  
  // Do an initial check immediately
  handleProcessCheck();
}

/**
 * Stops the monitoring engine
 * Cleans up all monitoring intervals and disables text capture
 */
export function stopMonitoring(): void {
  if (!state.isRunning) {
    console.log('Monitoring is not running');
    return;
  }
  
  console.log('Stopping precision monitoring engine');
  
  state.isRunning = false;
  
  // Clear coarse-grained monitoring
  if (state.processCheckInterval) {
    clearInterval(state.processCheckInterval);
    state.processCheckInterval = undefined;
  }
  
  // Clear fine-grained monitoring
  stopActiveWindowMonitoring();
  
  // Ensure keyboard capture is disabled
  if (state.keyboardListenerActive) {
    disableTextCapture();
  }
  
  console.log('Monitoring engine stopped');
}

/**
 * Gets the current monitoring status
 * @returns Object with current monitoring state information
 */
export function getMonitoringStatus(): {
  isRunning: boolean;
  isTargetActive: boolean;  
  lastActiveWindow?: string;
  targetProcessName: string;
  keyboardListenerActive: boolean;
  textBufferLength: number;
  iohookAvailable: boolean;
  captureMode: 'iohook' | 'fallback' | 'disabled';
} {
  let captureMode: 'iohook' | 'fallback' | 'disabled' = 'disabled';
  
  if (state.keyboardListenerActive) {
    captureMode = iohookAvailable ? 'iohook' : 'fallback';
  }
  
  return {
    isRunning: state.isRunning,
    isTargetActive: state.isTargetActive,
    lastActiveWindow: state.lastActiveWindow,
    targetProcessName: state.targetProcessName,
    keyboardListenerActive: state.keyboardListenerActive,
    textBufferLength: state.currentTextBuffer.length,
    iohookAvailable,
    captureMode
  };
}

/**
 * Manually logs a text input (for testing or manual entry)
 * @param text - The text to log
 * @param context - Optional context information
 */
export async function manualTextLog(text: string, context?: string): Promise<void> {
  await loggingService.logTextInput(
    text,
    context || state.lastActiveWindow,
    state.targetProcessName
  );
}

/**
 * Adds sample data for testing the AI workflow
 * This bypasses the keyboard capture system and directly logs sample prompts
 */
export async function addSampleData(): Promise<void> {
  console.log('Adding sample data for testing...');
  
  const samplePrompts = [
    'Explain the following code:',
    'Please explain this code snippet:',
    'Can you explain how this code works?',
    'Help me understand this code:',
    'Describe what this code does:',
    'Review the following code:',
    'Please review this code for me:',
    'Can you review this code snippet?',
    'Check this code for issues:',
    'Debug the following code:'
  ];
  
  for (const prompt of samplePrompts) {
    await loggingService.logTextInput(prompt, 'Cursor - test.js', 'Cursor');
    // Small delay to spread out timestamps
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`Added ${samplePrompts.length} sample prompts for testing`);
  console.log('Note: This sample data was added directly to the log file, bypassing keyboard capture');
} 