import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { sessionIsUsable } from '@/lib/session-state';
import { db } from '@/lib/db';
import { getDictionary, isLocale, type Locale } from '@/i18n/dictionary';
import { SignupForm } from '@/components/views/signup-form';
import { AcceptInvitation } from '@/components/views/account-forms';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: getDictionary(isLocale(locale) ? locale : 'ar').signup.title };
}

/**
 * One route, two doors: with `?invitation=…` it accepts a team invitation,
 * without it, a new organization signs itself up.
 */
export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ invitation?: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'ar';

  // Same guard as the sign-in page: a cookie alone is not proof of an account.
  const session = await auth();
  if (session?.user?.id && (await sessionIsUsable())) redirect(`/${locale}`);

  const { invitation } = await searchParams;
  if (invitation) {
    return (
      <Suspense>
        <AcceptInvitation locale={locale} />
      </Suspense>
    );
  }

  const plans = await db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });

  return (
    <Suspense>
      <SignupForm
        locale={locale}
        plans={plans.map((plan) => ({
          code: plan.code,
          nameAr: plan.nameAr,
          nameEn: plan.nameEn,
          descriptionAr: plan.descriptionAr,
          descriptionEn: plan.descriptionEn,
          priceMonthly: plan.priceMonthly,
          currency: plan.currency,
          maxPrograms: plan.maxPrograms,
          maxMembers: plan.maxMembers,
          maxEnrollments: plan.maxEnrollments,
          features: plan.features,
        }))}
      />
    </Suspense>
  );
}
