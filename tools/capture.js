const { chromium } = require('playwright');

async function capture() {
    console.log('Launching browser...');
    const browser = await chromium.launch();
    const page = await browser.newPage();

    console.log('Navigating to workersunited.eu...');
    await page.goto('https://www.workersunited.eu/', { waitUntil: 'networkidle' });

    console.log('Taking full page screenshot...');
    // Capture full landing page
    await page.screenshot({ path: 'legacy_site_full.png', fullPage: true });

    // Also capture viewport
    await page.screenshot({ path: 'legacy_site_fold.png' });

    console.log('Done! Saved to legacy_site_full.png and legacy_site_fold.png');
    await browser.close();
}

capture().catch(console.error);
