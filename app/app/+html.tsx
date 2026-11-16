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
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
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
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
