# Migration Guide: iohook to uiohook-napi

This guide covers the migration from `iohook` to `uiohook-napi` for improved Electron compatibility.

## What Changed

- **Package**: Replaced `iohook` with `uiohook-napi` 
- **Reason**: Better compatibility with modern Electron versions (37.1.0+)
- **Impact**: Improved stability and easier installation

## Migration Steps

### 1. Update Dependencies

The package.json has already been updated. To apply the changes:

```bash
# Remove old node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Install new dependencies
npm install

# If you get build errors, try rebuilding native modules
npm run electron-rebuild
```

### 2. Test the Migration

1. **Start the application:**
   ```bash
   npm run dev
   ```

2. **Check keyboard capture status:**
   - Right-click the menu bar icon
   - Select "Check Monitoring Status" 
   - Look for "uiohook" mode instead of "iohook"

3. **Verify fallback works:**
   - If uiohook-napi fails to load, the app should automatically use fallback mode
   - No functionality should be lost

### 3. Troubleshooting

**If you see "uiohook-napi not available" warnings:**

1. **Try rebuilding native modules:**
   ```bash
   npm run electron-rebuild
   ```

2. **Clear build cache:**
   ```bash
   rm -rf .vite node_modules/.cache
   npm install
   ```

3. **Check for build tools (macOS):**
   ```bash
   xcode-select --install
   ```

**Common Issues:**

- **Build failures on Apple Silicon:** Make sure you're using the arm64 version of Node.js
- **Permission errors:** Ensure Xcode command line tools are installed
- **Version conflicts:** Clear node_modules and reinstall

### 4. What to Expect

**Improved:**
- ✅ Better Electron 37+ compatibility
- ✅ More stable native module compilation
- ✅ Actively maintained package

**Same functionality:**
- ✅ Keyboard capture works identically
- ✅ Fallback mode unchanged
- ✅ All existing features preserved

## Rollback (if needed)

If you encounter issues, you can temporarily rollback:

```bash
# In package.json, change back to:
"optionalDependencies": {
  "iohook": "^0.9.3"
}

# Then reinstall
npm install
```

However, this will restore the original compatibility issues with modern Electron versions.

## Support

If you encounter issues:

1. Check the application logs in the menu bar → "Open Console (Debug)"
2. Look for error messages related to "uiohook-napi"
3. The app should continue working in fallback mode even if native capture fails

The migration maintains full backward compatibility - if uiohook-napi fails to load, the application automatically falls back to the previous behavior. 