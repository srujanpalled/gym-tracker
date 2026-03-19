const { execSync } = require('child_process');

try {
  console.log('Running cap init...');
  execSync('npx cap init "SIMPLE SAAS" com.simplesaas.app --web-dir dist', { stdio: 'inherit', shell: true });
  console.log('Running cap add android...');
  execSync('npx cap add android', { stdio: 'inherit', shell: true });
  console.log('Running cap sync android...');
  execSync('npx cap sync android', { stdio: 'inherit', shell: true });
} catch (e) {
  console.error("Error:", e);
  process.exit(1);
}
