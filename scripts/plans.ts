/**
 * The price list. Prices are in halalas and exclude VAT.
 *
 * Read by scripts/plans-sync.ts (which brings a running database in line) and
 * by scripts/seed.ts (which seeds a fresh one), so the two can never disagree.
 * Nothing in src/ imports this file: the application reads plans from the
 * database, which is what the billing engine enforces.
 */
export const PLANS = [
  {
    code: 'free', nameAr: 'المجانية', nameEn: 'Free',
    descriptionAr: 'لتجربة المنصة على برنامج واحد بفريق صغير',
    descriptionEn: 'Try the platform on one program with a small team',
    priceMonthly: 0, maxPrograms: 1, maxMembers: 3, maxEnrollments: 50,
    features: ['reports'], sortOrder: 0,
  },
  {
    code: 'basic', nameAr: 'الأساسية', nameEn: 'Basic',
    descriptionAr: 'للجمعيات والمبادرات التي تدير برامج قليلة وتريد سجلاً موثقاً',
    descriptionEn: 'For associations running a few programs that need a defensible record',
    priceMonthly: 49900, maxPrograms: 3, maxMembers: 6, maxEnrollments: 400,
    features: ['reports', 'exports'], sortOrder: 1,
  },
  {
    code: 'growth', nameAr: 'النمو', nameEn: 'Growth',
    descriptionAr: 'للجهات التي تدير عدة برامج في وقت واحد وتقيس أثرها وتربط أنظمتها',
    descriptionEn: 'Several programs at once, with impact measurement and integrations',
    priceMonthly: 149900, maxPrograms: 15, maxMembers: 25, maxEnrollments: 3000,
    features: ['reports', 'exports', 'impact', 'api', 'import', 'assistant'], sortOrder: 2,
  },
  {
    code: 'enterprise', nameAr: 'المؤسسية', nameEn: 'Enterprise',
    descriptionAr: 'للمؤسسات الكبيرة والجهات الحكومية: بلا حدود، دخول موحّد، ومدير حساب مخصص',
    descriptionEn: 'For large foundations and public bodies: uncapped, single sign on, a named account manager',
    priceMonthly: 499900, maxPrograms: -1, maxMembers: -1, maxEnrollments: -1,
    features: ['reports', 'exports', 'impact', 'api', 'import', 'assistant', 'sso', 'messaging', 'support'], sortOrder: 3,
  },
] as const;
