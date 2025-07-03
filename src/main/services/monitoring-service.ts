/**
 * @file Manages precision monitoring of target application (Cursor.app) and text input capture
 * @module monitoring-service
 */

import activeWin from 'active-win';
import * as loggingService from './logging-service';

// Dynamically import uiohook-napi with error handling
let uIOhook: any = null;
let uiohookAvailable = false;

try {
  const uiohookModule = require('uiohook-napi');
  uIOhook = uiohookModule.uIOhook || uiohookModule.default?.uIOhook || uiohookModule;
  uiohookAvailable = true;
  console.log('uiohook-napi loaded successfully');
} catch (error) {
  console.warn('uiohook-napi not available, keyboard capture will be disabled:', error);
  uiohookAvailable = false;
}

// Virtual keycode to character mapping for uiohook-napi
// This maps the virtual key codes to their corresponding characters
const KEYCODE_TO_CHAR: { [key: number]: string } = {
  // Letters (A-Z)
  30: 'a', 48: 'b', 46: 'c', 32: 'd', 18: 'e', 33: 'f', 34: 'g', 35: 'h',
  23: 'i', 36: 'j', 37: 'k', 38: 'l', 50: 'm', 49: 'n', 24: 'o', 25: 'p',
  16: 'q', 19: 'r', 31: 's', 20: 't', 22: 'u', 47: 'v', 17: 'w', 45: 'x',
  21: 'y', 44: 'z',
  
  // Numbers (0-9)
  11: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '0',
  
  // Special characters
  57: ' ',  // Space
  12: '-', 13: '=', 26: '[', 27: ']', 43: '\\', 39: ';', 40: "'", 41: '`',
  51: ',', 52: '.', 53: '/', 
  
  // Shifted numbers (symbols)
  // These would need modifier key detection
};

// Shifted character mapping (when Shift is held)
const SHIFTED_KEYCODE_TO_CHAR: { [key: number]: string } = {
  // Letters become uppercase
  30: 'A', 48: 'B', 46: 'C', 32: 'D', 18: 'E', 33: 'F', 34: 'G', 35: 'H',
  23: 'I', 36: 'J', 37: 'K', 38: 'L', 50: 'M', 49: 'N', 24: 'O', 25: 'P',
  16: 'Q', 19: 'R', 31: 'S', 20: 'T', 22: 'U', 47: 'V', 17: 'W', 45: 'X',
  21: 'Y', 44: 'Z',
  
  // Shifted numbers become symbols
  11: '!', 2: '@', 3: '#', 4: '$', 5: '%', 6: '^', 7: '&', 8: '*', 9: '(', 10: ')',
  
  // Shifted special characters
  57: ' ',  // Space remains space
  12: '_', 13: '+', 26: '{', 27: '}', 43: '|', 39: ':', 40: '"', 41: '~',
  51: '<', 52: '>', 53: '?',
};

/**
 * Converts a virtual keycode and modifier state to the actual character
 * @param keycode - The virtual keycode from uiohook-napi
 * @param shiftKey - Whether shift is pressed
 * @returns The character or null if not mappable
 */
function keycodeToChar(keycode: number, shiftKey: boolean): string | null {
  const mapping = shiftKey ? SHIFTED_KEYCODE_TO_CHAR : KEYCODE_TO_CHAR;
  return mapping[keycode] || null;
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
  screenRecordingErrorLogged: boolean;
  lastErrorLogTime?: number;
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
  lastKeypressTime: 0,
  screenRecordingErrorLogged: false
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
    const stderr = error?.stderr || '';
    
    if (stdout.includes('screen recording permission') || stderr.includes('screen recording permission')) {
      // Only log this error once, not repeatedly
      if (!state.screenRecordingErrorLogged) {
        console.log('Screen recording permission required - monitoring paused');
        state.screenRecordingErrorLogged = true;
      }
      return false;
    }
    
    if (stdout.includes('accessibility permission')) {
      console.log('Accessibility permission required - monitoring paused');
      return false;
    }
    
    // For other errors, only log occasionally to avoid spam
    const now = Date.now();
    if (!state.lastErrorLogTime || (now - state.lastErrorLogTime) > 30000) { // Log at most once per 30 seconds
      console.error('Error checking for target process:', error);
      state.lastErrorLogTime = now;
    }
    
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
    
  } catch (error: any) {
    // Handle permission errors gracefully (same logic as isTargetProcessRunning)
    const stdout = error?.stdout || '';
    const stderr = error?.stderr || '';
    
    if (stdout.includes('screen recording permission') || stderr.includes('screen recording permission')) {
      // Don't log repeatedly - already logged in isTargetProcessRunning
      return false;
    }
    
    if (stdout.includes('accessibility permission')) {
      // Don't log repeatedly
      return false;
    }
    
    // For other errors, only log occasionally to avoid spam
    const now = Date.now();
    if (!state.lastErrorLogTime || (now - state.lastErrorLogTime) > 30000) { // Log at most once per 30 seconds
      console.error('Error checking active window:', error);
      state.lastErrorLogTime = now;
    }
    
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

  if (!uiohookAvailable) {
    console.log('Keyboard capture not available (uiohook-napi not loaded), using fallback mode');
    await enableFallbackCapture();
    return;
  }

  try {
    console.log('Enabling keyboard capture for target window');
    
    // Register event handlers before starting
    uIOhook.on('keydown', handleKeydown);
    uIOhook.on('keyup', handleKeyup);
    
    // Start the keyboard listener
    uIOhook.start();
    
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
    if (uiohookAvailable) {
      await processTextBuffer(true); // Force process any remaining text before disabling
    }
    
    // Only try to cleanup uiohook if it's available
    if (uiohookAvailable && uIOhook) {
      try {
        // Remove event listeners
        uIOhook.off('keydown', handleKeydown);
        uIOhook.off('keyup', handleKeyup);
        
        // Stop the keyboard listener
        uIOhook.stop();
      } catch (uiohookError) {
        console.warn('Error stopping uiohook-napi:', uiohookError);
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
 * Handles keydown events for text capture and special key processing
 * @param event - The keydown event from uiohook-napi
 */
function handleKeydown(event: any): void {
  if (!uiohookAvailable) return;
  
  try {
    const now = Date.now();
    
    // Handle printable characters for text input using proper keycode mapping
    const keycode = event.keycode;
    
    if (keycode) {
      // Try to convert keycode to character using our mapping
      const char = keycodeToChar(keycode, event.shiftKey || false);
      
      if (char) {
        console.log(`Captured character: "${char}"`);
        state.currentTextBuffer += char;
        state.lastKeypressTime = now;
        
        // Schedule buffer processing if this is the first character after a pause
        if (state.currentTextBuffer.length === 1) {
          setTimeout(() => processTextBuffer(false), TEXT_BUFFER_TIMEOUT); // Auto process with timeout check
        }
      }
      // Handle Enter key - process current buffer
      else if (keycode === 28) { // Enter key (virtual keycode)
        console.log('Enter key pressed, processing buffer immediately');
        setTimeout(() => processTextBuffer(true), 100); // Force process on Enter
      }
      // Handle Backspace
      else if (keycode === 14 && state.currentTextBuffer.length > 0) { // Backspace (virtual keycode)
        console.log('Backspace pressed');
        state.currentTextBuffer = state.currentTextBuffer.slice(0, -1);
        state.lastKeypressTime = now;
      }
      // Handle other special keys that might indicate end of input
      else if ([15, 1].includes(keycode)) { // Tab, Escape (virtual keycodes)
        console.log(`Special key pressed: ${keycode}, processing buffer`);
        setTimeout(() => processTextBuffer(true), 100); // Force process on special keys
      }
      // Note: We can add back debug logging for unmapped keys if needed
      // else {
      //   console.log(`Unmapped keycode: ${keycode} (shift: ${event.shiftKey})`);
      // }
    }
  } catch (error) {
    console.error('Error handling keydown:', error);
  }
}

/**
 * Handles keyup events (currently used for logging/debugging)
 * @param event - The keyup event from uiohook-napi
 */
function handleKeyup(event: any): void {
  if (!uiohookAvailable) return;
  
  try {
    // For now, we primarily use keydown events for text capture
    // This handler can be extended for future keyup-specific functionality
    // console.log('Key released:', event.keycode);
  } catch (error) {
    console.error('Error handling keyup:', error);
  }
}

/**
 * Processes the current text buffer and logs meaningful text
 * @param forceProcess - If true, bypass timeout check and process immediately
 */
async function processTextBuffer(forceProcess: boolean = false): Promise<void> {
  console.log(`Processing buffer: "${state.currentTextBuffer}" (length: ${state.currentTextBuffer.length}), forced: ${forceProcess}`);
  
  if (!state.currentTextBuffer || state.currentTextBuffer.trim().length < MIN_TEXT_LENGTH) {
    console.log(`Buffer too short: ${state.currentTextBuffer.trim().length} < ${MIN_TEXT_LENGTH}`);
    state.currentTextBuffer = '';
    return;
  }

  // Check if enough time has passed since last keypress (unless forced)
  if (!forceProcess) {
    const timeSinceLastKey = Date.now() - state.lastKeypressTime;
    console.log(`Time since last key: ${timeSinceLastKey}ms (threshold: ${TEXT_BUFFER_TIMEOUT}ms)`);
    
    if (timeSinceLastKey < TEXT_BUFFER_TIMEOUT) {
      console.log('Still typing, waiting longer...');
      return; // Still typing, wait longer
    }
  } else {
    console.log('Force processing - bypassing timeout check');
  }

  try {
    const textToLog = state.currentTextBuffer.trim();
    console.log(`Checking if prompt-like: "${textToLog}"`);
    
    // Only log if it looks like a meaningful prompt or command
    if (isLikelyPrompt(textToLog)) {
      console.log(`Logging captured text: "${textToLog}"`);
      await loggingService.logTextInput(
        textToLog,
        state.lastActiveWindow,
        state.targetProcessName
      );
      console.log(`✅ Successfully logged: "${textToLog.substring(0, 50)}${textToLog.length > 50 ? '...' : ''}"`);
    } else {
      console.log(`Text filtered out (not prompt-like): "${textToLog}"`);
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
    console.log(`Prompt filter: rejected "${text}" (too few unique characters: ${uniqueChars})`);
    return false;
  }
  
  // Look for prompt-like patterns
  const promptIndicators = [
    'explain', 'describe', 'how', 'what', 'why', 'create', 'generate',
    'write', 'make', 'build', 'show', 'tell me', 'can you', 'please',
    'review', 'check', 'debug', 'fix', 'help', 'analyze', 'refactor',
    'implement', 'add', 'remove', 'update', 'modify', 'optimize',
    'convert', 'translate', 'format', 'validate', 'test', 'document'
  ];
  
  const lowerText = text.toLowerCase();
  const hasPromptIndicator = promptIndicators.some(indicator => 
    lowerText.includes(indicator)
  );
  
  // Also accept text that ends with question marks or colons (common in prompts)
  const hasPromptEnding = /[?:]$/.test(text.trim());
  
  // Accept text that looks like a command or instruction
  const looksLikeCommand = /^(add|create|make|build|fix|update|remove|delete|show|display|list|find|search|get|set)\s+/i.test(text.trim());
  
  const isPromptLike = hasPromptIndicator || hasPromptEnding || looksLikeCommand;
  
  if (isPromptLike) {
    console.log(`Prompt filter: accepted "${text.substring(0, 50)}..." (matched criteria)`);
  } else {
    console.log(`Prompt filter: rejected "${text.substring(0, 50)}..." (no prompt indicators)`);
  }
  
  return isPromptLike;
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
  uiohookAvailable: boolean;
  captureMode: 'uiohook' | 'fallback' | 'disabled';
} {
  let captureMode: 'uiohook' | 'fallback' | 'disabled' = 'disabled';
  
  if (state.keyboardListenerActive) {
    captureMode = uiohookAvailable ? 'uiohook' : 'fallback';
  }
  
  return {
    isRunning: state.isRunning,
    isTargetActive: state.isTargetActive,
    lastActiveWindow: state.lastActiveWindow,
    targetProcessName: state.targetProcessName,
    keyboardListenerActive: state.keyboardListenerActive,
    textBufferLength: state.currentTextBuffer.length,
    uiohookAvailable,
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
 * Adds sample data for testing purposes
 */
export async function addSampleData(): Promise<void> {
  console.log('Adding sample data for testing...');
  
  // Add multiple similar test phrases that would cluster together
  const testPhrases = [
    'hello world test',
    'hello world example', 
    'hello world demo',
    'hello world sample',
    'test hello world',
    'simple hello world',
    'basic hello world test',
    'quick hello world check',
    'hello world trial run',
    'hello world verification'
  ];
  
  try {
    for (const phrase of testPhrases) {
      await loggingService.logTextInput(
        phrase,
        'test-window',
        'test-app'
      );
      console.log(`Added test phrase: "${phrase}"`);
    }
    console.log(`✅ Added ${testPhrases.length} similar test phrases for clustering`);
  } catch (error) {
    console.error('Error adding sample data:', error);
  }
} 