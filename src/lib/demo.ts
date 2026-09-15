/** Shared between the seed script and the sign-in screen so they never drift. */
export const DEMO_PASSWORD = 'Demo@12345';

export const DEMO_ACCOUNTS = [
  { email: 'admin@programos.sa', role: 'Admin', name: 'ريم العتيبي' },
  { email: 'manager@programos.sa', role: 'Manager', name: 'خالد الزهراني' },
  { email: 'coordinator@programos.sa', role: 'Coordinator', name: 'نورة القحطاني' },
  { email: 'reviewer@programos.sa', role: 'Reviewer', name: 'سلمان الدوسري' },
  { email: 'impact@programos.sa', role: 'Impact', name: 'هند الشمري' },
  { email: 'viewer@programos.sa', role: 'Viewer', name: 'ماجد الحربي' },
  { email: 'beneficiary@programos.sa', role: 'Beneficiary', name: 'عبدالله الغامدي' },
] as const;

/** The sign-in screen only offers these when the workspace was seeded for a demo. */
export function demoLoginEnabled() {
  return process.env.DEMO_LOGIN === '1';
}
