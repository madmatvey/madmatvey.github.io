#!/usr/bin/env node

/**
 * Postinstall script to patch npm's bundled dependencies
 * This replaces vulnerable packages with fixed versions
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const npmPath = path.join(process.cwd(), 'node_modules/npm');
const patches = [
  {
    name: '@isaacs/brace-expansion',
    targetVersion: '5.0.1',
    targetPath: path.join(npmPath, 'node_modules/@isaacs/brace-expansion')
  },
  {
    name: 'tar',
    targetVersion: '7.5.7',
    targetPath: path.join(npmPath, 'node_modules/tar')
  }
];

if (!fs.existsSync(npmPath)) {
  console.log('npm not found in node_modules, skipping patch');
  process.exit(0);
}

let patched = 0;

patches.forEach(({ name, targetVersion, targetPath }) => {
  if (fs.existsSync(targetPath)) {
    try {
      // Install the fixed version to a temp location
      const tempDir = path.join(process.cwd(), 'node_modules/.temp-patches');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Use npm to install the fixed version
      execSync(`npm pack ${name}@${targetVersion}`, { 
        cwd: tempDir,
        stdio: 'ignore'
      });
      
      const tarballName = name.startsWith('@') 
        ? name.replace('@', '').replace('/', '-') 
        : name;
      const tarball = fs.readdirSync(tempDir).find(f => {
        const baseName = f.replace('.tgz', '');
        return baseName.startsWith(tarballName) && f.endsWith('.tgz');
      });
      if (tarball) {
        // Extract and replace
        execSync(`tar -xzf ${path.join(tempDir, tarball)}`, {
          cwd: tempDir,
          stdio: 'ignore'
        });
        
        const extracted = path.join(tempDir, 'package');
        if (fs.existsSync(extracted)) {
          // Backup original
          if (fs.existsSync(targetPath)) {
            const backup = targetPath + '.backup';
            if (!fs.existsSync(backup)) {
              execSync(`cp -r "${targetPath}" "${backup}"`, { stdio: 'ignore' });
            }
          }
          
          // Replace with fixed version
          execSync(`rm -rf "${targetPath}"`, { stdio: 'ignore' });
          execSync(`cp -r "${extracted}" "${targetPath}"`, { stdio: 'ignore' });
          
          // Ensure package.json has correct version
          const pkgJsonPath = path.join(targetPath, 'package.json');
          if (fs.existsSync(pkgJsonPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
            pkg.version = targetVersion;
            fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
          }
          
          console.log(`✓ Patched ${name} to ${targetVersion}`);
          patched++;
          
          // Cleanup
          execSync(`rm -rf "${tempDir}"`, { stdio: 'ignore' });
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not patch ${name}:`, error.message);
    }
  }
});

if (patched > 0) {
  console.log(`\nPatched ${patched} vulnerable package(s) in npm's bundled dependencies.`);
}
