import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Custom Root HTML template for Expo Router Web.
 * Globally removes focus outline rings and border lines on inputs and buttons.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* 100% Prevent iOS Safari & Mobile Browser Auto-Zoom on Input Focus */
              input,
              textarea,
              select,
              [contenteditable],
              .css-textinput-11aywtz,
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

              /* Remove ugly default browser focus outlines and border lines */
              *:focus,
              *:focus-visible,
              input:focus,
              textarea:focus,
              select:focus,
              button:focus,
              [tabindex]:focus,
              [role="button"]:focus {
                outline: none !important;
                outline-style: none !important;
                outline-width: 0 !important;
                box-shadow: none !important;
                -webkit-tap-highlight-color: transparent !important;
              }
              input, textarea {
                outline: none !important;
                -webkit-appearance: none;
              }

              /* Global Desktop & Large Display Frame Alignment */
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
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
