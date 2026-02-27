const sharp = require('sharp');
const path = require('path');

sharp(path.join(process.cwd(), 'public', 'logo-new.png'))
    .metadata()
    .then(metadata => {
        // We want the top portion. Let's say top 75% of the height to cut off the bottom text.
        // Also crop the sides to make it a tight square.
        const h = Math.floor(metadata.height * 0.7);
        const w = h; // square 
        const left = Math.floor((metadata.width - w) / 2);
        const top = 0; // start from top to get the handshake

        return sharp(path.join(process.cwd(), 'public', 'logo-new.png'))
            .extract({ left, top, width: w, height: h })
            .toFile(path.join(process.cwd(), 'public', 'logo-cropped.png'));
    })
    .then(() => console.log('Successfully cropped to remove bottom text'))
    .catch(err => console.error(err));
