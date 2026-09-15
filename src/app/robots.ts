import type {MetadataRoute} from 'next';

/**
 * Only the public pages are open to crawlers. Everything behind sign in is
 * closed explicitly as well as by authentication, so a stray link in someone's
 * email signature never puts a workspace route in a search index.
 */
export default function robots():MetadataRoute.Robots{
 const base=process.env.APP_URL??'http://127.0.0.1:3000';
 return {
  rules:[{
   userAgent:'*',
   allow:['/ar/welcome','/en/welcome','/ar/pricing','/en/pricing','/ar/contact','/en/contact','/ar/terms','/en/terms','/ar/privacy-policy','/en/privacy-policy'],
   disallow:['/api/','/ar/login','/en/login','/ar/register','/en/register','/ar/verify','/en/verify','/ar/reset','/en/reset','/ar/forgot','/en/forgot','/ar/security','/en/security'],
  }],
  sitemap:`${base}/sitemap.xml`,
 };
}
