#!/usr/bin/env node

/**
 * Generates DryPrompt app icon files for proper macOS app bundle usage
 * Creates SVG files that can be converted to PNG and .icns
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Creates SVG content for the DryPrompt three-line icon
 * @param {number} size - The width/height of the square icon in pixels
 * @returns {string} SVG content
 */
function createThreeLineIconSVG(size) {
  const lineThickness = Math.max(1, Math.floor(size / 16));
  const padding = Math.floor(size * 0.1875);
  const lineSpacing = Math.floor(size * 0.1875);
  const lineWidth = size - (padding * 2);
  const firstLineY = Math.floor(size * 0.3125);
  const secondLineY = firstLineY + lineSpacing;
  const thirdLineY = secondLineY + lineSpacing;
  
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="transparent"/>
  <g fill="black">
    <rect x="${padding}" y="${firstLineY}" width="${lineWidth}" height="${lineThickness}"/>
    <rect x="${padding}" y="${secondLineY}" width="${lineWidth}" height="${lineThickness}"/>
    <rect x="${padding}" y="${thirdLineY}" width="${lineWidth}" height="${lineThickness}"/>
  </g>
</svg>`;
}

/**
 * Main function to generate app icon files
 */
async function generateAppIcons() {
  console.log('🎨 Generating DryPrompt app icon files...');
  
  // Define paths
  const assetsDir = path.join(__dirname, '..', 'src', 'renderer', 'assets');
  const buildDir = path.join(__dirname, '..', 'build');
  
  // Create directories if they don't exist
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.mkdir(buildDir, { recursive: true });
  
  // Icon sizes needed for macOS app bundles
  const iconSizes = [
    { size: 16, name: 'icon_16x16' },
    { size: 32, name: 'icon_16x16@2x' },
    { size: 32, name: 'icon_32x32' },
    { size: 64, name: 'icon_32x32@2x' },
    { size: 128, name: 'icon_128x128' },
    { size: 256, name: 'icon_128x128@2x' },
    { size: 256, name: 'icon_256x256' },
    { size: 512, name: 'icon_256x256@2x' },
    { size: 512, name: 'icon_512x512' },
    { size: 1024, name: 'icon_512x512@2x' }
  ];
  
  console.log('📁 Creating SVG icon files...');
  
  // Generate SVG files for each required size
  for (const { size, name } of iconSizes) {
    const svgContent = createThreeLineIconSVG(size);
    const svgPath = path.join(assetsDir, `${name}.svg`);
    
    await fs.writeFile(svgPath, svgContent);
    console.log(`✅ Created ${svgPath}`);
  }
  
  // Create the main icon.svg file
  const mainIconPath = path.join(assetsDir, 'icon.svg');
  const mainIconContent = createThreeLineIconSVG(512);
  await fs.writeFile(mainIconPath, mainIconContent);
  console.log(`✅ Created main icon: ${mainIconPath}`);
  
  // Create instructions for generating .icns file
  const icnsInstructions = `# DryPrompt Icon Generation Instructions

## Step 1: Convert SVG to PNG
Use any tool to convert the SVG files in src/renderer/assets/ to PNG:
- Online converters (svg2png.com)
- Command line: \`rsvg-convert\` or \`inkscape\`
- Design tools: Figma, Sketch, etc.

## Step 2: Create .iconset directory
\`\`\`bash
mkdir icon.iconset
\`\`\`

## Step 3: Copy PNG files with correct names:
Copy the converted PNG files to icon.iconset/ with these exact names:
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

## Step 4: Generate .icns file
\`\`\`bash
iconutil -c icns icon.iconset
\`\`\`

## Step 5: Place in project
Copy the generated icon.icns to src/renderer/assets/icon.icns

The package.json already references this location.
`;
  
  await fs.writeFile(path.join(buildDir, 'icon-generation-guide.md'), icnsInstructions);
  
  console.log('🎉 App icon generation complete!');
  console.log('📄 See build/icon-generation-guide.md for next steps');
  console.log('🔧 Convert SVG → PNG → .icns to complete the process');
}

// Run the script
if (require.main === module) {
  generateAppIcons().catch(console.error);
}

module.exports = { generateAppIcons }; 