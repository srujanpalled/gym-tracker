import electronInstaller from 'electron-winstaller';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function build() {
  try {
    console.log('Generating Installer...');
    await electronInstaller.createWindowsInstaller({
      appDirectory: path.resolve(__dirname, './dist_electron/ GYM MANAGEMENT-win32-x64'),
      outputDirectory: path.resolve(__dirname, './make'),
      authors: 'GYM MANAGEMENT',
      exe: 'GYM MANAGEMENT.exe',
      setupExe: 'GYM MANAGEMENT.exe',
      description: 'Gym Management Software',
      noMsi: true,
      setupIcon: undefined
    });
    console.log('Installer generated successfully.');
  } catch (e) {
    console.log(`Error generating installer: ${e.message}`);
  }
}

build();
