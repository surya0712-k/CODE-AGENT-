import { Public_Sans } from 'next/font/google';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import { ThemeProvider } from '@/components/app/theme-provider';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { cn } from '@/lib/shadcn/utils';
import { getAppConfig, getStyles } from '@/lib/utils';
import '@/styles/globals.css';

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
});

const commitMono = localFont({
  display: 'swap',
  variable: '--font-commit-mono',
  src: [
    {
      path: '../fonts/CommitMono-400-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/CommitMono-700-Regular.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../fonts/CommitMono-400-Italic.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../fonts/CommitMono-700-Italic.otf',
      weight: '700',
      style: 'italic',
    },
  ],
});

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);
  const styles = getStyles(appConfig);
  const { pageTitle, pageDescription, companyName } = appConfig;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        publicSans.variable,
        commitMono.variable,
        'scroll-smooth font-sans antialiased'
      )}
    >
      <head>
        {styles && <style>{styles}</style>}
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
      </head>
      <body className="overflow-x-hidden" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <header className="border-border/40 bg-background/80 fixed top-0 left-0 z-50 flex w-full flex-row items-center justify-between border-b px-4 py-3 backdrop-blur-sm md:px-6">
            <div className="flex items-center gap-2.5">
              <div className="border-primary/25 bg-card flex size-7 items-center justify-center rounded-lg border">
                <span className="text-primary font-mono text-[10px] font-bold">CA</span>
              </div>
              <span className="text-foreground font-mono text-xs font-bold tracking-wider uppercase">
                {companyName}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground hidden text-[10px] md:inline">
                Powered by{' '}
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://livekit.io"
                  className="text-foreground cursor-pointer underline underline-offset-2"
                >
                  LiveKit
                </a>
              </span>
              <ThemeToggle className="hidden w-auto md:flex" />
            </div>
          </header>

          <div className="pt-12">{children}</div>

          <div className="fixed right-4 bottom-4 z-50 md:hidden">
            <ThemeToggle />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
