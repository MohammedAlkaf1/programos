/**
 * Seeds a demo workspace: two organizations, the seven roles, and enough
 * programs / applications / attendance / measurements for every screen and
 * every chart to have something real to show.
 *
 *   npm run db:seed
 */
import 'dotenv/config';
import { PLANS } from './plans';
import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { hash } from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../src/lib/demo.js';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DAY = 86_400_000;
const at = (days: number, hour = 9) => {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(hour, 0, 0, 0);
  return date;
};

const FIRST = [
  'سارة', 'محمد', 'لمى', 'فهد', 'جواهر', 'تركي', 'رهف', 'عبدالعزيز',
  'شهد', 'بندر', 'دانة', 'ياسر', 'منيرة', 'راكان', 'وجدان', 'مشعل',
  'العنود', 'سعود', 'غادة', 'نايف',
];
const LAST = [
  'العنزي', 'الشهري', 'المطيري', 'الحارثي', 'البقمي', 'السبيعي',
  'الرشيدي', 'العمري', 'الجهني', 'الثبيتي',
];

/** Deterministic pseudo-random so reseeding gives the same demo story. */
let seed = 1337;
function random() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];

const RUBRIC = [
  { nameAr: 'الدافعية والالتزام', nameEn: 'Motivation & commitment', weight: 40 },
  { nameAr: 'الخبرة السابقة', nameEn: 'Relevant experience', weight: 35 },
  { nameAr: 'أثر المشاركة المتوقع', nameEn: 'Expected impact', weight: 25 },
];

const FORM = [
  {
    id: 'motivation',
    labelAr: 'ما دافعك للالتحاق بالبرنامج؟',
    labelEn: 'Why do you want to join this program?',
    type: 'textarea',
    required: true,
  },
  {
    id: 'experience',
    labelAr: 'سنوات الخبرة',
    labelEn: 'Years of experience',
    type: 'number',
    required: true,
  },
  {
    id: 'city',
    labelAr: 'المدينة',
    labelEn: 'City',
    type: 'select',
    required: true,
    options: ['الرياض', 'جدة', 'الدمام', 'أبها', 'المدينة المنورة'],
  },
];

const PRIVACY_AR =
  'تُجمع بياناتك لغرض إدارة البرنامج وقياس أثره فقط، ولا تُشارك مع أي جهة خارجية دون موافقتك الصريحة. يحق لك طلب الاطلاع أو التصحيح أو الحذف في أي وقت.';
const PRIVACY_EN =
  'Your data is collected solely to administer this program and measure its impact. It is never shared with a third party without your explicit consent. You may request access, correction or erasure at any time.';

async function main() {
  console.log('Clearing existing data…');
  // Order matters: children before parents.
  await db.attendance.deleteMany();
  await db.measurement.deleteMany();
  await db.enrollment.deleteMany();
  await db.evaluation.deleteMany();
  await db.application.deleteMany();
  await db.activity.deleteMany();
  await db.indicator.deleteMany();
  await db.beneficiary.deleteMany();
  await db.program.deleteMany();
  await db.initiative.deleteMany();
  await db.notification.deleteMany();
  await db.privacyRequest.deleteMany();
  await db.reportSnapshot.deleteMany();
  await db.audit.deleteMany();
  await db.invitation.deleteMany();
  await db.outbox.deleteMany();
  await db.authToken.deleteMany();
  await db.authAttempt.deleteMany();
  await db.invoice.deleteMany();
  await db.subscription.deleteMany();
  await db.billingEvent.deleteMany();
  await db.plan.deleteMany();
  await db.membership.deleteMany();
  await db.user.deleteMany();
  await db.tenant.deleteMany();

  const password = await hash(DEMO_PASSWORD, 10);


  console.log('Creating plans…');
  // The price list lives in scripts/plans-sync.ts so a running database and a fresh seed never disagree.
  const plans = await Promise.all(
    PLANS.map((plan) => db.plan.create({ data: { ...plan, features: [...plan.features] } })),
  );
  const growth = plans.find((plan) => plan.code === 'growth')!;

  console.log('Creating organizations…');
  const athar = await db.tenant.create({
    data: {
      slug: 'athar',
      nameAr: 'مؤسسة أثر للتنمية',
      nameEn: 'Athar Development Foundation',
    },
  });
  const bina = await db.tenant.create({
    data: { slug: 'bina', nameAr: 'مؤسسة بناء الأهلية', nameEn: 'Bina Community Foundation' },
  });

  console.log('Creating subscriptions…');
  const periodStart = at(-8);
  await db.subscription.create({
    data: {
      tenantId: athar.id, planId: growth.id, status: 'Active',
      currentPeriodStart: periodStart, currentPeriodEnd: at(22),
    },
  });
  await db.subscription.create({
    data: {
      tenantId: bina.id, planId: plans[0].id, status: 'Trialing',
      trialEndsAt: at(6), currentPeriodStart: at(-8), currentPeriodEnd: at(6),
    },
  });

  console.log('Creating team…');
  const team: Record<string, { id: string; email: string }> = {};
  for (const account of DEMO_ACCOUNTS) {
    const user = await db.user.create({
      data: {
        email: account.email,
        name: account.name,
        password,
        verified: true,
      },
    });
    team[account.role] = { id: user.id, email: user.email };
  }

  console.log('Creating initiatives…');
  const initiative = await db.initiative.create({
    data: {
      tenantId: athar.id,
      nameAr: 'مبادرة تمكين الشباب',
      nameEn: 'Youth Empowerment Initiative',
      objective: 'رفع جاهزية الشباب لسوق العمل وتعزيز مشاركتهم المجتمعية',
    },
  });

  console.log('Creating programs…');
  const baseProgram = {
    tenantId: athar.id,
    category: 'Development',
    form: FORM,
    rubric: RUBRIC,
    privacyAr: PRIVACY_AR,
    privacyEn: PRIVACY_EN,
  };

  const leadership = await db.program.create({
    data: {
      ...baseProgram,
      initiativeId: initiative.id,
      nameAr: 'برنامج القيادة الشبابية',
      nameEn: 'Youth Leadership Program',
      descriptionAr:
        'برنامج مكثف لمدة ثمانية أسابيع يطور مهارات القيادة والتواصل وإدارة الفرق لدى الشباب.',
      descriptionEn:
        'An intensive eight-week program building leadership, communication and team management skills.',
      status: 'Active',
      capacity: 30,
      registrationStart: at(-70),
      registrationEnd: at(-45),
      startsAt: at(-40),
      endsAt: at(20),
      completionThreshold: 75,
      requireEndline: false,
    },
  });

  const digital = await db.program.create({
    data: {
      ...baseProgram,
      initiativeId: initiative.id,
      nameAr: 'أكاديمية المهارات الرقمية',
      nameEn: 'Digital Skills Academy',
      descriptionAr:
        'مسار تدريبي يغطي تحليل البيانات وأساسيات البرمجة والتسويق الرقمي للباحثين عن عمل.',
      descriptionEn:
        'A training track covering data analysis, programming fundamentals and digital marketing.',
      status: 'RegistrationOpen',
      capacity: 40,
      registrationStart: at(-6),
      registrationEnd: at(18),
      startsAt: at(25),
      endsAt: at(85),
      completionThreshold: 80,
      requireEndline: true,
    },
  });

  const accelerator = await db.program.create({
    data: {
      ...baseProgram,
      nameAr: 'مسرعة المشاريع الاجتماعية',
      nameEn: 'Social Venture Accelerator',
      descriptionAr: 'مسرعة أعمال تدعم رواد المشاريع الاجتماعية بالإرشاد والتمويل الأولي.',
      descriptionEn:
        'An accelerator supporting social entrepreneurs with mentorship and seed funding.',
      status: 'Published',
      capacity: 15,
      registrationStart: at(10),
      registrationEnd: at(40),
      startsAt: at(50),
      endsAt: at(140),
      completionThreshold: 80,
      requireEndline: false,
    },
  });

  const community = await db.program.create({
    data: {
      ...baseProgram,
      nameAr: 'برنامج التمكين المجتمعي',
      nameEn: 'Community Empowerment Program',
      descriptionAr: 'برنامج ميداني لتأهيل قادة الأحياء وتنفيذ مبادرات محلية.',
      descriptionEn:
        'A field program qualifying neighbourhood leaders to deliver local initiatives.',
      status: 'Completed',
      capacity: 25,
      registrationStart: at(-210),
      registrationEnd: at(-180),
      startsAt: at(-170),
      endsAt: at(-60),
      completionThreshold: 70,
      requireEndline: false,
    },
  });

  const workshop = await db.program.create({
    data: {
      ...baseProgram,
      nameAr: 'ورشة الإعداد المهني',
      nameEn: 'Career Readiness Workshop',
      descriptionAr: 'ورشة قصيرة تغطي كتابة السيرة الذاتية ومهارات المقابلات الوظيفية.',
      descriptionEn: 'A short workshop covering CV writing and interview skills.',
      status: 'Draft',
      capacity: 50,
      registrationStart: at(30),
      registrationEnd: at(55),
      startsAt: at(60),
      endsAt: at(64),
      completionThreshold: 80,
      requireEndline: false,
    },
  });

  const allPrograms = [leadership, digital, accelerator, community, workshop];
  const scoped = [leadership.id, digital.id, accelerator.id, community.id, workshop.id];

  console.log('Creating memberships…');
  const membershipScope: Record<string, string[]> = {
    Admin: [],
    Manager: scoped,
    Coordinator: [leadership.id, community.id],
    Reviewer: [digital.id, leadership.id],
    Impact: [leadership.id, community.id, digital.id],
    Viewer: scoped,
    Beneficiary: [],
  };

  for (const account of DEMO_ACCOUNTS) {
    await db.membership.create({
      data: {
        userId: team[account.role].id,
        tenantId: athar.id,
        role: account.role,
        programIds: membershipScope[account.role] ?? [],
      },
    });
  }
  // The admin also belongs to the second organization, so tenant switching is live.
  await db.membership.create({
    data: { userId: team.Admin.id, tenantId: bina.id, role: 'Admin', programIds: [] },
  });

  console.log('Creating activities…');
  const leadershipActivities = await Promise.all(
    [
      { ar: 'اللقاء التعريفي', en: 'Orientation session', offset: -38, required: true },
      { ar: 'ورشة مهارات التواصل', en: 'Communication skills workshop', offset: -31, required: true },
      { ar: 'ورشة إدارة الفريق', en: 'Team management workshop', offset: -24, required: true },
      { ar: 'جلسة إرشاد فردي', en: 'One-to-one mentoring', offset: -17, required: false },
      { ar: 'مشروع التطبيق العملي', en: 'Capstone project', offset: -9, required: true },
      { ar: 'ورشة العرض والإقناع', en: 'Pitching workshop', offset: 5, required: true },
      { ar: 'حفل الختام', en: 'Closing ceremony', offset: 18, required: false },
    ].map((item) =>
      db.activity.create({
        data: {
          tenantId: athar.id,
          programId: leadership.id,
          nameAr: item.ar,
          nameEn: item.en,
          startsAt: at(item.offset, 10),
          endsAt: at(item.offset, 13),
          location: pick(['قاعة التدريب الرئيسية', 'مركز الابتكار', 'القاعة الزرقاء', 'عن بُعد']),
          required: item.required,
          status: item.offset < 0 ? 'Completed' : 'Scheduled',
        },
      }),
    ),
  );

  const communityActivities = await Promise.all(
    [
      { ar: 'اللقاء الافتتاحي', en: 'Kick-off meeting', offset: -168 },
      { ar: 'ورشة تشخيص الاحتياج', en: 'Needs assessment workshop', offset: -150 },
      { ar: 'تنفيذ المبادرات الميدانية', en: 'Field initiative delivery', offset: -110 },
      { ar: 'جلسة التقييم الختامي', en: 'Final evaluation session', offset: -65 },
    ].map((item) =>
      db.activity.create({
        data: {
          tenantId: athar.id,
          programId: community.id,
          nameAr: item.ar,
          nameEn: item.en,
          startsAt: at(item.offset, 10),
          endsAt: at(item.offset, 14),
          location: 'مقر المؤسسة',
          required: true,
          status: 'Completed',
        },
      }),
    ),
  );

  console.log('Creating indicators…');
  const leadershipIndicator = await db.indicator.create({
    data: {
      tenantId: athar.id,
      programId: leadership.id,
      nameAr: 'مؤشر الجاهزية القيادية',
      nameEn: 'Leadership readiness score',
      unit: 'درجة',
      target: 80,
      direction: 'Higher',
    },
  });
  const confidenceIndicator = await db.indicator.create({
    data: {
      tenantId: athar.id,
      programId: leadership.id,
      nameAr: 'مستوى القلق من التحدث أمام الجمهور',
      nameEn: 'Public speaking anxiety level',
      unit: 'درجة',
      target: 20,
      direction: 'Lower',
    },
  });
  const communityIndicator = await db.indicator.create({
    data: {
      tenantId: athar.id,
      programId: community.id,
      nameAr: 'عدد المبادرات المجتمعية المنفذة',
      nameEn: 'Community initiatives delivered',
      unit: 'مبادرة',
      target: 3,
      direction: 'Higher',
    },
  });
  await db.indicator.create({
    data: {
      tenantId: athar.id,
      programId: digital.id,
      nameAr: 'مؤشر الجاهزية الرقمية',
      nameEn: 'Digital readiness score',
      unit: 'درجة',
      target: 75,
      direction: 'Higher',
    },
  });

  console.log('Creating beneficiaries and applications…');
  const demoBeneficiaryUser = team.Beneficiary;

  async function makeBeneficiary(index: number) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const email = `beneficiary${index}@example.sa`;
    const user = await db.user.create({
      data: { email, name, password, verified: true },
    });
    await db.membership.create({
      data: { userId: user.id, tenantId: athar.id, role: 'Beneficiary', programIds: [] },
    });
    return db.beneficiary.create({
      data: { tenantId: athar.id, userId: user.id, name, email },
    });
  }

  const pool = [];
  for (let index = 1; index <= 26; index += 1) pool.push(await makeBeneficiary(index));

  const demoBeneficiary = await db.beneficiary.create({
    data: {
      tenantId: athar.id,
      userId: demoBeneficiaryUser.id,
      name: DEMO_ACCOUNTS.find((a) => a.role === 'Beneficiary')!.name,
      email: demoBeneficiaryUser.email,
    },
  });

  const answersFor = () => ({
    motivation:
      'أسعى لتطوير مهاراتي القيادية والمساهمة في مبادرات مجتمعية تخدم حيي ومدينتي.',
    experience: String(Math.floor(random() * 8) + 1),
    city: pick(['الرياض', 'جدة', 'الدمام', 'أبها', 'المدينة المنورة']),
  });

  /** Leadership: 18 accepted + enrolled, riding through attendance and measurements. */
  const leadershipEnrollments: Array<{ enrollmentId: string; beneficiaryId: string }> = [];

  for (let index = 0; index < 18; index += 1) {
    const beneficiary = pool[index];
    const application = await db.application.create({
      data: {
        tenantId: athar.id,
        programId: leadership.id,
        beneficiaryId: beneficiary.id,
        status: 'Accepted',
        answers: answersFor(),
        formSnapshot: FORM,
        privacySnapshot: `${PRIVACY_AR}\n${PRIVACY_EN}`,
        reviewerIds: [team.Reviewer.id],
        decisionReason: 'استوفى المتطلبات وحقق درجة تقييم مرتفعة.',
        submittedAt: at(-60),
        firstDecidedAt: at(-48),
      },
    });
    await db.evaluation.create({
      data: {
        tenantId: athar.id,
        applicationId: application.id,
        reviewerId: team.Reviewer.id,
        score: 60 + random() * 35,
        scores: [4, 4, 3],
        comment: 'مرشح واعد ولديه دافعية واضحة للمشاركة.',
      },
    });
    const enrollment = await db.enrollment.create({
      data: {
        tenantId: athar.id,
        applicationId: application.id,
        status: index < 16 ? 'InProgress' : 'Withdrawn',
        ...(index >= 16 ? { reason: 'ظروف شخصية حالت دون الاستمرار.' } : {}),
      },
    });
    if (index < 16) {
      leadershipEnrollments.push({
        enrollmentId: enrollment.id,
        beneficiaryId: beneficiary.id,
      });
    }
  }

  console.log('Recording attendance…');
  const pastLeadership = leadershipActivities.filter(
    (activity) => activity.startsAt < new Date(),
  );
  for (const { enrollmentId } of leadershipEnrollments) {
    for (const activity of pastLeadership) {
      const roll = random();
      const status = roll < 0.78 ? 'Present' : roll < 0.9 ? 'Absent' : 'Excused';
      await db.attendance.create({
        data: {
          tenantId: athar.id,
          activityId: activity.id,
          enrollmentId,
          status,
          reason:
            status === 'Present'
              ? 'حضور مسجل عبر قائمة الحضور.'
              : status === 'Excused'
                ? 'عذر مقبول مسبقًا من المنسق.'
                : 'غياب دون إشعار مسبق.',
        },
      });
    }
  }

  console.log('Recording measurements…');
  for (const [index, { enrollmentId }] of leadershipEnrollments.entries()) {
    const baseline = 38 + random() * 18;
    const endline = baseline + 18 + random() * 14;
    const verified = index < 12;

    await db.measurement.create({
      data: {
        tenantId: athar.id,
        indicatorId: leadershipIndicator.id,
        enrollmentId,
        period: 'Baseline',
        value: Number(baseline.toFixed(1)),
        status: verified ? 'Verified' : 'Draft',
        source: 'استبانة التقييم الذاتي قبل البرنامج.',
      },
    });
    await db.measurement.create({
      data: {
        tenantId: athar.id,
        indicatorId: leadershipIndicator.id,
        enrollmentId,
        period: 'Endline',
        value: Number(endline.toFixed(1)),
        status: verified ? 'Verified' : 'Draft',
        source: 'استبانة التقييم الذاتي بعد البرنامج.',
      },
    });

    if (index < 10) {
      const anxietyBase = 62 + random() * 15;
      const anxietyEnd = anxietyBase - (16 + random() * 12);
      await db.measurement.create({
        data: {
          tenantId: athar.id,
          indicatorId: confidenceIndicator.id,
          enrollmentId,
          period: 'Baseline',
          value: Number(anxietyBase.toFixed(1)),
          status: 'Verified',
          source: 'مقياس القلق الاجتماعي قبل البرنامج.',
        },
      });
      await db.measurement.create({
        data: {
          tenantId: athar.id,
          indicatorId: confidenceIndicator.id,
          enrollmentId,
          period: 'Endline',
          value: Number(anxietyEnd.toFixed(1)),
          status: 'Verified',
          source: 'مقياس القلق الاجتماعي بعد البرنامج.',
        },
      });
    }
  }

  /** Digital academy: a live review queue across every screening state. */
  console.log('Creating the live review queue…');
  const queue: Array<{ status: string; count: number }> = [
    { status: 'Submitted', count: 6 },
    { status: 'UnderReview', count: 5 },
    { status: 'NeedsInfo', count: 2 },
    { status: 'Waitlisted', count: 2 },
  ];

  let cursor = 18;
  for (const entry of queue) {
    for (let index = 0; index < entry.count; index += 1) {
      const beneficiary = pool[cursor % pool.length];
      cursor += 1;
      const application = await db.application.create({
        data: {
          tenantId: athar.id,
          programId: digital.id,
          beneficiaryId: beneficiary.id,
          status: entry.status,
          answers: answersFor(),
          formSnapshot: FORM,
          privacySnapshot: `${PRIVACY_AR}\n${PRIVACY_EN}`,
          reviewerIds: entry.status === 'UnderReview' ? [team.Reviewer.id] : [],
          submittedAt: at(-Math.floor(random() * 5) - 1),
          ...(entry.status === 'NeedsInfo'
            ? {
                needsInfo: 'يرجى إرفاق ما يثبت الخبرة العملية المذكورة في الطلب.',
                infoDue: at(index === 0 ? -1 : 4),
              }
            : {}),
        },
      });

      // Two of the under-review applications already carry a reviewer score.
      if (entry.status === 'UnderReview' && index < 2) {
        await db.evaluation.create({
          data: {
            tenantId: athar.id,
            applicationId: application.id,
            reviewerId: team.Reviewer.id,
            score: 55 + random() * 30,
            scores: [4, 3, 4],
            comment: 'خلفية تقنية جيدة، يحتاج إلى تأكيد الالتزام بمواعيد التدريب.',
          },
        });
      }
    }
  }

  /** The demo beneficiary's own story: one accepted, one needing information. */
  const demoAccepted = await db.application.create({
    data: {
      tenantId: athar.id,
      programId: leadership.id,
      beneficiaryId: demoBeneficiary.id,
      status: 'Accepted',
      answers: answersFor(),
      formSnapshot: FORM,
      privacySnapshot: `${PRIVACY_AR}\n${PRIVACY_EN}`,
      decisionReason: 'قُبل ضمن الدفعة الأولى.',
      submittedAt: at(-58),
      firstDecidedAt: at(-47),
    },
  });
  const demoEnrollment = await db.enrollment.create({
    data: { tenantId: athar.id, applicationId: demoAccepted.id, status: 'InProgress' },
  });
  for (const activity of pastLeadership) {
    await db.attendance.create({
      data: {
        tenantId: athar.id,
        activityId: activity.id,
        enrollmentId: demoEnrollment.id,
        status: random() < 0.85 ? 'Present' : 'Excused',
        reason: 'حضور مسجل عبر قائمة الحضور.',
      },
    });
  }
  await db.application.create({
    data: {
      tenantId: athar.id,
      programId: digital.id,
      beneficiaryId: demoBeneficiary.id,
      status: 'NeedsInfo',
      answers: answersFor(),
      formSnapshot: FORM,
      privacySnapshot: `${PRIVACY_AR}\n${PRIVACY_EN}`,
      needsInfo: 'يرجى توضيح عدد ساعات التفرغ الأسبوعية المتاحة لديك.',
      infoDue: at(5),
      submittedAt: at(-3),
    },
  });

  /** Community program: a finished cohort, so completion rate is not zero. */
  console.log('Creating the completed cohort…');
  for (let index = 0; index < 12; index += 1) {
    const beneficiary = pool[(cursor + index) % pool.length];
    const application = await db.application.create({
      data: {
        tenantId: athar.id,
        programId: community.id,
        beneficiaryId: beneficiary.id,
        status: 'Accepted',
        answers: answersFor(),
        formSnapshot: FORM,
        privacySnapshot: `${PRIVACY_AR}\n${PRIVACY_EN}`,
        decisionReason: 'استوفى شروط الالتحاق.',
        submittedAt: at(-195),
        firstDecidedAt: at(-185),
      },
    });
    const enrollment = await db.enrollment.create({
      data: {
        tenantId: athar.id,
        applicationId: application.id,
        status: index < 10 ? 'Completed' : 'Withdrawn',
        ...(index < 10
          ? { completedAt: at(-62), reason: 'أكمل متطلبات البرنامج بنجاح.' }
          : { reason: 'انسحب لظروف خاصة.' }),
      },
    });

    for (const activity of communityActivities) {
      await db.attendance.create({
        data: {
          tenantId: athar.id,
          activityId: activity.id,
          enrollmentId: enrollment.id,
          status: index < 10 ? 'Present' : random() < 0.5 ? 'Absent' : 'Present',
          reason: 'سجل الحضور الميداني.',
        },
      });
    }

    if (index < 10) {
      await db.measurement.create({
        data: {
          tenantId: athar.id,
          indicatorId: communityIndicator.id,
          enrollmentId: enrollment.id,
          period: 'Baseline',
          value: Math.floor(random() * 2),
          status: 'Verified',
          source: 'حصر المبادرات قبل البرنامج.',
        },
      });
      await db.measurement.create({
        data: {
          tenantId: athar.id,
          indicatorId: communityIndicator.id,
          enrollmentId: enrollment.id,
          period: 'Endline',
          value: 2 + Math.floor(random() * 3),
          status: 'Verified',
          source: 'حصر المبادرات بعد البرنامج.',
        },
      });
    }
  }

  /** A few rejected applications so the funnel has a full shape. */
  for (let index = 0; index < 4; index += 1) {
    const beneficiary = pool[(cursor + 12 + index) % pool.length];
    await db.application.create({
      data: {
        tenantId: athar.id,
        programId: community.id,
        beneficiaryId: beneficiary.id,
        status: 'Rejected',
        answers: answersFor(),
        formSnapshot: FORM,
        privacySnapshot: `${PRIVACY_AR}\n${PRIVACY_EN}`,
        decisionReason: 'لم تتوفر المقاعد الكافية في هذه الدفعة.',
        submittedAt: at(-196),
        firstDecidedAt: at(-186),
      },
    });
  }

  console.log('Creating notifications, privacy requests and audit history…');
  for (const account of DEMO_ACCOUNTS) {
    await db.notification.create({
      data: {
        tenantId: athar.id,
        userId: team[account.role].id,
        titleAr: 'أهلًا بك في مساحة عمل مؤسسة أثر للتنمية',
        titleEn: 'Welcome to the Athar Development Foundation workspace',
        read: false,
      },
    });
  }
  await db.notification.create({
    data: {
      tenantId: athar.id,
      userId: team.Manager.id,
      titleAr: 'خمسة طلبات بانتظار إسناد مُقيّم في أكاديمية المهارات الرقمية',
      titleEn: 'Five applications await reviewer assignment in the Digital Skills Academy',
    },
  });
  await db.notification.create({
    data: {
      tenantId: athar.id,
      userId: team.Impact.id,
      titleAr: 'قياسات جديدة بانتظار الاعتماد',
      titleEn: 'New measurements are awaiting verification',
    },
  });

  await db.privacyRequest.create({
    data: {
      tenantId: athar.id,
      userId: demoBeneficiaryUser.id,
      type: 'Access',
      status: 'IdentityVerified',
      reason: 'تم التحقق من الهوية عبر البريد المسجل.',
      dueAt: at(5),
    },
  });
  await db.privacyRequest.create({
    data: {
      tenantId: athar.id,
      userId: demoBeneficiaryUser.id,
      type: 'Correction',
      status: 'New',
      dueAt: at(24),
    },
  });

  const auditActions = [
    ['program.create', leadership.id, team.Manager.id],
    ['program.transition', leadership.id, team.Manager.id],
    ['application.review', demoAccepted.id, team.Coordinator.id],
    ['application.evaluate', demoAccepted.id, team.Reviewer.id],
    ['application.decide', demoAccepted.id, team.Manager.id],
    ['indicator.create', leadershipIndicator.id, team.Impact.id],
    ['measurement.verify', communityIndicator.id, team.Impact.id],
    ['member.update', team.Reviewer.id, team.Admin.id],
  ] as const;
  for (const [index, [action, entityId, actorId]] of auditActions.entries()) {
    await db.audit.create({
      data: {
        tenantId: athar.id,
        actorId,
        action,
        entityId,
        detail: {},
        createdAt: at(-index - 1, 12),
      },
    });
  }

  // A second organization with its own program, proving tenant isolation.
  await db.program.create({
    data: {
      tenantId: bina.id,
      nameAr: 'برنامج الإرشاد الأسري',
      nameEn: 'Family Guidance Program',
      descriptionAr: 'برنامج إرشادي يقدم جلسات دعم للأسر المستفيدة.',
      descriptionEn: 'A guidance program providing support sessions for beneficiary families.',
      status: 'RegistrationOpen',
      capacity: 20,
      registrationStart: at(-3),
      registrationEnd: at(20),
      startsAt: at(28),
      endsAt: at(90),
      form: FORM,
      rubric: RUBRIC,
      privacyAr: PRIVACY_AR,
      privacyEn: PRIVACY_EN,
    },
  });

  enableDemoLogin();

  const counts = {
    tenants: await db.tenant.count(),
    users: await db.user.count(),
    programs: await db.program.count(),
    applications: await db.application.count(),
    enrollments: await db.enrollment.count(),
    attendance: await db.attendance.count(),
    measurements: await db.measurement.count(),
  };

  console.log('\nSeed complete:', counts);
  console.log(`\nSign in with any of these — password: ${DEMO_PASSWORD}`);
  for (const account of DEMO_ACCOUNTS) {
    console.log(`  ${account.role.padEnd(12)} ${account.email}`);
  }
}

/** Lets the sign-in screen offer the demo accounts on this machine only. */
function enableDemoLogin() {
  if (!existsSync('.env')) return;
  const contents = readFileSync('.env', 'utf8');
  if (!contents.includes('DEMO_LOGIN=')) appendFileSync('.env', 'DEMO_LOGIN=1\n');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
