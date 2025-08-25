import esbuild from 'esbuild';
import fs from 'fs';

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

// esbuild configuration
esbuild.build({
  entryPoints: ['index.tsx'],
  bundle: true,
  outfile: 'dist/bundle.js',
  define: defines,
  jsx: 'automatic',
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts'
  },
  sourcemap: true,
  logLevel: 'info',
}).catch((e) => {
    console.error("esbuild failed:", e);
    process.exit(1);
});