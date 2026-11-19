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

              /* Tablet (600px - 839px): Universal Normalized Typography Scale */
              @media (min-width: 600px) and (max-width: 839px) {
                /* Tier 1: Micro Badges, Tags & Captions (Min readable 13px) */
                .r-fontSize-15doi1v { font-size: 13px !important; }
                .r-fontSize-7k9ea4 { font-size: 13px !important; }
                .r-fontSize-1armvtb { font-size: 13px !important; }
                .r-fontSize-1umgglz { font-size: 13px !important; }
                .r-fontSize-qqjak8 { font-size: 13.5px !important; }
                .r-fontSize-1exf2r { font-size: 13.5px !important; }
                .r-fontSize-10x49cs { font-size: 13.5px !important; }

                /* Tier 2: Secondary Text, Subtitles & Ratings */
                .r-fontSize-1ozpbmi { font-size: 15px !important; }
                .r-fontSize-1gkfh8e { font-size: 15px !important; }
                .r-fontSize-1ws2f5x { font-size: 15px !important; }
                .r-fontSize-1enofrn { font-size: 15.5px !important; }
                .r-fontSize-1grwqd5 { font-size: 15.5px !important; }

                /* Tier 3: Body Text, Pack Sizes, Variants & Buttons */
                .r-fontSize-n6v787 { font-size: 16.5px !important; }
                .r-fontSize-vbi3md { font-size: 16.5px !important; }
                .r-fontSize-1b43r93 { font-size: 17.5px !important; }
                .r-fontSize-1diydf2 { font-size: 17.5px !important; }
                .r-fontSize-a023e6 { font-size: 18.5px !important; }
                .r-fontSize-1asdmkh { font-size: 18.5px !important; }

                /* Tier 4: Section Headers & Card Titles */
                .r-fontSize-ubezar { font-size: 20px !important; }
                .r-fontSize-g2gp47 { font-size: 20px !important; }
                .r-fontSize-1inkyih { font-size: 22px !important; }
                .r-fontSize-16if4en { font-size: 22px !important; }
                .r-fontSize-1i10wst { font-size: 22px !important; }
                .r-fontSize-zsx22o { font-size: 22px !important; }

                /* Tier 5: Major Headings & Selling Prices */
                .r-fontSize-1b6yd1w { font-size: 24px !important; }
                .r-fontSize-gets1z { font-size: 24px !important; }
                .r-fontSize-adyw6z { font-size: 24px !important; }
                .r-fontSize-cv4lhi { font-size: 26px !important; }
                .r-fontSize-evnaw { font-size: 26px !important; }
                .r-fontSize-1blvdjr { font-size: 26px !important; }

                /* Tier 6: Large Banners & Display */
                .r-fontSize-1x35g6 { font-size: 28px !important; }
                .r-fontSize-h1js2l { font-size: 28px !important; }
                .r-fontSize-yy2aun { font-size: 30px !important; }
                .r-fontSize-198d08l { font-size: 30px !important; }
                .r-fontSize-zz5t5d { font-size: 32px !important; }
                .r-fontSize-1ra0lkn { font-size: 34px !important; }
                .r-fontSize-1ui5ee8 { font-size: 38px !important; }
                .r-fontSize-uho16t { font-size: 40px !important; }
                .r-fontSize-3i2nvb { font-size: 44px !important; }
                .r-fontSize-xb2eav { font-size: 48px !important; }

                /* Proportional Line Heights */
                .r-lineHeight-56xrmm { line-height: 18px !important; }
                .r-lineHeight-1akm30i { line-height: 18px !important; }
                .r-lineHeight-1f529hi { line-height: 18px !important; }
                .r-lineHeight-fxxt2n { line-height: 19px !important; }
                .r-lineHeight-1cwl3u0 { line-height: 21px !important; }
                .r-lineHeight-5fcqz0 { line-height: 21px !important; }
                .r-lineHeight-14yzgew { line-height: 24px !important; }
                .r-lineHeight-hjklzo { line-height: 24px !important; }
                .r-lineHeight-rjixqe { line-height: 25px !important; }
                .r-lineHeight-10yl4k { line-height: 27px !important; }
                .r-lineHeight-hbpseb { line-height: 28px !important; }
                .r-lineHeight-7ptqe7 { line-height: 28px !important; }
                .r-lineHeight-135wba7 { line-height: 29px !important; }
                .r-lineHeight-waer2z { line-height: 30px !important; }
                .r-lineHeight-eaezby { line-height: 32px !important; }
                .r-lineHeight-vrz42v { line-height: 34px !important; }
                .r-lineHeight-17rnw9f { line-height: 36px !important; }
                .r-lineHeight-37tt59 { line-height: 40px !important; }
                .r-lineHeight-2agvir { line-height: 42px !important; }
                .r-lineHeight-xnfwke { line-height: 46px !important; }
                .r-lineHeight-1gvhk8w { line-height: 52px !important; }
              }

              /* Large Tablet & Desktop (>= 840px): Universal Normalized Typography Scale */
              @media (min-width: 840px) {
                /* Tier 1: Micro Badges, Tags & Captions (Min readable 14px) */
                .r-fontSize-15doi1v { font-size: 14px !important; }
                .r-fontSize-7k9ea4 { font-size: 14px !important; }
                .r-fontSize-1armvtb { font-size: 14px !important; }
                .r-fontSize-1umgglz { font-size: 14px !important; }
                .r-fontSize-qqjak8 { font-size: 14.5px !important; }
                .r-fontSize-1exf2r { font-size: 14.5px !important; }
                .r-fontSize-10x49cs { font-size: 14.5px !important; }

                /* Tier 2: Secondary Text, Subtitles & Ratings */
                .r-fontSize-1ozpbmi { font-size: 16px !important; }
                .r-fontSize-1gkfh8e { font-size: 16px !important; }
                .r-fontSize-1ws2f5x { font-size: 16px !important; }
                .r-fontSize-1enofrn { font-size: 17px !important; }
                .r-fontSize-1grwqd5 { font-size: 17px !important; }

                /* Tier 3: Body Text, Pack Sizes, Variants & Buttons */
                .r-fontSize-n6v787 { font-size: 18px !important; }
                .r-fontSize-vbi3md { font-size: 18px !important; }
                .r-fontSize-1b43r93 { font-size: 19px !important; }
                .r-fontSize-1diydf2 { font-size: 19px !important; }
                .r-fontSize-a023e6 { font-size: 20.5px !important; }
                .r-fontSize-1asdmkh { font-size: 20.5px !important; }

                /* Tier 4: Section Headers & Card Titles */
                .r-fontSize-ubezar { font-size: 22px !important; }
                .r-fontSize-g2gp47 { font-size: 22px !important; }
                .r-fontSize-1inkyih { font-size: 24px !important; }
                .r-fontSize-16if4en { font-size: 24px !important; }
                .r-fontSize-1i10wst { font-size: 24px !important; }
                .r-fontSize-zsx22o { font-size: 24px !important; }

                /* Tier 5: Major Headings & Selling Prices */
                .r-fontSize-1b6yd1w { font-size: 26px !important; }
                .r-fontSize-gets1z { font-size: 26px !important; }
                .r-fontSize-adyw6z { font-size: 26px !important; }
                .r-fontSize-cv4lhi { font-size: 28px !important; }
                .r-fontSize-evnaw { font-size: 28px !important; }
                .r-fontSize-1blvdjr { font-size: 28px !important; }

                /* Tier 6: Large Banners & Display */
                .r-fontSize-1x35g6 { font-size: 31px !important; }
                .r-fontSize-h1js2l { font-size: 31px !important; }
                .r-fontSize-yy2aun { font-size: 33px !important; }
                .r-fontSize-198d08l { font-size: 33px !important; }
                .r-fontSize-zz5t5d { font-size: 36px !important; }
                .r-fontSize-1ra0lkn { font-size: 38px !important; }
                .r-fontSize-1ui5ee8 { font-size: 42px !important; }
                .r-fontSize-uho16t { font-size: 44px !important; }
                .r-fontSize-3i2nvb { font-size: 48px !important; }
                .r-fontSize-xb2eav { font-size: 54px !important; }

                /* Proportional Line Heights */
                .r-lineHeight-56xrmm { line-height: 20px !important; }
                .r-lineHeight-1akm30i { line-height: 20px !important; }
                .r-lineHeight-1f529hi { line-height: 20px !important; }
                .r-lineHeight-fxxt2n { line-height: 21px !important; }
                .r-lineHeight-1cwl3u0 { line-height: 23px !important; }
                .r-lineHeight-5fcqz0 { line-height: 23px !important; }
                .r-lineHeight-14yzgew { line-height: 26px !important; }
                .r-lineHeight-hjklzo { line-height: 26px !important; }
                .r-lineHeight-rjixqe { line-height: 27px !important; }
                .r-lineHeight-10yl4k { line-height: 29px !important; }
                .r-lineHeight-hbpseb { line-height: 30px !important; }
                .r-lineHeight-7ptqe7 { line-height: 30px !important; }
                .r-lineHeight-135wba7 { line-height: 31px !important; }
                .r-lineHeight-waer2z { line-height: 32px !important; }
                .r-lineHeight-eaezby { line-height: 34px !important; }
                .r-lineHeight-vrz42v { line-height: 36px !important; }
                .r-lineHeight-17rnw9f { line-height: 38px !important; }
                .r-lineHeight-37tt59 { line-height: 42px !important; }
                .r-lineHeight-2agvir { line-height: 44px !important; }
                .r-lineHeight-xnfwke { line-height: 48px !important; }
                .r-lineHeight-1gvhk8w { line-height: 54px !important; }
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
