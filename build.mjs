import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

// Function to parse .env file
const parseEnvFile = (filePath) => {
  const envFileContent = fs.readFileSync(filePath, 'utf-8');
  const envars = {};
  envFileContent.split('\n').forEach(line => {
    // This regex handles keys and values, stripping optional quotes from values
    const match = line.match(/^\s*([\w.-]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match) {
      const key = match[1];
      const value = match[2] || '';
      envars[key] = value;
    }
  });
  return envars;
};

// Load environment variables from .env.local
let envVars = {};
try {
  if (fs.existsSync('.env.local')) {
    envVars = parseEnvFile('.env.local');
    console.log("Loaded environment variables from .env.local");
  } else {
    console.warn(".env.local file not found. Build will proceed without injected environment variables.");
  }
} catch (error) {
  console.warn("Could not read .env.local file, proceeding without it.", error);
}

// Create 'defines' for esbuild to replace process.env variables
const defines = {};
for (const key in envVars) {
  defines[`process.env.${key}`] = JSON.stringify(envVars[key]);
}

console.log("Starting esbuild...");

// esbuild configuration
esbuild.build({
  entryPoints: {
    bundle: 'index.tsx' // Use an entry point map to control the output filename part
  },
  bundle: true,
  outdir: 'dist',
  entryNames: '[name]-[hash]', // Use content hashing for cache busting
  define: defines,
  jsx: 'automatic',
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts'
  },
  sourcemap: true,
  logLevel: 'info',
  metafile: true, // We need the metafile to find out the hashed filename
}).then(result => {
  console.log("esbuild finished. Updating index.html...");

  // Get the output JS file name from the metafile
  const outputFiles = Object.keys(result.metafile.outputs);
  const jsFile = outputFiles.find(file => file.startsWith('dist/bundle-') && file.endsWith('.js'));
  
  if (!jsFile) {
    console.error('Build error: Could not find the hashed output JS file in the metafile.');
    process.exit(1);
  }

  const newJsFileName = path.basename(jsFile);
  const indexPath = path.join('dist', 'index.html');

  try {
    let indexHtmlContent = fs.readFileSync(indexPath, 'utf-8');
    
    // Replace the placeholder script tag with the new hashed one
    // The placeholder in public/index.html is src="./bundle.js"
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