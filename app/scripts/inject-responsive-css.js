const fs = require('fs');
const path = require('path');

const distHtmlPath = path.resolve(__dirname, '../dist/index.html');

if (!fs.existsSync(distHtmlPath)) {
  console.log('⚠️ dist/index.html not found, skipping responsive CSS injection.');
  process.exit(0);
}

const engineCss = fs.readFileSync(path.resolve(__dirname, 'responsive-engine.css'), 'utf8');

const responsiveCss = `
<!-- Vardhamrit Universal Responsive Engine -->
<style id="vardhamrit-responsive-engine">
${engineCss}
</style>
`;

let html = fs.readFileSync(distHtmlPath, 'utf8');

// Ensure viewport meta tag disables auto-zoom on mobile focus
html = html.replace(
  /<meta name="viewport"[^>]*>/i,
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no, viewport-fit=cover" />'
);

// Replace existing injected block if present, or add before </head>
if (html.includes('id="vardhamrit-responsive-engine"')) {
  html = html.replace(/<!-- Vardhamrit Universal Responsive Engine -->[\s\S]*?<\/style>/, responsiveCss.trim());
  fs.writeFileSync(distHtmlPath, html, 'utf8');
  console.log('🔄 Successfully updated Vardhamrit Universal Responsive Engine in dist/index.html');
} else {
  html = html.replace('</head>', `${responsiveCss}\n</head>`);
  fs.writeFileSync(distHtmlPath, html, 'utf8');
  console.log('✅ Successfully injected Vardhamrit Universal Responsive Engine into dist/index.html');
}
