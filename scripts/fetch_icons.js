const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const VSIX_URL = 'https://open-vsx.org/api/davidbabel/antigravity-icons-supercharged-blue/0.7.2/file/davidbabel.antigravity-icons-supercharged-blue-0.7.2.vsix';
const VSIX_PATH = path.join(__dirname, '..', 'icons.vsix');
const EXTRACT_DIR = path.join(__dirname, '..', 'temp_icons');
const TARGET_DIR = path.join(__dirname, '..', 'webview', 'assets', 'antigravity-icons');

async function downloadAndExtract() {
    console.log('Downloading Antigravity Icons Supercharged (Blue Version)...');
    try {
        const response = await fetch(VSIX_URL);
        if (!response.ok) throw new Error(`Unexpected response ${response.statusText}`);
        
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(VSIX_PATH, buffer);
        console.log('Download complete. Extracting...');

        execSync(`unzip -o -q "${VSIX_PATH}" -d "${EXTRACT_DIR}"`);
        
        if (!fs.existsSync(TARGET_DIR)) {
            fs.mkdirSync(TARGET_DIR, { recursive: true });
        }

        console.log('Copying icons to webview/assets...');
        const iconsSourceDir = path.join(EXTRACT_DIR, 'extension', 'icons');
        execSync(`cp -r "${iconsSourceDir}/"* "${TARGET_DIR}/"`);

        const iconThemePath = path.join(EXTRACT_DIR, 'extension', 'antigravity-icons-supercharged-blue-icon-theme.json');
        if (fs.existsSync(iconThemePath)) {
            execSync(`cp "${iconThemePath}" "${TARGET_DIR}/"`);
        }

        console.log('Cleaning up temporary files...');
        execSync(`rm -rf "${EXTRACT_DIR}" "${VSIX_PATH}"`);

        console.log('Done! Icons are now in webview/assets/antigravity-icons');
    } catch (err) {
        console.error('Error:', err);
    }
}

downloadAndExtract();
