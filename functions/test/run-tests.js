// Simple test runner to handle TypeScript module issues
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    moduleResolution: 'node',
    skipLibCheck: true
  }
});

// Import and run Mocha programmatically
const Mocha = require('mocha');
const path = require('path');
const glob = require('glob');

const mocha = new Mocha({
  reporter: 'spec',
  timeout: 10000
});

// Add test files
const testFiles = glob.sync('test/**/*.test.ts');
testFiles.forEach(file => {
  mocha.addFile(path.resolve(file));
});

// Run tests
mocha.run(failures => {
  process.exit(failures ? 1 : 0);
});
