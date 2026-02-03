const { chromium } = require('playwright');
const path = require('path');

async function run() {
    console.log('Starting browser...');
    const browser = await chromium.launch();
    const page = await browser.newPage();

    const url = process.argv[2] || 'http://localhost:3000';
    console.log(`Navigating to ${url}...`);

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        const timestamp = Date.now();
        const screenshotPath = path.join(process.env.ARTIFACT_DIR || '.', `manual_capture_${timestamp}.png`);

        console.log(`Taking screenshot: ${screenshotPath}`);
        await page.screenshot({ path: screenshotPath, fullPage: true });

        console.log(`Successfully captured ${url}`);
    } catch (err) {
        console.error(`Failed to capture: ${err.message}`);
    } finally {
        await browser.close();
    }
}

run();
