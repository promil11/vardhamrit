const fs = require('fs');
const path = require('path');

const distHtmlPath = path.resolve(__dirname, '../dist/index.html');

if (!fs.existsSync(distHtmlPath)) {
  console.log('⚠️ dist/index.html not found, skipping responsive CSS injection.');
  process.exit(0);
}

const responsiveCss = `
<!-- Vardhamrit Universal Responsive Engine -->
<style id="vardhamrit-responsive-engine">
  /* 100% PREVENT AUTO-ZOOM ON INPUT FOCUS ACROSS ALL MOBILE BROWSERS */
  input,
  textarea,
  select,
  [contenteditable],
  .css-textinput-11aywtz,
  [data-focusable="true"],
  input[type="text"],
  input[type="number"],
  input[type="email"],
  input[type="tel"],
  input[type="password"],
  input[type="search"] {
    font-size: 16px !important;
    touch-action: manipulation !important;
  }

  /* Prevent double-tap to zoom on interactive elements */
  input, textarea, select, button, [role="button"], a {
    touch-action: manipulation !important;
  }

  /* Enable smooth in-app pull-to-refresh without full-page browser reload */
  html, body, #root {
    overscroll-behavior-y: contain !important;
  }

  /* Ensure bottom navigation tab bar and labels never clip descenders ('g', 'y', 'p', 'q') */
  [role="tablist"], [role="tablist"] *, [role="tab"], [role="tab"] * {
    overflow: visible !important;
  }
  [role="tab"] {
    justify-content: center !important;
  }

  /* Default Text & Input Scaling on Web */
  @media (min-width: 600px) and (max-width: 839px) {
    .css-text-146c3p1 {
      font-size: 17.5px !important;
    }
    .css-textinput-11aywtz {
      font-size: 16px !important;
    }
  }
  @media (min-width: 840px) {
    .css-text-146c3p1 {
      font-size: 19px !important;
    }
    .css-textinput-11aywtz {
      font-size: 17.5px !important;
    }
  }

  /* Global Desktop Frame Alignment */
  @media (min-width: 1024px) {
    body {
      background-color: #EBF3EE;
      display: flex;
      justify-content: center;
    }
    #root {
      max-width: 1024px;
      width: 100%;
      margin: 0 auto;
      box-shadow: 0 0 40px rgba(0, 0, 0, 0.08);
      background-color: #FFFFFF;
      position: relative !important;
      overflow-x: hidden !important;
    }
  }
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
