const fs = require('fs');
const p = 'src/lib/email-templates.ts';
let code = fs.readFileSync(p, 'utf8');

// Replace renderMonochromeHero and renderDarkPanel definitions
// This regex specifically targets the definitions to replace them fully
code = code.replace(
    /function renderMonochromeHero\([\s\S]*?`\n    };\n}\n\nfunction renderDarkPanel[\s\S]*?`\n    };\n}/,
    `function renderIconHero(iconUrl: string, title: string, subtitle: string) {
    return \`
        <div style="text-align: center;">
            <img src="\${iconUrl}" width="80" height="80" alt="" style="margin-bottom: 20px;">
            <h1 style="color:#1D1D1F; font-size: 26px; font-weight: 700; margin: 0 0 10px;">\${title}</h1>
            <p style="font-size: 16px; color: #515154; margin-top: 5px;">\${subtitle}</p>
        </div>
    \`;
}

function renderLightPanel(title: string, bodyHtml: string) {
    return \`
        <div style="background:#F5F5F7; border-radius:12px; padding:32px; margin:35px 0; border: 1px solid #E5E5EA; text-align:center;">
            <h3 style="margin:0 0 15px; font-size:12px; color: #86868B; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">\${escapeHtml(title)}</h3>
            <div style="margin:0; font-size: 15px; color: #1D1D1F; line-height: 1.6;">
                \${bodyHtml}
            </div>
        </div>
    \`;
}`
);

// Global replace renderDarkPanel with renderLightPanel
code = code.replace(/renderDarkPanel/g, 'renderLightPanel');

// Replace renderMonochromeHero usages with mapped icons
// ✓ -> checked / verified
code = code.replace(/renderMonochromeHero\("✓",/g, 'renderIconHero("https://img.icons8.com/ios/100/000000/checked--v1.png",');
// ! -> box-important
code = code.replace(/renderMonochromeHero\("!",/g, 'renderIconHero("https://img.icons8.com/ios/100/000000/box-important--v1.png",');
// $ -> money / dollar
code = code.replace(/renderMonochromeHero\("\\\$",/g, 'renderIconHero("https://img.icons8.com/ios/100/000000/us-dollar-circled--v1.png",');
// i -> info
code = code.replace(/renderMonochromeHero\("i",/g, 'renderIconHero("https://img.icons8.com/ios/100/000000/info--v1.png",');
// × -> cancel
code = code.replace(/renderMonochromeHero\("×",/g, 'renderIconHero("https://img.icons8.com/ios/100/000000/cancel.png",');
// + -> plus / match
code = code.replace(/renderMonochromeHero\("\+",/g, 'renderIconHero("https://img.icons8.com/ios/100/000000/handshake.png",');
// ★ -> star
code = code.replace(/renderMonochromeHero\("★",/g, 'renderIconHero("https://img.icons8.com/ios/100/000000/star--v1.png",');

// Replace the Profile Complete custom hardcoded hero
code = code.replace(
    /\s*<div style="text-align: center;">\s*<img src="https:\/\/img\.icons8\.com\/ios\/100\/000000\/verified-account\.png" width="80" height="80" alt="Verified" style="margin-bottom: 20px;">\s*<h1 style="color:#1D1D1F; font-size: 26px; font-weight: 700; margin: 0 0 10px;">Congratulations, \$\{firstName\}!<\/h1>\s*<p style="font-size: 16px; color: #515154; margin-top: 5px;">Your profile is now 100% complete\.<\/p>\s*<\/div>/,
    `\n                    \$\{renderIconHero("https://img.icons8.com/ios/100/000000/verified-account.png", \`Congratulations, \$\{firstName}!\`, "Your profile is now 100% complete.")\}`
);

fs.writeFileSync(p, code, 'utf8');
console.log('Template update completed.');
