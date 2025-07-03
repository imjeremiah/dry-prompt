#!/usr/bin/env node

/**
 * @file Script to generate menu bar icons for different application states
 * This creates PNG files for: idle, analyzing, error, configuration-needed, permission-needed
 */

const fs = require('fs').promises;
const path = require('path');

// Create the icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '..', 'src', 'renderer', 'assets', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

/**
 * Creates a PNG buffer for a menu bar icon
 * @param {string} type - The icon type (idle, analyzing, error, etc.)
 * @returns {Buffer} PNG buffer data
 */
function createIcon(type) {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4); // RGBA
  
  // Fill with transparent pixels first
  for (let i = 0; i < canvas.length; i += 4) {
    canvas[i] = 0;     // R
    canvas[i + 1] = 0; // G  
    canvas[i + 2] = 0; // B
    canvas[i + 3] = 0; // A (transparent)
  }
  
  // Function to set a pixel
  const setPixel = (x, y, r, g, b, a = 255) => {
    if (x >= 0 && x < size && y >= 0 && y < size) {
      const pixelIndex = (y * size + x) * 4;
      canvas[pixelIndex] = r;
      canvas[pixelIndex + 1] = g;
      canvas[pixelIndex + 2] = b;
      canvas[pixelIndex + 3] = a;
    }
  };
  
  // Function to draw a horizontal line
  const drawHorizontalLine = (y, startX, endX, r = 0, g = 0, b = 0, a = 255) => {
    for (let x = startX; x <= endX; x++) {
      setPixel(x, y, r, g, b, a);
    }
  };
  
  // Function to draw a vertical line
  const drawVerticalLine = (x, startY, endY, r = 0, g = 0, b = 0, a = 255) => {
    for (let y = startY; y <= endY; y++) {
      setPixel(x, y, r, g, b, a);
    }
  };
  
  // Function to draw a circle (simple)
  const drawCircle = (centerX, centerY, radius, r = 0, g = 0, b = 0, a = 255) => {
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        if (distance <= radius) {
          setPixel(x, y, r, g, b, a);
        }
      }
    }
  };
  
  switch (type) {
    case 'idle':
      // Three horizontal lines (hamburger menu)
      drawHorizontalLine(4, 2, 13, 0, 0, 0, 255);
      drawHorizontalLine(7, 2, 13, 0, 0, 0, 255);
      drawHorizontalLine(10, 2, 13, 0, 0, 0, 255);
      break;
      
    case 'analyzing':
      // Animated dots pattern (three dots)
      drawCircle(4, 8, 1, 0, 0, 0, 255);
      drawCircle(8, 8, 1, 0, 0, 0, 255);
      drawCircle(12, 8, 1, 0, 0, 0, 255);
      // Add connecting lines to suggest movement
      drawHorizontalLine(8, 5, 6, 0, 0, 0, 128);
      drawHorizontalLine(8, 9, 11, 0, 0, 0, 128);
      break;
      
    case 'error':
      // X mark
      for (let i = 0; i < 8; i++) {
        setPixel(4 + i, 4 + i, 0, 0, 0, 255); // Diagonal \
        setPixel(11 - i, 4 + i, 0, 0, 0, 255); // Diagonal /
      }
      break;
      
    case 'configuration-needed':
      // Gear/settings icon (simplified)
      drawCircle(8, 8, 3, 0, 0, 0, 255);
      drawCircle(8, 8, 1, 255, 255, 255, 255); // White center
      // Add gear teeth
      setPixel(8, 3, 0, 0, 0, 255); // Top
      setPixel(8, 13, 0, 0, 0, 255); // Bottom
      setPixel(3, 8, 0, 0, 0, 255); // Left
      setPixel(13, 8, 0, 0, 0, 255); // Right
      break;
      
    case 'permission-needed':
      // Lock icon
      // Lock body
      for (let x = 5; x <= 11; x++) {
        for (let y = 9; y <= 13; y++) {
          setPixel(x, y, 0, 0, 0, 255);
        }
      }
      // Lock shackle
      drawVerticalLine(6, 5, 9, 0, 0, 0, 255);
      drawVerticalLine(10, 5, 9, 0, 0, 0, 255);
      drawHorizontalLine(5, 6, 10, 0, 0, 0, 255);
      // Clear center of shackle
      setPixel(7, 6, 255, 255, 255, 0);
      setPixel(8, 6, 255, 255, 255, 0);
      setPixel(9, 6, 255, 255, 255, 0);
      setPixel(7, 7, 255, 255, 255, 0);
      setPixel(8, 7, 255, 255, 255, 0);
      setPixel(9, 7, 255, 255, 255, 0);
      break;
      
    default:
      // Default: simple square
      for (let x = 6; x <= 10; x++) {
        for (let y = 6; y <= 10; y++) {
          setPixel(x, y, 0, 0, 0, 255);
        }
      }
  }
  
  return canvas;
}

/**
 * Converts raw RGBA buffer to PNG format (simplified)
 * For a real implementation, you'd use a library like 'pngjs' or 'canvas'
 * This creates a basic uncompressed image format that macOS can read
 */
function bufferToPNG(buffer, width, height) {
  // For now, we'll create a simple BMP-like format that Electron can handle
  // In production, you'd want to use a proper PNG library
  return buffer; // Electron's nativeImage.createFromBuffer can handle raw RGBA
}

/**
 * Saves icon to file
 */
function saveIcon(type, buffer) {
  const filename = `icon-${type}.raw`;
  const filepath = path.join(iconsDir, filename);
  
  // Also save metadata for the icon
  const metadata = {
    width: 16,
    height: 16,
    format: 'RGBA',
    type: type,
    created: new Date().toISOString()
  };
  
  fs.writeFileSync(filepath, buffer);
  fs.writeFileSync(
    path.join(iconsDir, `icon-${type}.json`), 
    JSON.stringify(metadata, null, 2)
  );
  
  console.log(`Created icon: ${filename}`);
}

// Generate all icon types
const iconTypes = ['idle', 'analyzing', 'error', 'configuration-needed', 'permission-needed'];

console.log('Generating menu bar icons...');

iconTypes.forEach(type => {
  const buffer = createIcon(type);
  saveIcon(type, buffer);
});

console.log(`Generated ${iconTypes.length} icons in ${iconsDir}`);
console.log('Icons can be loaded using nativeImage.createFromBuffer() in Electron');

/**
 * Generates DryPrompt icon files for app bundle usage
 * Creates PNG files and attempts to create .icns file for macOS
 */

/**
 * Creates the DryPrompt three-line icon programmatically
 * @param {number} size - The width/height of the square icon in pixels
 * @returns {Buffer} PNG buffer for the icon
 */
function createThreeLineIconPNG(size = 16) {
  const canvas = Buffer.alloc(size * size * 4); // RGBA
  
  // Fill with transparent pixels first
  for (let i = 0; i < canvas.length; i += 4) {
    canvas[i] = 0;     // R
    canvas[i + 1] = 0; // G  
    canvas[i + 2] = 0; // B
    canvas[i + 3] = 0; // A (transparent)
  }
  
  // Helper function to set a pixel
  const setPixel = (x, y, opacity = 255) => {
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
  
  // Convert to PNG format (simplified - in real usage, would use a proper PNG encoder)
  // For now, we'll create the raw RGBA data and rely on electron to convert it
  return canvas;
}

/**
 * Creates a simple PNG header + data (very basic implementation)
 * In a real scenario, you'd use a proper PNG encoding library
 */
function createPNGFromRGBA(rgbaData, width, height) {
  // This is a simplified approach - normally you'd use a library like 'pngjs'
  // For now, we'll just save the raw data and let the calling code handle PNG conversion
  return rgbaData;
}

/**
 * Main function to generate all icon files
 */
async function generateIcons() {
  console.log('🎨 Generating DryPrompt icon files...');
  
  // Define paths
  const assetsDir = path.join(__dirname, '..', 'src', 'renderer', 'assets');
  const buildDir = path.join(__dirname, '..', 'build');
  
  // Create directories if they don't exist
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.mkdir(buildDir, { recursive: true });
  
  // Icon sizes for macOS app bundles
  const iconSizes = [16, 32, 64, 128, 256, 512, 1024];
  
  console.log('📁 Creating assets directory icons...');
  
  // Generate PNG files using a simple approach
  for (const size of iconSizes) {
    const iconPath = path.join(assetsDir, `icon-${size}.png`);
    
    // Create a simple black square as placeholder (replace with proper icon generation)
    const svgContent = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" fill="transparent"/>
        <g fill="black">
          <rect x="${Math.floor(size * 0.1875)}" y="${Math.floor(size * 0.3125)}" width="${size - Math.floor(size * 0.375)}" height="${Math.max(1, Math.floor(size / 16))}"/>
          <rect x="${Math.floor(size * 0.1875)}" y="${Math.floor(size * 0.3125) + Math.floor(size * 0.1875)}" width="${size - Math.floor(size * 0.375)}" height="${Math.max(1, Math.floor(size / 16))}"/>
          <rect x="${Math.floor(size * 0.1875)}" y="${Math.floor(size * 0.3125) + Math.floor(size * 0.375)}" width="${size - Math.floor(size * 0.375)}" height="${Math.max(1, Math.floor(size / 16))}"/>
        </g>
      </svg>
    `;
    
    // Save SVG (can be converted to PNG later)
    await fs.writeFile(iconPath.replace('.png', '.svg'), svgContent);
    console.log(`✅ Created ${iconPath.replace('.png', '.svg')}`);
  }
  
  // Create a simple icon.icns instruction file
  const icnsInstructions = `
# DryPrompt Icon Generation Instructions

To create a proper .icns file for macOS:

1. Install iconutil (comes with Xcode)
2. Create an icon.iconset directory
3. Add PNG files with specific naming:
   - icon_16x16.png (16x16)
   - icon_16x16@2x.png (32x32)  
   - icon_32x32.png (32x32)
   - icon_32x32@2x.png (64x64)
   - icon_128x128.png (128x128)
   - icon_128x128@2x.png (256x256)
   - icon_256x256.png (256x256)
   - icon_256x256@2x.png (512x512)
   - icon_512x512.png (512x512)
   - icon_512x512@2x.png (1024x1024)

4. Run: iconutil -c icns icon.iconset

For now, the SVG files have been created in src/renderer/assets/
`;
  
  await fs.writeFile(path.join(buildDir, 'icon-instructions.txt'), icnsInstructions);
  
  console.log('🎉 Icon generation complete!');
  console.log('📄 See build/icon-instructions.txt for .icns creation steps');
  console.log('💡 Tip: For proper app bundle icons, you may need to create a proper .icns file');
}

// Run the script
if (require.main === module) {
  generateIcons().catch(console.error);
}

module.exports = { generateIcons }; 