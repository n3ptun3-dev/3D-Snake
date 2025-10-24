// --- START OF build.mjs ---
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import esbuild from 'esbuild';

const execPromise = promisify(exec);

// --- Environment Variable Driven Configuration ---
// This is now the single source of truth, set by the npm script command.
if (!process.env.APP_ENV || process.env.PI_SANDBOX === undefined) {
  console.error("❌ ERROR: Build script was likely run directly. Please use the npm scripts in package.json:");
  console.error("   - 'npm run build:dummy'   (Testnet, Sandbox ON, Dummy Mode ON)");
  console.error("   - 'npm run build:testnet' (Testnet, Sandbox ON)");
  console.error("   - 'npm run build:mainnet' (Mainnet, Sandbox ON)");
  console.error("   - 'npm run build:live'    (Mainnet, Sandbox OFF)");
  process.exit(1);
}

const environment = process.env.APP_ENV;
const sandboxValueString = process.env.PI_SANDBOX;
const dummyModeValueString = process.env.DUMMY_MODE || 'false';

console.log(`🚀 Building for environment: ${environment}`);

const envFilePath = path.resolve(process.cwd(), `.env.${environment}`);

const parseEnvFile = (filePath) => {
  if (!fsSync.existsSync(filePath)) {
    console.warn(`⚠️ Environment file not found at: ${filePath}. Will use defaults.`);
    return {};
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
  console.log(`✅ Loaded environment variables from .env.${environment}`);
  return envars;
};

const envVarsFromFile = parseEnvFile(envFilePath);

const allEnvKeys = [ 'PI_SANDBOX', 'DUMMY_MODE', 'BACKEND_URL', 'FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_STORAGE_BUCKET', 'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_APP_ID', 'FIREBASE_MEASUREMENT_ID' ];
const requiredMainnetKeys = new Set([ 'FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID' ]);

console.log('📦 Defining environment variables for esbuild...');
const finalEnvVars = {};

// Handle Pi Sandbox and Dummy Mode directly from process.env set by npm scripts
finalEnvVars['PI_SANDBOX'] = sandboxValueString;
if (sandboxValueString === 'false') {
    console.log(`   - 💥 CRITICAL: Building with Sandbox OFF (LIVE MODE).`);
} else {
    console.log(`   - ✅ Building with Sandbox ON.`);
}

finalEnvVars['DUMMY_MODE'] = dummyModeValueString;
if (dummyModeValueString === 'true') {
    console.log(`   - 🔧 Building with Dummy Mode ON.`);
}

// Handle other variables, primarily from files
allEnvKeys.forEach(key => {
    // Skip keys already handled directly from process.env
    if (key === 'PI_SANDBOX' || key === 'DUMMY_MODE') return;

    let value = envVarsFromFile[key];
    finalEnvVars[key] = value;
});

const defines = {};
for (const key of allEnvKeys) {
    let value = finalEnvVars[key];
    if (value === undefined || value === '') {
        if (environment === 'mainnet' && requiredMainnetKeys.has(key)) {
            console.error(`\n❌ CRITICAL BUILD ERROR: Required environment variable '${key}' is missing from .env.mainnet or is empty.`);
            console.error("   Please ensure the key exists and has a value.\n");
            process.exit(1);
        }
        if (value === undefined) {
            console.log(`   - Key '${key}' not found, using empty string default.`);
            value = '';
        }
    }
    defines[`process.env.${key}`] = JSON.stringify(value);
}
const nodeEnvForLibs = 'production';
defines['process.env.NODE_ENV'] = JSON.stringify(nodeEnvForLibs);
defines['process.env.APP_ENV'] = JSON.stringify(environment);
console.log(`   - ✅ Hardcoding APP_ENV: "${environment}"`);
console.log(`   - Injected NODE_ENV for libraries: "${nodeEnvForLibs}"`);
console.log('✅ Environment variables defined.');

// --- Build Process ---
async function build() {
  const distDir = 'dist';
  const buildId = Date.now();
  const bundleFilename = `bundle.${buildId}.js`;
  const bundlePath = `./${distDir}/${bundleFilename}`;

  console.log('Starting build process...');
  
  try {
    console.log(`🧹 Cleaning '${distDir}' directory...`);
    await fs.rm(distDir, { recursive: true, force: true });
    await fs.mkdir(distDir);
    console.log('🎨 Compiling Tailwind CSS...');
    try { await fs.cp(path.resolve(process.cwd(), 'styles.css'), path.join(distDir, 'styles.css')); console.log(`   - Copied 'styles.css'`); } catch (error) { console.error(`Could not copy styles.css:`, error); }
    
    console.log(`📦 Bundling JavaScript to '${bundleFilename}'...`);
    await esbuild.build({
        entryPoints: ['./index.tsx'],
        bundle: true,
        outfile: bundlePath,
        define: defines,
        jsx: 'automatic',
        loader: { '.tsx': 'tsx', '.ts': 'ts' },
        sourcemap: true,
        logLevel: 'info',
        minify: true,
    });
    console.log('✅ JavaScript bundled successfully.');

    console.log('🚚 Processing static assets...');
    try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        if (fsSync.existsSync(indexPath)) {
            let indexContent = await fs.readFile(indexPath, 'utf-8');
            
            const sandboxPlaceholder = `                  // This value is now dynamically replaced by the build script.
                  const isSandbox = true;`;
            const sandboxValueForHtml = finalEnvVars['PI_SANDBOX'] === 'true';
            if (indexContent.includes(sandboxPlaceholder)) {
                indexContent = indexContent.replace(
                    sandboxPlaceholder,
                    `                  // This value is now dynamically replaced by the build script.
                  const isSandbox = ${String(sandboxValueForHtml)};`
                );
                console.log(`   - ✅ Injected 'isSandbox = ${String(sandboxValueForHtml)}' into index.html`);
            } else {
                console.warn(`   - ⚠️ Could not find sandbox placeholder in index.html to replace.`);
            }
            
            const envPlaceholder = `/* SNAKE_ENV_INJECTION_POINT */`;
            const envInjection = `window.SNAKE_BUNDLE_PATH = '/${bundleFilename}';`;
            if (indexContent.includes(envPlaceholder)) {
                indexContent = indexContent.replace(envPlaceholder, envInjection);
                console.log(`   - ✅ Injected bundle path '${bundleFilename}' into index.html`);
            }
            
            const devScriptTag = `<script type="module" src="/index.tsx"></script>`;
            if (indexContent.includes(devScriptTag)) {
                indexContent = indexContent.replace(devScriptTag, '');
                console.log(`   - ✅ Removed development script tag '/index.tsx' for production build.`);
            }

            await fs.writeFile(path.join(distDir, 'index.html'), indexContent);
            console.log(`   - Processed and copied 'index.html'`);
        }
    } catch (error) { console.error(`Error processing index.html:`, error); }
    
    const assetsToCopy = ['audio'];
    for (const asset of assetsToCopy) {
        try {
            const sourcePath = path.resolve(process.cwd(), asset);
            if (fsSync.existsSync(sourcePath)) {
                await fs.cp(sourcePath, path.join(distDir, path.basename(asset)), { recursive: true });
                console.log(`   - Copied '${asset}'`);
            }
        } catch (error) { console.error(`Error copying asset '${asset}':`, error); }
    }

    console.log('⚙️ Generating service worker...');
    try {
        const swTemplatePath = path.resolve(process.cwd(), 'local/sw.template.js');
        const swTemplateContent = await fs.readFile(swTemplatePath, 'utf-8');
        const cacheName = `3d-snake-cache-v${buildId}`;
        
        const newSwContent = swTemplateContent
            .replace('$$CACHE_NAME$$', cacheName)
            .replace('$$BUNDLE_FILENAME$$', `/${bundleFilename}`);

        await fs.writeFile(path.join(distDir, 'sw.js'), newSwContent);
        console.log(`   - Generated 'sw.js' with unique cache name: ${cacheName}`);
    } catch (error) { console.error(`Error generating service worker:`, error); throw error; }

    const validationKeySource = `validation-key-${environment}.txt`;
    try {
        const sourcePath = path.resolve(process.cwd(), validationKeySource);
        if (fsSync.existsSync(sourcePath)) {
            await fs.cp(sourcePath, path.join(distDir, 'validation-key.txt'));
            console.log(`   - Copied '${validationKeySource}' to 'dist/validation-key.txt'`);
        } else { const errorMessage = `CRITICAL: Validation key source file not found: ${validationKeySource}`; console.error(`❌ ${errorMessage}`); throw new Error(errorMessage); }
    } catch (error) { console.error(`Error copying validation key:`, error); throw error; }
    
    console.log('✅ Static assets processed.');
    console.log(`\n🎉 Build complete! Output is in the '${distDir}/' directory.`);
  } catch (error) {
    console.error('\n❌ Build failed:');
    console.error(error.stderr || error.message);
    process.exit(1);
  }
}

build();
// --- END OF build.mjs ---
