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
    
    if (hash === '#edit-dialog' || hash === '#multi-edit-dialog') {
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
    
    // Check if this is multi-suggestion mode
    const hash = window.location.hash;
    if (hash === '#multi-edit-dialog') {
      // Initialize multi-suggestion edit dialog functionality
      new MultiSuggestionEditDialog();
    } else {
      // Initialize single suggestion edit dialog functionality
      new EditDialog();
    }
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
  private form: HTMLFormElement | null;
  private triggerInput: HTMLInputElement | null;
  private replacementInput: HTMLTextAreaElement | null;
  private createBtn: HTMLButtonElement | null;
  private cancelBtn: HTMLButtonElement | null;
  private previewDemo: HTMLElement | null;
  private characterCount: HTMLElement | null;
  private dialogTitle: HTMLHeadingElement | null;
  private dialogSubtitle: HTMLParagraphElement | null;
  private sourcePromptsSection: HTMLElement | null;
  private sourcePromptsSubtitle: HTMLElement | null;
  private sourcePromptsList: HTMLElement | null;
  private copyTriggerBtn: HTMLButtonElement | null;
  private copyReplacementBtn: HTMLButtonElement | null;
  
  private triggerValid: boolean;
  private replacementValid: boolean;
  private originalSuggestion: any;
  private isManualCreation: boolean;

  constructor() {
    console.log('EditDialog constructor started');
    
    this.form = document.getElementById('edit-form');
    this.triggerInput = document.getElementById('trigger-input') as HTMLInputElement;
    this.replacementInput = document.getElementById('replacement-input') as HTMLTextAreaElement;
    this.createBtn = document.getElementById('create-btn') as HTMLButtonElement;
    this.cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
    this.previewDemo = document.getElementById('preview-demo');
    this.characterCount = document.getElementById('character-count');
    this.dialogTitle = document.querySelector('.dialog-title') as HTMLHeadingElement;
    this.dialogSubtitle = document.getElementById('dialog-subtitle') as HTMLParagraphElement;
    this.sourcePromptsSection = document.getElementById('source-prompts-section');
    this.sourcePromptsSubtitle = document.getElementById('source-prompts-subtitle');
    this.sourcePromptsList = document.getElementById('source-prompts-list');
    this.copyTriggerBtn = document.getElementById('copy-trigger-btn') as HTMLButtonElement;
    this.copyReplacementBtn = document.getElementById('copy-replacement-btn') as HTMLButtonElement;

    // Debug element availability
    console.log('Form elements found:', {
      form: !!this.form,
      triggerInput: !!this.triggerInput,
      replacementInput: !!this.replacementInput,
      createBtn: !!this.createBtn,
      cancelBtn: !!this.cancelBtn,
      previewDemo: !!this.previewDemo,
      characterCount: !!this.characterCount,
      dialogTitle: !!this.dialogTitle,
      dialogSubtitle: !!this.dialogSubtitle,
      sourcePromptsSection: !!this.sourcePromptsSection,
      sourcePromptsSubtitle: !!this.sourcePromptsSubtitle,
      sourcePromptsList: !!this.sourcePromptsList,
      copyTriggerBtn: !!this.copyTriggerBtn,
      copyReplacementBtn: !!this.copyReplacementBtn
    });

    this.triggerValid = false;
    this.replacementValid = false;
    this.originalSuggestion = null;
    this.isManualCreation = true; // Default to manual creation

    this.setupEventListeners();
    this.setupSuggestionListener();
    this.updateUIForManualCreation(); // Set up UI for manual creation by default
    
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

    // Copy button functionality
    this.copyTriggerBtn?.addEventListener('click', () => this.copyTrigger());
    this.copyReplacementBtn?.addEventListener('click', () => this.copyReplacement());

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
      console.log('No suggestion provided - keeping manual creation mode');
      return;
    }
    
    this.isManualCreation = false;
    this.originalSuggestion = suggestion;
    
    // Update UI for editing mode
    if (this.dialogTitle) {
      this.dialogTitle.textContent = 'Edit Shortcut';
    }
    
    if (this.dialogSubtitle) {
      this.dialogSubtitle.textContent = 'Customize the AI suggestion to fit your preferences';
    }
    
    if (this.createBtn) {
      this.createBtn.textContent = 'Create Shortcut';
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
    
    // Load source prompts if available
    this.loadSourcePrompts(suggestion);
    
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

  loadSourcePrompts(suggestion) {
    console.log('Loading source prompts:', suggestion.sourceTexts);
    
    if (!suggestion.sourceTexts || !Array.isArray(suggestion.sourceTexts) || suggestion.sourceTexts.length === 0) {
      console.log('No source prompts available - hiding source prompts section');
      if (this.sourcePromptsSection) {
        this.sourcePromptsSection.style.display = 'none';
      }
      return;
    }
    
    // Show the source prompts section
    if (this.sourcePromptsSection) {
      this.sourcePromptsSection.style.display = 'block';
    }
    
    // Update subtitle with count
    if (this.sourcePromptsSubtitle) {
      const count = suggestion.sourceTexts.length;
      this.sourcePromptsSubtitle.textContent = `These ${count} similar prompt${count === 1 ? '' : 's'} led to this suggestion:`;
    }
    
    // Populate the list
    if (this.sourcePromptsList) {
      this.sourcePromptsList.innerHTML = '';
      
      suggestion.sourceTexts.forEach((prompt, index) => {
        // Create container for prompt + button
        const promptContainer = document.createElement('div');
        promptContainer.className = 'source-prompt-container';
        
        // Create the prompt text element
        const promptText = document.createElement('div');
        promptText.className = 'source-prompt-text';
        promptText.textContent = prompt;
        
        // Create the "Use This" button
        const useButton = document.createElement('button');
        useButton.className = 'use-prompt-btn';
        useButton.textContent = 'Use This';
        useButton.type = 'button';
        useButton.title = `Use this exact prompt as replacement text`;
        
        // Add click handler to replace the replacement text
        useButton.addEventListener('click', () => {
          this.useSourcePrompt(prompt);
        });
        
        // Assemble the container
        promptContainer.appendChild(promptText);
        promptContainer.appendChild(useButton);
        this.sourcePromptsList.appendChild(promptContainer);
      });
      
      console.log(`Populated ${suggestion.sourceTexts.length} source prompts with "Use This" buttons`);
    } else {
      console.error('Source prompts list element not found');
    }
  }

  useSourcePrompt(prompt: string) {
    console.log(`Using source prompt as replacement: "${prompt}"`);
    
    // Update the replacement text input
    if (this.replacementInput) {
      this.replacementInput.value = prompt;
      
      // Trigger validation and UI updates
      this.validateReplacement();
      this.updateCharacterCount();
      this.updatePreview();
      
      // Focus the replacement input and select the text
      this.replacementInput.focus();
      this.replacementInput.select();
      
      // Show visual feedback
      this.showUsePromptFeedback();
    }
  }

  showUsePromptFeedback() {
    // Briefly highlight the replacement text area to show it was updated
    if (this.replacementInput) {
      this.replacementInput.style.backgroundColor = '#34c759';
      this.replacementInput.style.color = 'white';
      
      setTimeout(() => {
        this.replacementInput.style.backgroundColor = '';
        this.replacementInput.style.color = '';
      }, 600);
    }
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
        this.previewDemo.innerHTML = `Type <strong>${trigger}</strong> <span class="preview-arrow">→</span> Get "${replacement}"`;
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
      } else {
        // Success! Update UI to show completion but keep window open for copying
        if (this.createBtn) {
          this.createBtn.textContent = 'Ready to Copy!';
          this.createBtn.disabled = true;
          this.createBtn.style.backgroundColor = '#34c759'; // Green color
        }
        
        // Add a helpful message
        if (this.dialogSubtitle) {
          this.dialogSubtitle.textContent = 'Text Replacements opened! Copy the values below and close this window when done.';
          this.dialogSubtitle.style.color = '#34c759';
        }
        
        // Select the trigger text for easy copying
        if (this.triggerInput) {
          this.triggerInput.select();
        }
      }
      // Window will NOT be closed automatically - user closes when done
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
      if (this.createBtn && this.createBtn.textContent !== 'Ready to Copy!') {
        this.createBtn.textContent = 'Creating...';
      }
    } else {
      document.body.classList.remove('loading');
      // Only revert button text if it's not in the "Ready to Copy!" state
      if (this.createBtn && this.createBtn.textContent !== 'Ready to Copy!') {
        this.createBtn.textContent = 'Create Shortcut';
      }
    }
  }

  updateUIForManualCreation() {
    console.log('Setting up UI for manual shortcut creation');
    
    if (this.dialogTitle) {
      this.dialogTitle.textContent = 'Create Shortcut';
    }
    
    if (this.dialogSubtitle) {
      this.dialogSubtitle.textContent = 'Create a custom keyboard shortcut for your frequently used text';
    }
    
    if (this.createBtn) {
      this.createBtn.textContent = 'Create Shortcut';
    }
    
    // Set placeholder values for manual creation
    if (this.triggerInput) {
      this.triggerInput.placeholder = '-myshortcut';
      this.triggerInput.value = '';
    }
    
    if (this.replacementInput) {
      this.replacementInput.placeholder = 'Enter the text that will replace your trigger...';
      this.replacementInput.value = '';
    }
    
    // Hide source prompts section for manual creation
    if (this.sourcePromptsSection) {
      this.sourcePromptsSection.style.display = 'none';
    }
    
    this.isManualCreation = true;
    console.log('UI updated for manual creation');
  }

  async copyTrigger() {
    const trigger = this.triggerInput?.value.trim() || '';
    
    if (!trigger) {
      this.showCopyFeedback(this.copyTriggerBtn, false, 'No trigger to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(trigger);
      this.showCopyFeedback(this.copyTriggerBtn, true, 'Trigger copied!');
      console.log(`Copied trigger to clipboard: "${trigger}"`);
    } catch (error) {
      console.error('Failed to copy trigger:', error);
      // Fallback for older browsers or permission issues
      this.fallbackCopy(trigger);
      this.showCopyFeedback(this.copyTriggerBtn, true, 'Trigger copied!');
    }
  }

  async copyReplacement() {
    const replacement = this.replacementInput?.value.trim() || '';
    
    if (!replacement) {
      this.showCopyFeedback(this.copyReplacementBtn, false, 'No replacement to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(replacement);
      this.showCopyFeedback(this.copyReplacementBtn, true, 'Replacement copied!');
      console.log(`Copied replacement to clipboard: "${replacement.substring(0, 50)}..."`);
    } catch (error) {
      console.error('Failed to copy replacement:', error);
      // Fallback for older browsers or permission issues
      this.fallbackCopy(replacement);
      this.showCopyFeedback(this.copyReplacementBtn, true, 'Replacement copied!');
    }
  }

  showCopyFeedback(button: HTMLButtonElement | null, success: boolean, message: string) {
    if (!button) return;

    // Store original text and title
    const originalText = button.textContent;
    const originalTitle = button.title;
    
    // Update button appearance
    if (success) {
      button.classList.add('copied');
      button.textContent = '✓';
      button.title = message;
    } else {
      button.style.backgroundColor = '#ff453a';
      button.textContent = '✗';
      button.title = message;
    }
    
    // Reset after delay
    setTimeout(() => {
      button.classList.remove('copied');
      button.textContent = originalText;
      button.title = originalTitle;
      if (!success) {
        button.style.backgroundColor = '';
      }
    }, 1500);
  }

  fallbackCopy(text: string) {
    // Fallback method for copying text
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      console.log('Fallback copy successful');
    } catch (error) {
      console.error('Fallback copy failed:', error);
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

class MultiSuggestionEditDialog {
  private form: HTMLFormElement | null;
  private triggerInput: HTMLInputElement | null;
  private replacementInput: HTMLTextAreaElement | null;
  private createBtn: HTMLButtonElement | null;
  private cancelBtn: HTMLButtonElement | null;
  private rejectBtn: HTMLButtonElement | null;
  private previewDemo: HTMLElement | null;
  private characterCount: HTMLElement | null;
  private dialogTitle: HTMLHeadingElement | null;
  private dialogSubtitle: HTMLParagraphElement | null;
  private sourcePromptsSection: HTMLElement | null;
  private sourcePromptsSubtitle: HTMLElement | null;
  private sourcePromptsList: HTMLElement | null;
  private copyTriggerBtn: HTMLButtonElement | null;
  private copyReplacementBtn: HTMLButtonElement | null;
  
  // Multi-suggestion specific elements
  private multiSuggestionNav: HTMLElement | null;
  private navIndicator: HTMLElement | null;
  private prevBtn: HTMLButtonElement | null;
  private nextBtn: HTMLButtonElement | null;

  private triggerValid: boolean;
  private replacementValid: boolean;
  private suggestions: any[];
  private currentSuggestionIndex: number;

  constructor() {
    console.log('MultiSuggestionEditDialog constructor started');
    
    // Get form elements
    this.form = document.getElementById('edit-form');
    this.triggerInput = document.getElementById('trigger-input') as HTMLInputElement;
    this.replacementInput = document.getElementById('replacement-input') as HTMLTextAreaElement;
    this.createBtn = document.getElementById('create-btn') as HTMLButtonElement;
    this.cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
    this.rejectBtn = document.getElementById('reject-btn') as HTMLButtonElement;
    this.previewDemo = document.getElementById('preview-demo');
    this.characterCount = document.getElementById('character-count');
    this.dialogTitle = document.querySelector('.dialog-title') as HTMLHeadingElement;
    this.dialogSubtitle = document.getElementById('dialog-subtitle') as HTMLParagraphElement;
    this.sourcePromptsSection = document.getElementById('source-prompts-section');
    this.sourcePromptsSubtitle = document.getElementById('source-prompts-subtitle');
    this.sourcePromptsList = document.getElementById('source-prompts-list');
    this.copyTriggerBtn = document.getElementById('copy-trigger-btn') as HTMLButtonElement;
    this.copyReplacementBtn = document.getElementById('copy-replacement-btn') as HTMLButtonElement;
    
    // Multi-suggestion navigation elements
    this.multiSuggestionNav = document.getElementById('multi-suggestion-nav');
    this.navIndicator = document.getElementById('nav-indicator');
    this.prevBtn = document.getElementById('prev-suggestion-btn') as HTMLButtonElement;
    this.nextBtn = document.getElementById('next-suggestion-btn') as HTMLButtonElement;

    this.triggerValid = false;
    this.replacementValid = false;
    this.suggestions = [];
    this.currentSuggestionIndex = 0;

    this.setupEventListeners();
    this.setupMultiSuggestionListener();
    this.updateUIForMultiSuggestion();
    
    console.log('MultiSuggestionEditDialog constructor completed');
  }

  setupEventListeners() {
    // Form validation
    this.triggerInput?.addEventListener('input', () => this.validateTrigger());
    this.replacementInput?.addEventListener('input', () => {
      this.validateReplacement();
      this.updateCharacterCount();
      this.updatePreview();
    });

    // Navigation
    this.prevBtn?.addEventListener('click', () => this.navigateToPrevious());
    this.nextBtn?.addEventListener('click', () => this.navigateToNext());

    // Form actions
    this.form?.addEventListener('submit', (e) => this.handleSubmit(e));
    this.cancelBtn?.addEventListener('click', () => this.handleCancel());
    this.rejectBtn?.addEventListener('click', () => this.handleReject());

    // Update preview when trigger changes
    this.triggerInput?.addEventListener('input', () => this.updatePreview());

    // Copy functionality
    this.copyTriggerBtn?.addEventListener('click', () => this.copyTrigger());
    this.copyReplacementBtn?.addEventListener('click', () => this.copyReplacement());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.handleCancel();
      } else if (e.key === 'ArrowLeft' && e.metaKey) {
        this.navigateToPrevious();
      } else if (e.key === 'ArrowRight' && e.metaKey) {
        this.navigateToNext();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        if (this.triggerValid && this.replacementValid) {
          this.form?.dispatchEvent(new Event('submit'));
        }
      }
    });
  }

  setupMultiSuggestionListener() {
    console.log('Setting up multi-suggestion listener...');
    window.electronAPI.onLoadMultiSuggestions((data) => {
      console.log('Received multi-suggestions data:', data);
      this.suggestions = data.suggestions;
      this.currentSuggestionIndex = 0;
      this.loadCurrentSuggestion();
    });
  }

  updateUIForMultiSuggestion() {
    // Show multi-suggestion navigation
    if (this.multiSuggestionNav) {
      this.multiSuggestionNav.style.display = 'flex';
    }

    // Show reject button
    if (this.rejectBtn) {
      this.rejectBtn.style.display = 'inline-block';
    }

    // Update titles
    if (this.dialogTitle) {
      this.dialogTitle.textContent = 'Review Shortcuts';
    }

    if (this.dialogSubtitle) {
      this.dialogSubtitle.textContent = 'Navigate between suggestions and customize each one';
    }

    if (this.createBtn) {
      this.createBtn.textContent = 'Create This Shortcut';
    }
  }

  navigateToPrevious() {
    if (this.currentSuggestionIndex > 0) {
      this.currentSuggestionIndex--;
      this.loadCurrentSuggestion();
    }
  }

  navigateToNext() {
    if (this.currentSuggestionIndex < this.suggestions.length - 1) {
      this.currentSuggestionIndex++;
      this.loadCurrentSuggestion();
    }
  }

  loadCurrentSuggestion() {
    if (!this.suggestions || this.suggestions.length === 0) {
      return;
    }

    const suggestion = this.suggestions[this.currentSuggestionIndex];
    
    // Update navigation indicator
    if (this.navIndicator) {
      this.navIndicator.textContent = `${this.currentSuggestionIndex + 1} of ${this.suggestions.length}`;
    }

    // Update navigation buttons
    if (this.prevBtn) {
      this.prevBtn.disabled = this.currentSuggestionIndex === 0;
    }
    if (this.nextBtn) {
      this.nextBtn.disabled = this.currentSuggestionIndex === this.suggestions.length - 1;
    }

    // Load suggestion data
    if (this.triggerInput) {
      this.triggerInput.value = suggestion.trigger || '';
    }
    
    if (this.replacementInput) {
      this.replacementInput.value = suggestion.replacement || '';
    }
    
    // Load source prompts
    this.loadSourcePrompts(suggestion);
    
    // Trigger validation and updates
    this.validateTrigger();
    this.validateReplacement();
    this.updateCharacterCount();
    this.updatePreview();
  }

  loadSourcePrompts(suggestion) {
    if (!suggestion.sourceTexts || !Array.isArray(suggestion.sourceTexts) || suggestion.sourceTexts.length === 0) {
      if (this.sourcePromptsSection) {
        this.sourcePromptsSection.style.display = 'none';
      }
      return;
    }
    
    if (this.sourcePromptsSection) {
      this.sourcePromptsSection.style.display = 'block';
    }
    
    if (this.sourcePromptsSubtitle) {
      const count = suggestion.sourceTexts.length;
      this.sourcePromptsSubtitle.textContent = `These ${count} similar prompt${count === 1 ? '' : 's'} led to this suggestion:`;
    }
    
    if (this.sourcePromptsList) {
      this.sourcePromptsList.innerHTML = '';
      
      suggestion.sourceTexts.forEach((prompt, index) => {
        const promptContainer = document.createElement('div');
        promptContainer.className = 'source-prompt-container';
        
        const promptText = document.createElement('div');
        promptText.className = 'source-prompt-text';
        promptText.textContent = prompt;
        
        const useButton = document.createElement('button');
        useButton.className = 'use-prompt-btn';
        useButton.textContent = 'Use This';
        useButton.type = 'button';
        useButton.title = `Use this exact prompt as replacement text`;
        
        useButton.addEventListener('click', () => {
          this.useSourcePrompt(prompt);
        });
        
        promptContainer.appendChild(promptText);
        promptContainer.appendChild(useButton);
        this.sourcePromptsList.appendChild(promptContainer);
      });
    }
  }

  useSourcePrompt(prompt: string) {
    if (this.replacementInput) {
      this.replacementInput.value = prompt;
      this.validateReplacement();
      this.updateCharacterCount();
      this.updatePreview();
      this.replacementInput.focus();
      this.replacementInput.select();
      this.showUsePromptFeedback();
    }
  }

  showUsePromptFeedback() {
    if (this.replacementInput) {
      this.replacementInput.style.backgroundColor = '#34c759';
      this.replacementInput.style.color = 'white';
      
      setTimeout(() => {
        this.replacementInput.style.backgroundColor = '';
        this.replacementInput.style.color = '';
      }, 600);
    }
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
    
    container.classList.remove('error', 'warning', 'success');
    messageEl.classList.remove('error', 'warning', 'success');

    if (type) {
      container.classList.add(type);
      messageEl.classList.add(type);
    }

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
        this.previewDemo.innerHTML = `Type <strong>${trigger}</strong> <span class="preview-arrow">→</span> Get "${replacement}"`;
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
      const result = await window.electronAPI.confirmSuggestion({
        suggestionIndex: this.currentSuggestionIndex,
        editedData
      });
      
      if (!result.success) {
        alert(`Error: ${result.error || 'Failed to create shortcut'}`);
      } else {
        // Show success feedback
        if (this.createBtn) {
          this.createBtn.textContent = 'Shortcut Created!';
          this.createBtn.disabled = true;
          this.createBtn.style.backgroundColor = '#34c759';
        }
        
        // Navigate to next suggestion or close
        if (this.currentSuggestionIndex < this.suggestions.length - 1) {
          setTimeout(() => {
            this.navigateToNext();
            this.resetCreateButton();
          }, 1500);
        }
      }
    } catch (error) {
      console.error('Error confirming suggestion:', error);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  async handleReject() {
    try {
      const result = await window.electronAPI.rejectSuggestion(this.currentSuggestionIndex);
      
      if (!result.success) {
        alert(`Error: ${result.error || 'Failed to reject suggestion'}`);
      } else {
        // Navigate to next suggestion or close
        if (this.currentSuggestionIndex < this.suggestions.length - 1) {
          this.navigateToNext();
        } else {
          // This was the last suggestion, close dialog
          await this.handleCancel();
        }
      }
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
      alert('An unexpected error occurred. Please try again.');
    }
  }

  async handleCancel() {
    try {
      await window.electronAPI.cancelMultiEdit();
    } catch (error) {
      console.error('Error cancelling multi-edit:', error);
    }
  }

  resetCreateButton() {
    if (this.createBtn) {
      this.createBtn.textContent = 'Create This Shortcut';
      this.createBtn.style.backgroundColor = '';
      this.createBtn.disabled = !(this.triggerValid && this.replacementValid);
    }
  }

  setLoading(loading) {
    if (loading) {
      document.body.classList.add('loading');
      if (this.createBtn) {
        this.createBtn.textContent = 'Creating...';
      }
    } else {
      document.body.classList.remove('loading');
    }
  }

  async copyTrigger() {
    const trigger = this.triggerInput?.value.trim() || '';
    
    if (!trigger) {
      this.showCopyFeedback(this.copyTriggerBtn, false, 'No trigger to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(trigger);
      this.showCopyFeedback(this.copyTriggerBtn, true, 'Trigger copied!');
    } catch (error) {
      this.fallbackCopy(trigger);
      this.showCopyFeedback(this.copyTriggerBtn, true, 'Trigger copied!');
    }
  }

  async copyReplacement() {
    const replacement = this.replacementInput?.value.trim() || '';
    
    if (!replacement) {
      this.showCopyFeedback(this.copyReplacementBtn, false, 'No replacement to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(replacement);
      this.showCopyFeedback(this.copyReplacementBtn, true, 'Replacement copied!');
    } catch (error) {
      this.fallbackCopy(replacement);
      this.showCopyFeedback(this.copyReplacementBtn, true, 'Replacement copied!');
    }
  }

  showCopyFeedback(button: HTMLButtonElement | null, success: boolean, message: string) {
    if (!button) return;

    const originalText = button.textContent;
    const originalTitle = button.title;
    
    if (success) {
      button.classList.add('copied');
      button.textContent = '✓';
      button.title = message;
    } else {
      button.style.backgroundColor = '#ff453a';
      button.textContent = '✗';
      button.title = message;
    }
    
    setTimeout(() => {
      button.classList.remove('copied');
      button.textContent = originalText;
      button.title = originalTitle;
      if (!success) {
        button.style.backgroundColor = '';
      }
    }, 1500);
  }

  fallbackCopy(text: string) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
    } catch (error) {
      console.error('Fallback copy failed:', error);
    } finally {
      document.body.removeChild(textArea);
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
