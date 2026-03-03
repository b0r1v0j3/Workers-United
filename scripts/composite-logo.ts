import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function composite() {
    try {
        const bgPath = 'C:/Users/BORIVOJE/.gemini/antigravity/brain/e1315f90-2066-4189-bf05-14f03995916f/social_promo_no_logo_1772543264189.png';
        const logoPath = 'd:/WORKERS UNITED/public/logo-wordmark.png';
        const outPath = 'C:/Users/BORIVOJE/.gemini/antigravity/brain/e1315f90-2066-4189-bf05-14f03995916f/social_promo_final_with_real_logo.png';

        // Resize logo to width 350
        const logoBuffer = await sharp(logoPath)
            .resize({ width: 350 })
            .toBuffer();

        const bgMeta = await sharp(bgPath).metadata();

        // Center horizontally
        const left = Math.round(((bgMeta.width || 1024) - 350) / 2);
        const top = 760;

        await sharp(bgPath)
            .composite([{ input: logoBuffer, top, left }])
            .toFile(outPath);

        console.log('Successfully composited real logo onto AI image.');
    } catch (err) {
        console.error('Error compositing:', err);
    }
}

composite();
