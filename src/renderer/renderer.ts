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
console.log('DryPrompt renderer script loaded - checking current URL:', window.location.href);

/**
 * @file Renderer process entry point for both configuration and edit dialog windows
 * @module renderer
 */

// Router to handle different views
class AppRouter {
  constructor() {
    console.log('AppRouter constructor called');
    this.currentView = null;
    this.initializeRouter();
  }

  initializeRouter() {
    console.log('Initializing router...');
    // Check URL hash to determine which view to show
    const hash = window.location.hash;
    console.log('Current URL hash:', hash);
    
    if (hash === '#edit-dialog') {
      console.log('Hash indicates edit dialog - initializing edit dialog view');
      this.showEditDialog();
    } else {
      console.log('No hash or different hash - showing config view');
      this.showConfigView();
    }
  }

  showConfigView() {
    const configView = document.getElementById('config-view');
    const editView = document.getElementById('edit-dialog-view');
    
    if (configView) configView.style.display = 'block';
    if (editView) editView.style.display = 'none';
    
    this.currentView = 'config';
    document.title = 'DryPrompt - Configuration';
    
    // Initialize config functionality
    new ConfigManager();
  }

  showEditDialog() {
    console.log('Showing edit dialog view...');
    
    const configView = document.getElementById('config-view');
    const editView = document.getElementById('edit-dialog-view');
    
    if (configView) configView.style.display = 'none';
    if (editView) editView.style.display = 'block';
    
    this.currentView = 'edit-dialog';
    document.title = 'Edit Shortcut - DryPrompt';
    
    console.log('Creating EditDialog instance...');
    // Initialize edit dialog functionality
    new EditDialog();
    console.log('Edit dialog view setup complete');
  }
}

// Configuration Manager
class ConfigManager {
  constructor() {
    this.setupEventListeners();
    this.checkExistingApiKey();
  }

  setupEventListeners() {
    const configForm = document.getElementById('config-form');
    if (configForm) {
      configForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }
  }

  showStatusMessage(message: string, type: 'success' | 'error'): void {
    const statusElement = document.getElementById('status-message');
    if (!statusElement) return;

    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    statusElement.classList.remove('hidden');

    setTimeout(() => {
      statusElement.classList.add('hidden');
    }, 5000);
  }

  validateApiKey(apiKey: string): boolean {
    return apiKey.startsWith('sk-') && apiKey.length >= 20;
  }

  async handleFormSubmit(event: Event): Promise<void> {
    event.preventDefault();

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const apiKey = formData.get('api-key') as string;

    if (!apiKey || !this.validateApiKey(apiKey)) {
      this.showStatusMessage('Please enter a valid OpenAI API key (should start with "sk-")', 'error');
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
        this.showStatusMessage('API key saved successfully!', 'success');
        form.reset();
      } else {
        this.showStatusMessage(`Failed to save API key: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      this.showStatusMessage('An unexpected error occurred while saving the API key', 'error');
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Configuration';
      }
    }
  }

  async checkExistingApiKey(): Promise<void> {
    try {
      const hasApiKey = await window.electronAPI.checkApiKey();
      
      if (hasApiKey) {
        this.showStatusMessage('API key is already configured. You can update it by entering a new one.', 'success');
      }
    } catch (error) {
      console.error('Error checking for existing API key:', error);
    }
  }
}

// Edit Dialog Manager
class EditDialog {
  constructor() {
    console.log('EditDialog constructor started');
    
    this.form = document.getElementById('edit-form');
    this.triggerInput = document.getElementById('trigger-input') as HTMLInputElement;
    this.replacementInput = document.getElementById('replacement-input') as HTMLTextAreaElement;
    this.createBtn = document.getElementById('create-btn') as HTMLButtonElement;
    this.cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
    this.previewDemo = document.getElementById('preview-demo');
    this.characterCount = document.getElementById('character-count');

    // Debug element availability
    console.log('Form elements found:', {
      form: !!this.form,
      triggerInput: !!this.triggerInput,
      replacementInput: !!this.replacementInput,
      createBtn: !!this.createBtn,
      cancelBtn: !!this.cancelBtn,
      previewDemo: !!this.previewDemo,
      characterCount: !!this.characterCount
    });

    this.triggerValid = false;
    this.replacementValid = false;
    this.originalSuggestion = null;

    this.setupEventListeners();
    this.setupSuggestionListener();
    
    console.log('EditDialog constructor completed');
  }

  setupEventListeners() {
    // Real-time validation
    this.triggerInput?.addEventListener('input', () => this.validateTrigger());
    this.replacementInput?.addEventListener('input', () => {
      this.validateReplacement();
      this.updateCharacterCount();
      this.updatePreview();
    });

    // Form submission
    this.form?.addEventListener('submit', (e) => this.handleSubmit(e));
    this.cancelBtn?.addEventListener('click', () => this.handleCancel());

    // Update preview when trigger changes
    this.triggerInput?.addEventListener('input', () => this.updatePreview());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.handleCancel();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        if (this.triggerValid && this.replacementValid) {
          this.form?.dispatchEvent(new Event('submit'));
        }
      }
    });
  }

  setupSuggestionListener() {
    console.log('Setting up suggestion listener...');
    window.electronAPI.onLoadSuggestion((suggestion) => {
      console.log('Received suggestion data:', suggestion);
      this.originalSuggestion = suggestion;
      this.loadSuggestion(suggestion);
    });
  }

  loadSuggestion(suggestion) {
    console.log('Loading suggestion into form:', suggestion);
    
    if (!suggestion) {
      console.error('No suggestion data provided');
      return;
    }
    
    // If elements aren't available yet, try again after a short delay
    if (!this.triggerInput || !this.replacementInput) {
      console.log('Form elements not ready, retrying in 50ms...');
      setTimeout(() => {
        // Re-query elements
        this.triggerInput = document.getElementById('trigger-input') as HTMLInputElement;
        this.replacementInput = document.getElementById('replacement-input') as HTMLTextAreaElement;
        this.loadSuggestion(suggestion);
      }, 50);
      return;
    }
    
    if (this.triggerInput) {
      this.triggerInput.value = suggestion.trigger || '';
      console.log('Set trigger input to:', suggestion.trigger);
    } else {
      console.error('Trigger input element not found');
    }
    
    if (this.replacementInput) {
      this.replacementInput.value = suggestion.replacement || '';
      console.log('Set replacement input to:', suggestion.replacement);
    } else {
      console.error('Replacement input element not found');
    }
    
    // Trigger validation and updates
    this.validateTrigger();
    this.validateReplacement();
    this.updateCharacterCount();
    this.updatePreview();

    // Focus the trigger input for immediate editing
    this.triggerInput?.focus();
    this.triggerInput?.select();
    
    console.log('Suggestion loaded successfully');
  }

  async validateTrigger() {
    const trigger = this.triggerInput?.value.trim() || '';
    const container = document.getElementById('trigger-container');
    const message = document.getElementById('trigger-validation');

    if (!trigger) {
      this.setValidationState(container, message, 'error', '⚠', 'Trigger cannot be empty');
      this.triggerValid = false;
      this.updateCreateButton();
      return;
    }

    try {
      const result = await window.electronAPI.validateTrigger(trigger);
      const icon = result.type === 'error' ? '⚠' : result.type === 'warning' ? '⚠' : '✓';
      this.setValidationState(container, message, result.type, icon, result.message);
      this.triggerValid = result.isValid;
    } catch (error) {
      this.setValidationState(container, message, 'error', '⚠', 'Validation error');
      this.triggerValid = false;
    }

    this.updateCreateButton();
  }

  async validateReplacement() {
    const replacement = this.replacementInput?.value.trim() || '';
    const container = document.getElementById('replacement-container');
    const message = document.getElementById('replacement-validation');

    if (!replacement) {
      this.setValidationState(container, message, 'error', '⚠', 'Replacement text cannot be empty');
      this.replacementValid = false;
      this.updateCreateButton();
      return;
    }

    try {
      const result = await window.electronAPI.validateReplacement(replacement);
      const icon = result.type === 'error' ? '⚠' : result.type === 'warning' ? '⚠' : '✓';
      this.setValidationState(container, message, result.type, icon, result.message);
      this.replacementValid = result.isValid;
    } catch (error) {
      this.setValidationState(container, message, 'error', '⚠', 'Validation error');
      this.replacementValid = false;
    }

    this.updateCreateButton();
  }

  setValidationState(container, messageEl, type, icon, message) {
    if (!container || !messageEl) return;
    
    // Remove existing classes
    container.classList.remove('error', 'warning', 'success');
    messageEl.classList.remove('error', 'warning', 'success');

    // Add new classes
    if (type) {
      container.classList.add(type);
      messageEl.classList.add(type);
    }

    // Set message content
    messageEl.innerHTML = message ? `<span class="validation-icon">${icon}</span>${message}` : '';
  }

  updateCharacterCount() {
    const count = this.replacementInput?.value.length || 0;
    if (this.characterCount) {
      this.characterCount.textContent = `${count} characters`;
    }
  }

  updatePreview() {
    const trigger = this.triggerInput?.value.trim() || '';
    const replacement = this.replacementInput?.value.trim() || '';

    if (this.previewDemo) {
      if (trigger && replacement) {
        this.previewDemo.innerHTML = `Type <strong>${trigger}</strong> <span class="preview-arrow">→</span> Get "${replacement.substring(0, 50)}${replacement.length > 50 ? '...' : ''}"`;
      } else {
        this.previewDemo.innerHTML = 'Type your trigger <span class="preview-arrow">→</span> Get your replacement text';
      }
    }
  }

  updateCreateButton() {
    if (this.createBtn) {
      this.createBtn.disabled = !(this.triggerValid && this.replacementValid);
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    if (!this.triggerValid || !this.replacementValid) {
      return;
    }

    const editedData = {
      trigger: this.triggerInput?.value.trim() || '',
      replacement: this.replacementInput?.value.trim() || ''
    };

    try {
      this.setLoading(true);
      const result = await window.electronAPI.confirmEdit(editedData);
      
      if (!result.success) {
        alert(`Error: ${result.error || 'Failed to create shortcut'}`);
      }
      // Window will be closed by the main process on success
    } catch (error) {
      console.error('Error confirming edit:', error);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  async handleCancel() {
    try {
      await window.electronAPI.cancelEdit();
      // Window will be closed by the main process
    } catch (error) {
      console.error('Error cancelling edit:', error);
    }
  }

  setLoading(loading) {
    if (loading) {
      document.body.classList.add('loading');
      if (this.createBtn) this.createBtn.textContent = 'Creating...';
    } else {
      document.body.classList.remove('loading');
      if (this.createBtn) this.createBtn.textContent = 'Create Shortcut';
    }
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded event fired - initializing DryPrompt renderer');
  try {
    new AppRouter();
    console.log('AppRouter initialized successfully');
  } catch (error) {
    console.error('Error initializing AppRouter:', error);
  }
});

// Backup initialization in case DOMContentLoaded already fired
if (document.readyState === 'loading') {
  console.log('Document still loading, waiting for DOMContentLoaded');
} else {
  console.log('Document already loaded, initializing immediately');
  try {
    new AppRouter();
    console.log('AppRouter initialized successfully (immediate)');
  } catch (error) {
    console.error('Error initializing AppRouter immediately:', error);
  }
}
