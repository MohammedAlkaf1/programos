import {
  Plug,
  Sparkles,
  LayoutDashboard,
  FolderKanban,
  FileText,
  CalendarCheck,
  CreditCard,
  TrendingUp,
  BarChart3,
  Users,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/lib/domain';
import type { Dictionary } from '@/i18n/dictionary';

export type NavItem = {
  href: string;
  key: keyof Dictionary['nav'];
  icon: LucideIcon;
  roles: Role[];
  section: 'work' | 'insight' | 'admin';
};

const everyone: Role[] = [
  'Admin',
  'Manager',
  'Coordinator',
  'Reviewer',
  'Impact',
  'Viewer',
  'Beneficiary',
];

export const navItems: NavItem[] = [
  { href: '', key: 'overview', icon: LayoutDashboard, roles: everyone, section: 'work' },
  { href: '/beneficiaries', key: 'beneficiaries', icon: Users, roles: ['Admin','Manager','Coordinator','Beneficiary'], section: 'work' },
  { href: '/programs', key: 'programs', icon: FolderKanban, roles: everyone, section: 'work' },
  { href: '/applications', key: 'applications', icon: FileText, roles: everyone, section: 'work' },
  {
    href: '/activities',
    key: 'activities',
    icon: CalendarCheck,
    roles: ['Admin', 'Manager', 'Coordinator'],
    section: 'work',
  },
  {
    href: '/impact',
    key: 'impact',
    icon: TrendingUp,
    roles: ['Admin', 'Manager', 'Coordinator', 'Impact', 'Viewer'],
    section: 'insight',
  },
  {
    href: '/reports',
    key: 'reports',
    icon: BarChart3,
    roles: ['Admin', 'Manager', 'Impact', 'Viewer'],
    section: 'insight',
  },
  {
    href: '/assistant',
    key: 'assistant',
    icon: Sparkles,
    roles: ['Admin', 'Manager', 'Impact'],
    section: 'insight',
  },
  { href: '/team', key: 'team', icon: Users, roles: ['Admin'], section: 'admin' },
  { href: '/integrations', key: 'integrations', icon: Plug, roles: ['Admin'], section: 'admin' },
  { href: '/billing', key: 'billing', icon: CreditCard, roles: ['Admin'], section: 'admin' },
  { href: '/privacy', key: 'privacy', icon: ShieldCheck, roles: everyone, section: 'admin' },
];

export const navSections = ['work', 'insight', 'admin'] as const;

export function visibleNav(role: Role) {
  return navItems.filter((item) => item.roles.includes(role));
}

/** The default landing route for a role — used when a page is not permitted. */
export function homeFor(role: Role) {
  return visibleNav(role)[0]?.href ?? '';
}
