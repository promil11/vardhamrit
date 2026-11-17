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
                }
              }

              /* Tablet Viewports (600px - 839px): Universal Text & Line Height Alignment */
              @media (min-width: 600px) and (max-width: 839px) {
                .r-fontSize-15doi1v { font-size: 8.8px !important; }
                .r-fontSize-7k9ea4 { font-size: 9.4px !important; }
                .r-fontSize-1armvtb { font-size: 10px !important; }
                .r-fontSize-1umgglz { font-size: 10.6px !important; }
                .r-fontSize-qqjak8 { font-size: 11.3px !important; }
                .r-fontSize-1exf2r { font-size: 11.9px !important; }
                .r-fontSize-10x49cs { font-size: 12.5px !important; }
                .r-fontSize-1ozpbmi { font-size: 13.1px !important; }
                .r-fontSize-1gkfh8e { font-size: 13.8px !important; }
                .r-fontSize-1ws2f5x { font-size: 14.4px !important; }
                .r-fontSize-1enofrn { font-size: 15px !important; }
                .r-fontSize-1grwqd5 { font-size: 15.6px !important; }
                .r-fontSize-n6v787 { font-size: 16.3px !important; }
                .r-fontSize-vbi3md { font-size: 16.9px !important; }
                .r-fontSize-1b43r93 { font-size: 17.5px !important; }
                .r-fontSize-1diydf2 { font-size: 18.1px !important; }
                .r-fontSize-a023e6 { font-size: 18.8px !important; }
                .r-fontSize-1asdmkh { font-size: 19.4px !important; }
                .r-fontSize-ubezar { font-size: 20px !important; }
                .r-fontSize-g2gp47 { font-size: 20.6px !important; }
                .r-fontSize-1inkyih { font-size: 21.3px !important; }
                .r-fontSize-16if4en { font-size: 21.9px !important; }
                .r-fontSize-1i10wst { font-size: 22.5px !important; }
                .r-fontSize-zsx22o { font-size: 23.1px !important; }
                .r-fontSize-1b6yd1w { font-size: 23.8px !important; }
                .r-fontSize-gets1z { font-size: 24.4px !important; }
                .r-fontSize-adyw6z { font-size: 25px !important; }
                .r-fontSize-cv4lhi { font-size: 26.3px !important; }
                .r-fontSize-evnaw { font-size: 27.5px !important; }
                .r-fontSize-1blvdjr { font-size: 28.8px !important; }
                .r-fontSize-1x35g6 { font-size: 30px !important; }
                .r-fontSize-h1js2l { font-size: 31.3px !important; }
                .r-fontSize-yy2aun { font-size: 32.5px !important; }
                .r-fontSize-198d08l { font-size: 33.8px !important; }
                .r-fontSize-zz5t5d { font-size: 35px !important; }
                .r-fontSize-1ra0lkn { font-size: 37.5px !important; }
                .r-fontSize-1ui5ee8 { font-size: 40px !important; }
                .r-fontSize-uho16t { font-size: 42.5px !important; }
                .r-fontSize-3i2nvb { font-size: 45px !important; }
                .r-fontSize-xb2eav { font-size: 50px !important; }

                /* Line Heights */
                .r-lineHeight-56xrmm { line-height: 15px !important; }
                .r-lineHeight-1akm30i { line-height: 16.3px !important; }
                .r-lineHeight-1f529hi { line-height: 17.5px !important; }
                .r-lineHeight-fxxt2n { line-height: 18.8px !important; }
                .r-lineHeight-1cwl3u0 { line-height: 20px !important; }
                .r-lineHeight-5fcqz0 { line-height: 21.3px !important; }
                .r-lineHeight-14yzgew { line-height: 22.5px !important; }
                .r-lineHeight-hjklzo { line-height: 23.8px !important; }
                .r-lineHeight-rjixqe { line-height: 25px !important; }
                .r-lineHeight-10yl4k { line-height: 26.3px !important; }
                .r-lineHeight-hbpseb { line-height: 27.5px !important; }
                .r-lineHeight-7ptqe7 { line-height: 28.8px !important; }
                .r-lineHeight-135wba7 { line-height: 30px !important; }
                .r-lineHeight-waer2z { line-height: 31.3px !important; }
                .r-lineHeight-eaezby { line-height: 32.5px !important; }
                .r-lineHeight-vrz42v { line-height: 35px !important; }
                .r-lineHeight-17rnw9f { line-height: 37.5px !important; }
                .r-lineHeight-37tt59 { line-height: 40px !important; }
                .r-lineHeight-2agvir { line-height: 42.5px !important; }
                .r-lineHeight-xnfwke { line-height: 47.5px !important; }
                .r-lineHeight-1gvhk8w { line-height: 52.5px !important; }
              }

              /* Large Tablet / iPad Pro / Desktop (>= 840px): Universal Text & Line Height Alignment */
              @media (min-width: 840px) {
                .r-fontSize-15doi1v { font-size: 9.7px !important; }
                .r-fontSize-7k9ea4 { font-size: 10.4px !important; }
                .r-fontSize-1armvtb { font-size: 11px !important; }
                .r-fontSize-1umgglz { font-size: 11.7px !important; }
                .r-fontSize-qqjak8 { font-size: 12.4px !important; }
                .r-fontSize-1exf2r { font-size: 13.1px !important; }
                .r-fontSize-10x49cs { font-size: 13.8px !important; }
                .r-fontSize-1ozpbmi { font-size: 14.5px !important; }
                .r-fontSize-1gkfh8e { font-size: 15.2px !important; }
                .r-fontSize-1ws2f5x { font-size: 15.9px !important; }
                .r-fontSize-1enofrn { font-size: 16.6px !important; }
                .r-fontSize-1grwqd5 { font-size: 17.3px !important; }
                .r-fontSize-n6v787 { font-size: 17.9px !important; }
                .r-fontSize-vbi3md { font-size: 18.6px !important; }
                .r-fontSize-1b43r93 { font-size: 19.3px !important; }
                .r-fontSize-1diydf2 { font-size: 20px !important; }
                .r-fontSize-a023e6 { font-size: 20.7px !important; }
                .r-fontSize-1asdmkh { font-size: 21.4px !important; }
                .r-fontSize-ubezar { font-size: 22.1px !important; }
                .r-fontSize-g2gp47 { font-size: 22.8px !important; }
                .r-fontSize-1inkyih { font-size: 23.5px !important; }
                .r-fontSize-16if4en { font-size: 24.2px !important; }
                .r-fontSize-1i10wst { font-size: 24.8px !important; }
                .r-fontSize-zsx22o { font-size: 25.5px !important; }
                .r-fontSize-1b6yd1w { font-size: 26.2px !important; }
                .r-fontSize-gets1z { font-size: 26.9px !important; }
                .r-fontSize-adyw6z { font-size: 27.6px !important; }
                .r-fontSize-cv4lhi { font-size: 29px !important; }
                .r-fontSize-evnaw { font-size: 30.4px !important; }
                .r-fontSize-1blvdjr { font-size: 31.7px !important; }
                .r-fontSize-1x35g6 { font-size: 33.1px !important; }
                .r-fontSize-h1js2l { font-size: 34.5px !important; }
                .r-fontSize-yy2aun { font-size: 35.9px !important; }
                .r-fontSize-198d08l { font-size: 37.3px !important; }
                .r-fontSize-zz5t5d { font-size: 38.6px !important; }
                .r-fontSize-1ra0lkn { font-size: 41.4px !important; }
                .r-fontSize-1ui5ee8 { font-size: 44.2px !important; }
                .r-fontSize-uho16t { font-size: 46.9px !important; }
                .r-fontSize-3i2nvb { font-size: 49.7px !important; }
                .r-fontSize-xb2eav { font-size: 55.2px !important; }

                /* Line Heights */
                .r-lineHeight-56xrmm { line-height: 16.6px !important; }
                .r-lineHeight-1akm30i { line-height: 17.9px !important; }
                .r-lineHeight-1f529hi { line-height: 19.3px !important; }
                .r-lineHeight-fxxt2n { line-height: 20.7px !important; }
                .r-lineHeight-1cwl3u0 { line-height: 22.1px !important; }
                .r-lineHeight-5fcqz0 { line-height: 23.5px !important; }
                .r-lineHeight-14yzgew { line-height: 24.8px !important; }
                .r-lineHeight-hjklzo { line-height: 26.2px !important; }
                .r-lineHeight-rjixqe { line-height: 27.6px !important; }
                .r-lineHeight-10yl4k { line-height: 29px !important; }
                .r-lineHeight-hbpseb { line-height: 30.4px !important; }
                .r-lineHeight-7ptqe7 { line-height: 31.7px !important; }
                .r-lineHeight-135wba7 { line-height: 33.1px !important; }
                .r-lineHeight-waer2z { line-height: 34.5px !important; }
                .r-lineHeight-eaezby { line-height: 35.9px !important; }
                .r-lineHeight-vrz42v { line-height: 38.6px !important; }
                .r-lineHeight-17rnw9f { line-height: 41.4px !important; }
                .r-lineHeight-37tt59 { line-height: 44.2px !important; }
                .r-lineHeight-2agvir { line-height: 46.9px !important; }
                .r-lineHeight-xnfwke { line-height: 52.4px !important; }
                .r-lineHeight-1gvhk8w { line-height: 58px !important; }
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
