import fs from 'fs/promises';
import path from 'path';

const log = (message) => console.log(`[Setup] ${message}`);
const logError = (message) => console.error(`[Setup] ❌ ${message}`);
const logSuccess = (message) => console.log(`[Setup] ✅ ${message}`);

const main = async () => {
  log('Starting local build environment setup...');

  const sourceDir = 'local';
  const destDir = process.cwd();

  const fileMappings = [
    { src: 'build.mjs.txt', dest: 'build.mjs' },
    { src: 'DOTgitignore.txt', dest: '.gitignore' },
    { src: 'DOTenv.testnet.txt', dest: '.env.testnet' },
    { src: 'DOTenv.mainnet.txt', dest: '.env.mainnet' },
    { src: 'DOTenv.local.txt', dest: '.env.local', overwrite: false }, // Don't overwrite if it exists
    { src: 'LICENSE.txt', dest: 'LICENSE' },
  ];

  for (const mapping of fileMappings) {
    const sourcePath = path.join(destDir, sourceDir, mapping.src);
    const destPath = path.join(destDir, mapping.dest);
    const overwrite = mapping.overwrite !== false; // Default to true

    try {
      if (!overwrite) {
        try {
          await fs.access(destPath);
          log(`Skipping: '${mapping.dest}' already exists.`);
          continue; // Skip to next file
        } catch (e) {
          // File doesn't exist, proceed to copy
        }
      }

      await fs.copyFile(sourcePath, destPath);
      logSuccess(`Copied '${sourceDir}/${mapping.src}' to './${mapping.dest}'`);
    } catch (error) {
      logError(`Failed to process '${sourceDir}/${mapping.src}': ${error.message}`);
    }
  }

  log('Setup complete!');
};

main().catch(error => {
  logError('An unexpected error occurred during the setup process:');
  console.error(error);
  process.exit(1);
});
