/**
 * @file Icon generator utility for creating DryPrompt's three-line icon at various sizes
 * @module icon-generator
 */

import { nativeImage } from 'electron';

/**
 * Creates the DryPrompt three-line icon programmatically
 * @param size - The width/height of the square icon in pixels
 * @returns Native image for the icon
 */
export function createThreeLineIcon(size: number = 16): Electron.NativeImage {
  const canvas = Buffer.alloc(size * size * 4); // RGBA
  
  // Fill with transparent pixels first
  for (let i = 0; i < canvas.length; i += 4) {
    canvas[i] = 0;     // R
    canvas[i + 1] = 0; // G  
    canvas[i + 2] = 0; // B
    canvas[i + 3] = 0; // A (transparent)
  }
  
  // Helper function to set a pixel
  const setPixel = (x: number, y: number, opacity = 255) => {
    if (x >= 0 && x < size && y >= 0 && y < size) {
      const pixelIndex = (y * size + x) * 4;
      canvas[pixelIndex] = 0;     // R (black)
      canvas[pixelIndex + 1] = 0; // G (black)
      canvas[pixelIndex + 2] = 0; // B (black)
      canvas[pixelIndex + 3] = opacity; // A
    }
  };
  
  // Calculate proportional positioning for different sizes
  const lineThickness = Math.max(1, Math.floor(size / 16)); // Scale line thickness
  const padding = Math.floor(size * 0.1875); // 3/16 ratio from original
  const lineSpacing = Math.floor(size * 0.1875); // 3/16 ratio from original
  const lineWidth = size - (padding * 2);
  
  // Calculate Y positions for three lines
  const firstLineY = Math.floor(size * 0.3125); // 5/16 from original
  const secondLineY = firstLineY + lineSpacing;
  const thirdLineY = secondLineY + lineSpacing;
  
  // Draw three horizontal lines
  [firstLineY, secondLineY, thirdLineY].forEach(y => {
    for (let thickness = 0; thickness < lineThickness; thickness++) {
      for (let x = padding; x < padding + lineWidth; x++) {
        setPixel(x, y + thickness);
      }
    }
  });
  
  const icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  icon.setTemplateImage(true); // Make it a template image for proper macOS styling
  
  return icon;
}

/**
 * Creates a notification-sized version of the DryPrompt icon (64x64)
 * @returns Native image optimized for notifications
 */
export function createNotificationIcon(): Electron.NativeImage {
  return createThreeLineIcon(64);
}

/**
 * Creates a menu bar-sized version of the DryPrompt icon (16x16)
 * @returns Native image optimized for menu bar
 */
export function createMenuBarIcon(): Electron.NativeImage {
  return createThreeLineIcon(16);
}

/**
 * Converts the icon to a file path for use in notifications
 * Creates a temporary PNG file and returns the path
 * @param size - The size of the icon to create
 * @returns Promise resolving to the temporary file path
 */
export async function createIconFile(size: number = 64): Promise<string> {
  const { app } = await import('electron');
  const path = await import('path');
  const fs = await import('fs').then(module => module.promises);
  
  const icon = createThreeLineIcon(size);
  const iconBuffer = icon.toPNG();
  
  // Create temp file path
  const tempDir = app.getPath('temp');
  const iconPath = path.join(tempDir, `dryprompt-icon-${size}.png`);
  
  // Write icon to file
  await fs.writeFile(iconPath, iconBuffer);
  
  return iconPath;
} 