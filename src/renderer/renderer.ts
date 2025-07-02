/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';

console.log('👋 This message is being logged by "renderer.ts", included via Vite');

/**
 * @file Renderer process entry point for the configuration window
 * @module renderer
 */

/**
 * Shows a status message to the user
 * @param message - The message to display
 * @param type - The type of message (success or error)
 */
function showStatusMessage(message: string, type: 'success' | 'error'): void {
  const statusElement = document.getElementById('status-message');
  if (!statusElement) return;

  statusElement.textContent = message;
  statusElement.className = `status-message ${type}`;
  statusElement.classList.remove('hidden');

  // Hide the message after 5 seconds
  setTimeout(() => {
    statusElement.classList.add('hidden');
  }, 5000);
}

/**
 * Validates the OpenAI API key format
 * @param apiKey - The API key to validate
 * @returns Whether the API key appears to be valid
 */
function validateApiKey(apiKey: string): boolean {
  // Basic validation: should start with 'sk-' and be at least 20 characters
  return apiKey.startsWith('sk-') && apiKey.length >= 20;
}

/**
 * Handles the form submission for saving the API key
 * @param event - The form submission event
 */
async function handleFormSubmit(event: Event): Promise<void> {
  event.preventDefault();

  const form = event.target as HTMLFormElement;
  const formData = new FormData(form);
  const apiKey = formData.get('api-key') as string;

  if (!apiKey || !validateApiKey(apiKey)) {
    showStatusMessage('Please enter a valid OpenAI API key (should start with "sk-")', 'error');
    return;
  }

  const saveButton = document.getElementById('save-button') as HTMLButtonElement;
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
  }

  try {
    const result = await window.electronAPI.saveApiKey(apiKey);
    
    if (result.success) {
      showStatusMessage('API key saved successfully!', 'success');
      // Clear the form
      form.reset();
    } else {
      showStatusMessage(`Failed to save API key: ${result.message}`, 'error');
    }
  } catch (error) {
    console.error('Error saving API key:', error);
    showStatusMessage('An unexpected error occurred while saving the API key', 'error');
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = 'Save Configuration';
    }
  }
}

/**
 * Checks if an API key is already configured on page load
 */
async function checkExistingApiKey(): Promise<void> {
  try {
    const hasApiKey = await window.electronAPI.checkApiKey();
    
    if (hasApiKey) {
      showStatusMessage('API key is already configured. You can update it by entering a new one.', 'success');
    }
  } catch (error) {
    console.error('Error checking for existing API key:', error);
  }
}

// Initialize the renderer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DryPrompt Configuration UI loaded');

  // Set up form submission handler
  const configForm = document.getElementById('config-form');
  if (configForm) {
    configForm.addEventListener('submit', handleFormSubmit);
  }

  // Check for existing API key
  checkExistingApiKey();
});
