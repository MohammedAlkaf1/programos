import { NextResponse, type NextRequest } from 'next/server';
import { locales, defaultLocale } from '@/i18n/dictionary';

const PUBLIC_FILE = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest|glb|pdf|css|js|woff2?)$/i;

/**
 * Whether this browser is carrying a session at all.
 *
 * Deliberately only a presence check, never a trust decision: it decides which
 * page to show at the root and nothing else. Every page and command behind it
 * still resolves the real actor from the database, so a forged cookie buys a
 * visitor the dashboard route and an immediate redirect back to sign in.
 */
function hasSession(request: NextRequest) {
  return ['authjs.session-token', '__Secure-authjs.session-token'].some((name) =>
    Boolean(request.cookies.get(name)?.value),
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/docs/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  if (hasLocale) {
    // The root of a language is two different pages depending on who is asking:
    // the dashboard for someone signed in, the public home for everyone else.
    // A rewrite rather than a redirect, so the marketing home keeps the short
    // address people actually share.
    const isLocaleRoot = locales.some((locale) => pathname === `/${locale}`);
    if (isLocaleRoot && !hasSession(request)) {
      const url = request.nextUrl.clone();
      url.pathname = `${pathname}/welcome`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  const cookieLocale = request.cookies.get('programos.locale')?.value;
  const preferred =
    cookieLocale && locales.includes(cookieLocale as (typeof locales)[number])
      ? cookieLocale
      : defaultLocale;

  const url = request.nextUrl.clone();
  url.pathname = `/${preferred}${pathname === '/' ? '' : pathname}`;
  url.search = search;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
