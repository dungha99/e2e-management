import './globals.css'
import { Providers } from '@/components/providers'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Vucar E2E',
  description: 'Vucar E2E Management System',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Vucar E2E',
  },
  icons: {
    icon: '/icon-192x192.png',
    apple: '/icon-192x192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#1a9fea',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <Providers>{children}</Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var APP_VERSION = '2026-01-08-v2';
                var CACHE_KEY = 'e2e-app-version';
                var storedVersion = localStorage.getItem(CACHE_KEY);
                
                if (storedVersion !== APP_VERSION) {
                  console.log('[CacheBuster] Version mismatch. Clearing caches...');
                  localStorage.setItem(CACHE_KEY, APP_VERSION);
                  
                  // Clear service worker caches
                  if ('caches' in window) {
                    caches.keys().then(function(names) {
                      names.forEach(function(name) {
                        console.log('[CacheBuster] Deleting cache:', name);
                        caches.delete(name);
                      });
                    });
                  }
                  
                  // Unregister service workers
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(function(registrations) {
                      registrations.forEach(function(registration) {
                        console.log('[CacheBuster] Unregistering service worker');
                        registration.unregister();
                      });
                    });
                  }
                  
                  // Only reload if this wasn't the first load (avoid infinite loop)
                  if (storedVersion !== null) {
                    console.log('[CacheBuster] Reloading page...');
                    setTimeout(function() {
                      window.location.reload(true);
                    }, 500);
                  }
                }
              })();

              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('ServiceWorker registration successful');
                    },
                    function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
