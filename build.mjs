// --- START OF build.mjs ---
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import esbuild from 'esbuild';

const execPromise = promisify(exec);

// --- Environment Variable Logic ---

const environment = process.env.NODE_ENV;
if (!environment) {
  console.error("❌ NODE_ENV is not set. Please use 'npm run build:testnet' or 'npm run build:mainnet'.");
  process.exit(1);
}
console.log(`🚀 Building for environment: ${environment}`);

const envFilePath = path.resolve(process.cwd(), `.env.${environment}`);

const parseEnvFile = (filePath, env) => {
  if (!fsSync.existsSync(filePath)) {
    console.warn(`⚠️ Environment file not found at: ${filePath}`);
    if (env === 'testnet') {
      console.log('✅ Using hardcoded fallback variables for testnet cloud build.');
      return {
        PI_SANDBOX: 'true',
        BACKEND_URL: 'https://service-3d-snake-945566931016.us-west1.run.app/',
        DUMMY_MODE: 'false',
        FIREBASE_API_KEY: '',
        FIREBASE_AUTH_DOMAIN: '',
        FIREBASE_PROJECT_ID: 'd-snake-7a80a',
        FIREBASE_STORAGE_BUCKET: '',
        FIREBASE_MESSAGING_SENDER_ID: '',
        FIREBASE_APP_ID: '',
        FIREBASE_MEASUREMENT_ID: ''
      };
    }
    console.error(`❌ Mainnet build failed: .env.mainnet file is required and was not found.`);
    process.exit(1);
  }

  const envFileContent = fsSync.readFileSync(filePath, 'utf-8');
  const envars = {};
  envFileContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      envars[key] = value;
    }
  });
  console.log(`✅ Loaded environment variables from .env.${env}`);
  return envars;
};

const envVars = parseEnvFile(envFilePath, environment);

const defines = {};
for (const key in envVars) {
  defines[`process.env.${key}`] = JSON.stringify(envVars[key]);
}

// --- Build Process ---

async function build() {
  const distDir = 'dist';
  console.log('Starting build process...');
  try {
    console.log(`🧹 Cleaning '${distDir}' directory...`);
    await fs.rm(distDir, { recursive: true, force: true });
    await fs.mkdir(distDir);

    console.log('🎨 Compiling Tailwind CSS...');
    const tailwindCmd = `npx tailwindcss -i ./styles.css -o ./${distDir}/styles.css`;
    await execPromise(tailwindCmd);
    console.log('✅ Tailwind CSS compiled successfully.');

    console.log('📦 Bundling JavaScript with esbuild...');
    await esbuild.build({
        entryPoints: ['./index.tsx'],
        bundle: true,
        outfile: `./${distDir}/bundle.js`,
        define: defines,
        jsx: 'automatic',
        loader: { '.tsx': 'tsx', '.ts': 'ts' },
        sourcemap: true,
        logLevel: 'info',
    });
    console.log('✅ JavaScript bundled successfully.');

    console.log('🚚 Copying static assets...');
    const assetsToCopy = ['index.html', 'audio', 'validation-key.txt'];
    for (const asset of assetsToCopy) {
        try {
            const sourcePath = path.resolve(process.cwd(), asset);
            if (fsSync.existsSync(sourcePath)) {
                const destPath = path.join(distDir, path.basename(asset));
                await fs.cp(sourcePath, destPath, { recursive: true });
                console.log(`   - Copied '${asset}'`);
            } else {
                 console.warn(`   - Asset '${asset}' not found, skipping copy.`);
            }
        } catch (error) {
            console.error(`Error copying asset '${asset}':`, error);
        }
    }
    console.log('✅ Static assets copied.');
    console.log(`\n🎉 Build complete! Output is in the '${distDir}/' directory.`);
  } catch (error) {
    console.error('\n❌ Build failed:');
    console.error(error.stderr || error.message);
    process.exit(1);
  }
}

build();
// --- END OF build.mjs ---