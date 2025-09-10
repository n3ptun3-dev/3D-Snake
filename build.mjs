import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

// Determine the environment ('testnet' or 'mainnet')
const environment = process.env.NODE_ENV;
if (!environment) {
  console.error("❌ NODE_ENV is not set. Please use 'npm run build:testnet' or 'npm run build:mainnet'.");
  process.exit(1);
}
console.log(`🚀 Building for environment: ${environment}`);

const envFilePath = path.resolve(process.cwd(), `.env.${environment}`);

// Function to parse .env file
const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Environment file not found at: ${filePath}`);
    console.error("Please create it based on the documentation.");
    process.exit(1);
  }
  const envFileContent = fs.readFileSync(filePath, 'utf-8');
  const envars = {};
  envFileContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      // Strip leading/trailing quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      envars[key] = value;
    }
  });
  return envars;
};

// Load environment variables
const envVars = parseEnvFile(envFilePath);
console.log(`✅ Loaded environment variables from .env.${environment}`);

// Create 'defines' for esbuild to replace process.env variables
const defines = {};
for (const key in envVars) {
  defines[`process.env.${key}`] = JSON.stringify(envVars[key]);
}

// Ensure dist directory exists and is clean
const outdir = 'dist';
if (fs.existsSync(outdir)) {
    fs.rmSync(outdir, { recursive: true, force: true });
}
fs.mkdirSync(outdir);
console.log('✅ Cleaned and created dist/ directory');

// Copy public files to dist
fs.readdirSync('public').forEach(file => {
    const source = path.join('public', file);
    const destination = path.join(outdir, file);
    fs.copyFileSync(source, destination);
});
console.log('✅ Copied public assets to dist/');

// esbuild configuration
esbuild.build({
  entryPoints: {
    // Naming the entry point 'bundle' to get 'bundle-HASH.js' as output
    bundle: 'index.tsx' 
  },
  bundle: true,
  outdir: outdir,
  entryNames: '[name]-[hash]', // Use content hashing
  define: defines,
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  sourcemap: true,
  logLevel: 'info',
  metafile: true,
}).then(result => {
  console.log("esbuild finished. Updating index.html...");

  // Get the output JS file name from the metafile
  const outputFiles = Object.keys(result.metafile.outputs);
  const jsFile = outputFiles.find(file => file.startsWith(`${outdir}/bundle-`) && file.endsWith('.js'));
  
  if (!jsFile) {
    console.error('❌ Build error: Could not find the hashed output JS file.');
    process.exit(1);
  }

  const newJsFileName = path.basename(jsFile);
  const indexPath = path.join(outdir, 'index.html');

  try {
    let indexHtmlContent = fs.readFileSync(indexPath, 'utf-8');
    // Replace the placeholder script tag with the new hashed one
    indexHtmlContent = indexHtmlContent.replace(
      /src=".\/bundle\.js"/, 
      `src="./${newJsFileName}"`
    );
    
    fs.writeFileSync(indexPath, indexHtmlContent);
    console.log(`✅ Success! Updated ${indexPath} to use ${newJsFileName}`);
  } catch (error) {
    console.error(`❌ Error updating index.html: ${error.message}`);
    process.exit(1);
  }
}).catch((e) => {
    console.error("esbuild failed:", e);
    process.exit(1);
});