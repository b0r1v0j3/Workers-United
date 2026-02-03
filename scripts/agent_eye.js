const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function run() {
    const url = process.argv[2];
    if (!url) {
        console.error('Please provide a URL as the first argument.');
        process.exit(1);
    }

    console.log(`👁️ Agent Eye: Opening ${url}...`);

    let browser;
    try {
        browser = await chromium.launch();
        const context = await browser.newContext({
            viewport: { width: 1280, height: 800 }
        });
        const page = await context.newPage();

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const timestamp = Date.now();
        const screenshotName = `agent_view_${timestamp}.png`;
        const artifactDir = process.env.ARTIFACT_DIR || '.';
        const screenshotPath = path.join(artifactDir, screenshotName);

        // Take screenshot
        await page.screenshot({ path: screenshotPath, fullPage: true });

        // Extract title and basic metadata to prove perception
        const info = {
            title: await page.title(),
            url: page.url(),
            timestamp: new Date().toISOString()
        };

        console.log(`✅ CAPTURED: "${info.title}"`);
        console.log(`📸 SCREENSHOT: ${screenshotPath}`);

        // Also save a small metadata file for the agent to read
        const metaPath = path.join(artifactDir, `agent_view_${timestamp}.json`);
        fs.writeFileSync(metaPath, JSON.stringify(info, null, 2));

    } catch (err) {
        console.error(`❌ FAILED TO SEE: ${err.message}`);
    } finally {
        if (browser) await browser.close();
    }
}

run();
