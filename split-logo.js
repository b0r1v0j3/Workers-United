const sharp = require('sharp');
const path = require('path');

const input = path.join(process.cwd(), 'public', 'logo-new.png');

async function run() {
    // First trim whitespace from the original
    const { data, info } = await sharp(input)
        .trim()
        .toBuffer({ resolveWithObject: true });

    console.log('Trimmed:', info.width, 'x', info.height);

    // Cut at 55% to get ONLY the hands, no text at all
    const handsHeight = Math.floor(info.height * 0.55);
    console.log('Cutting hands at height:', handsHeight, 'of', info.height);

    await sharp(data)
        .extract({ left: 0, top: 0, width: info.width, height: handsHeight })
        .trim()
        .toFile(path.join(process.cwd(), 'public', 'logo-hands.png'));

    console.log('logo-hands.png saved (hands only, no text)');
}
run().catch(e => console.error(e));
