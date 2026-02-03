const { chromium } = require('playwright');
(async () => {
    try {
        console.log('Launching browser...');
        const browser = await chromium.launch();
        const page = await browser.newPage();
        console.log('Navigating to localhost:3000...');
        await page.goto('http://localhost:3000', { timeout: 10000 });
        console.log('Taking screenshot...');
        await page.screenshot({ path: 'C:/Users/BORIVOJE/Desktop/AGENT_VIEW_PROOOF.png' });
        console.log('Screenshot saved to Desktop!');
        await browser.close();
    } catch (e) {
        console.error('Error during capture:', e);
    }
})();
