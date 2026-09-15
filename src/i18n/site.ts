import type { Locale } from './dictionary';

/**
 * The words the public site is made of.
 *
 * Kept apart from the product dictionary because the two change for different
 * reasons: a label inside the application changes when a feature changes, while
 * this copy changes when the way we describe the product changes. Both locales
 * are full translations, not transliterations, and the Arabic is written first
 * because it is the language most of these organizations actually work in.
 */

const ar = {
  meta: {
    title: 'برنامج أو إس · منصة إدارة البرامج وقياس الأثر',
    description:
      'منصة سعودية تدير دورة البرنامج كاملة من التسجيل إلى القرار إلى الحضور، وتقيس النتائج بقياس قبلي وختامي موثق، وتصدر تقارير يمكن إعادة إنتاجها.',
  },
  nav: {
    product: 'المنتج',
    measurement: 'قياس الأثر',
    security: 'الأمان والخصوصية',
    pricing: 'الأسعار',
    contact: 'تواصل معنا',
    login: 'تسجيل الدخول',
    start: 'ابدأ تجربة مجانية',
    menu: 'القائمة',
  },
  hero: {
    eyebrow: 'منصة سعودية لإدارة البرامج والمبادرات',
    title: 'أدِر برامجك، وأثبت نتائجها بالأرقام',
    body: 'يجمع برنامج أو إس الطلبات والتقييم والقرار والحضور والقياس في مكان واحد، فتعرف حالة كل مستفيد في أي لحظة، وتُخرج تقريرًا يستطيع أي شخص التحقق من كل رقم فيه.',
    primary: 'ابدأ تجربة مجانية 14 يومًا',
    secondary: 'شاهد كيف يعمل',
    note: 'بلا بطاقة ائتمانية. تجهيز مساحة العمل خلال دقائق.',
    scene: 'رحلة برنامج واحد داخل المنصة، من إعداده حتى تقريره الختامي، في سبع مراحل مسجلة.',
    mock: {
      caption: 'لوحة المعلومات',
      kpis: [
        { label: 'البرامج', value: '12' },
        { label: 'الطلبات', value: '348' },
        { label: 'الملتحقون', value: '196' },
        { label: 'نسبة الإكمال', value: '82%' },
      ],
      chart: 'إشغال البرامج',
      bars: [
        { label: 'مهارات القيادة', value: 92 },
        { label: 'ريادة الأعمال', value: 74 },
        { label: 'التدريب التقني', value: 58 },
        { label: 'الإرشاد المهني', value: 41 },
      ],
      change: 'متوسط التغير في مستوى المهارة',
      changeValue: '+18',
      changeUnit: 'درجة',
      pairs: 'على 64 زوج قياس معتمد',
    },
  },
  trust: [
    { title: 'البيانات داخل السعودية', body: 'قاعدة البيانات والملفات والنسخ الاحتياطية في نطاق تختاره أنت.' },
    { title: 'عزل كامل بين الجهات', body: 'كل جهة في مساحتها. لا استعلام ولا تقرير ولا ملف يعبر الحدود.' },
    { title: 'سجل تدقيق لكل عملية', body: 'من فعل، ومتى، ولماذا، مع المعرّف الذي يربط العملية بطلبها.' },
    { title: 'عربي وإنجليزي معًا', body: 'واجهة كاملة بالاتجاهين، وتواريخ بتوقيت الرياض في كل شاشة.' },
  ],
  problem: {
    title: 'الملفات المتفرقة تكلفك أكثر مما تظن',
    body: 'حين تتوزع الطلبات على جدول، والحضور على مجموعة محادثة، والنتائج على ملف لدى موظف واحد، يصبح كل سؤال بسيط مشروعًا بحد ذاته.',
    pains: [
      { title: 'لا أحد يعرف حالة المستفيد', body: 'الطلب في بريد، والقرار في محادثة، والحضور في ورقة. الإجابة تحتاج ثلاثة أشخاص ويومًا كاملًا.' },
      { title: 'التقرير لا يمكن إعادة إنتاجه', body: 'الرقم في العرض التقديمي لا يعود إلى مصدر. تسأل عن أصله بعد شهر فلا تجد إجابة.' },
      { title: 'الأثر يبقى انطباعًا', body: 'تعرف أن البرنامج نافع، لكنك لا تملك قياسًا قبليًا وختاميًا يثبت مقدار التغير ولمن حدث.' },
    ],
  },
  audience: {
    title: 'مبنية لمن يدير برامج تصل إلى الناس',
    body: 'ليست أداة مشاريع عامة. كل شاشة فيها مصممة حول المستفيد والبرنامج والنتيجة.',
    items: [
      { title: 'الجمعيات والمؤسسات غير الربحية', body: 'برامج تدريب وتمكين ورعاية، بتقارير يطلبها المانح والجهة الرقابية في نهاية كل دورة.' },
      { title: 'الجهات الحكومية والبرامج التنموية', body: 'مبادرات متعددة البرامج، بحاجة إلى صورة موحدة وأرقام يمكن الدفاع عنها أمام لجنة.' },
      { title: 'جهات التدريب والمسرّعات', body: 'دفعات متتابعة بتسجيل وفرز وقبول وحضور، وقياس لما تغيّر لدى المشارك فعلًا.' },
    ],
  },

  modules: {
    title: 'وحدة لكل خطوة في رحلة البرنامج',
    body: 'كل ما تحتاجه لتشغيل برنامج من أول فكرة إلى آخر تقرير، دون أدوات جانبية.',
    items: [
      { title: 'المبادرات والبرامج', body: 'أنشئ البرنامج بمواعيده وسعته وشروط إكماله، وأدِر دورة حياته من المسودة إلى الأرشفة.' },
      { title: 'النماذج والطلبات', body: 'صمم نموذج التقديم بحقول محددة، واحفظ نسخته مع كل طلب فلا تتغير القواعد بعد التقديم.' },
      { title: 'التقييم والقرار', body: 'معايير موزونة ومقيّمون مُسندون وتعارض مصالح معلن، والقرار بمبرر مكتوب يبقى في السجل.' },
      { title: 'المستفيدون والمشاركات', body: 'ملف موحد داخل الجهة يجمع طلبات الشخص ومشاركاته وحضوره ونتائجه في مكان واحد.' },
      { title: 'الأنشطة والحضور', body: 'جدول الأنشطة وسجل الحضور، وشرط إكمال يُحتسب آليًا ولا يُتجاوز بالخطأ.' },
      { title: 'المؤشرات والأثر', body: 'مؤشرات بوحدات ومستهدفات، وقياس قبلي وختامي يُعتمد قبل أن يدخل أي تقرير.' },
      { title: 'التقارير والتصدير', body: 'لوحات تشغيل ونتائج، ولقطات محفوظة لا تتغير، وتصدير برابط مؤقت يُعاد التحقق منه.' },
      { title: 'الخصوصية والتدقيق', body: 'طلبات حقوق أصحاب البيانات، وسياسة احتفاظ، وإتلاف باعتماد بشري وشاهد موثق.' },
    ],
  },
  journey: {
    eyebrow: 'كيف تعمل المنصة',
    title: 'من فتح التسجيل إلى التقرير الموثق',
    body: 'الرحلة نفسها التي يعيشها فريقك اليوم، لكن في مسار واحد كل خطوة فيه مسجلة.',
    steps: [
      { title: 'جهّز البرنامج', body: 'المواعيد والسعة ونموذج التقديم ومعايير التقييم وإشعار الخصوصية.' },
      { title: 'افتح التسجيل', body: 'يقدّم المستفيد طلبه، فيصله رقم مرجعي ويصل فريقك إشعار فوري.' },
      { title: 'قيّم وقرر', body: 'يفرز المنسق، ويقيّم المقيّم بمعايير موزونة، ويقرر المدير بمبرر مكتوب.' },
      { title: 'نفّذ وتابع', body: 'أنشطة وحضور ومتابعة إكمال، مع تعليق واستئناف وانسحاب حين يلزم.' },
      { title: 'قِس وأصدر', body: 'قياس قبلي وختامي معتمد، ثم تقرير بلقطة ثابتة يمكن الرجوع إليها بعد سنة.' },
    ],
  },
  measurement: {
    eyebrow: 'ما يميز المنصة',
    title: 'نقيس التغير، ولا ندّعي ما لا يثبته القياس',
    body: 'أغلب التقارير تعرض رقمًا واحدًا بلا مصدر. هنا كل رقم يعود إلى قياسات فردية معتمدة، ويُعرض معه عدد الأزواج المكتملة ونسبة التغطية، فيعرف القارئ قوة الدليل لا النتيجة وحدها.',
    points: [
      { title: 'زوج قياس لكل مشارك', body: 'قياس قبل البرنامج وآخر بعده للشخص نفسه. الزوج الناقص لا يدخل الحساب ولا يُخفى.' },
      { title: 'اعتماد قبل الاحتساب', body: 'القياس يبقى مسودة حتى يعتمده أخصائي الأثر، وتصحيحه لاحقًا يتطلب سببًا ويحفظ القيمة السابقة.' },
      { title: 'تغطية معلنة', body: 'إن اكتمل القياس لأربعين من ستين مشاركًا فالتقرير يقول ذلك صراحة بدل أن يعمم على الجميع.' },
      { title: 'لا قفزة إلى السببية', body: 'الفرق بين قبل وبعد يُسمى تغيرًا. نسبته إلى البرنامج وحده ادعاء يحتاج تصميمًا بحثيًا مختلفًا، ونقولها بوضوح.' },
    ],
    note: 'هذا الوضوح ليس تواضعًا زائدًا. هو ما يجعل تقريرك قابلًا للدفاع عنه أمام ممول أو جهة رقابية.',
  },
  security: {
    eyebrow: 'الأمان والخصوصية',
    title: 'مبني على أن البيانات أمانة',
    body: 'المستفيد يسلّمك بياناته لأنه يريد خدمة، لا ليصبح صفًا في ملف. الضوابط التالية ليست إعدادات يمكن نسيانها، بل جزء من بنية المنتج.',
    items: [
      { title: 'تحقق بخطوتين إلزامي', body: 'لكل من يصل إلى بيانات الجهة من الفريق، وجلسة تنتهي بالخمول أو بعد اثنتي عشرة ساعة.' },
      { title: 'صلاحيات بنطاق برنامج', body: 'المقيّم يرى ما أُسند إليه فقط، والمشاهد يرى أرقامًا مجمعة بلا أسماء.' },
      { title: 'حقوق أصحاب البيانات', body: 'الاطلاع والنسخة والتصحيح والحذف وسحب الموافقة، كلها مسارات منفذة بمهلة نظامية ومتابعة.' },
      { title: 'احتفاظ وإتلاف منضبط', body: 'مدة احتفاظ لكل جهة، وقائمة إتلاف يعتمدها المدير، وحجز قانوني يوقف الإتلاف عند الحاجة.' },
      { title: 'فحص المرفقات', body: 'كل ملف يُفحص قبل أن يصبح قابلًا للتنزيل، والملف المشبوه يُعزل ولا يقبل الطلب به.' },
      { title: 'قابلية التتبع', body: 'معرّف لكل طلب يظهر في الاستجابة وفي سجل التدقيق، فتتبع أي حادثة من طرفها إلى طرفها.' },
    ],
  },
  platform: {
    title: 'مفتوح على أدواتك، ومساعد لا يقرر بدلًا عنك',
    api: {
      title: 'واجهة برمجية وإشعارات أحداث',
      body: 'اقرأ البرامج والطلبات والنتائج بمفتاح له صلاحيات محددة، واستقبل الأحداث فور وقوعها بطلب موقَّع. الموصلات ترسل ما تسمح به خريطة حقولك فقط، وتعطُّل أي نظام خارجي يبقى في طابور إعادة المحاولة دون أن يوقف برنامجًا.',
      points: ['مفاتيح بصلاحيات وتدوير وإلغاء فوري', 'توقيع يشمل الوقت فيمنع إعادة إرسال طلب ملتقط', 'رابط تقويم لكل برنامج يعمل في أي تطبيق'],
    },
    ai: {
      title: 'مساعد اختياري تحت سيطرتك',
      body: 'يكتب مسودة وصف برنامج، ويلخص النتائج، ويجيب من مستندات جهتك. معطّل حتى تفعّله، وله سقف إنفاق شهري، وكل رقم في ملخصه يجب أن يطابق قياسًا في النظام وإلا رُفض الملخص كاملًا.',
      points: ['لا يقبل ولا يرفض ولا يرتب أهلية', 'مخرجه مسودة حتى يعتمدها شخص باسمه', 'الاسترجاع داخل جهتك وحدها'],
    },
  },
  pricing: {
    eyebrow: 'الأسعار',
    title: 'باقة تنمو مع برامجك',
    body: 'تجربة مجانية أربعة عشر يومًا بكل المزايا. بعدها تختار ما يناسب حجمك، وتغيّر الباقة متى شئت.',
    perMonth: 'شهريًا',
    free: 'مجانًا',
    cta: 'ابدأ بهذه الباقة',
    contactCta: 'تحدث إلينا',
    limits: { programs: 'برنامج', members: 'عضو فريق', enrollments: 'مشاركة' },
    unlimited: 'بلا حد',
    featured: 'الأكثر اختيارًا',
    includes: 'يشمل',
    featureLabels: {
      reports: 'لوحات التقارير ولقطاتها',
      exports: 'تصدير CSV',
      impact: 'قياس الأثر بخط أساس وقياس ختامي',
      api: 'الواجهة البرمجية وإشعارات الأحداث',
      import: 'الاستيراد من CSV',
      assistant: 'المساعد',
      sso: 'الدخول الموحّد',
      messaging: 'الرسائل القصيرة وواتساب',
      support: 'مدير حساب مخصص',
    },
    payment: 'الدفع بمدى والبطاقات الائتمانية وآبل باي، أو بالتحويل البنكي بفاتورة مرجعية.',
    nonprofit: 'الجهات غير الربحية المرخصة تحصل على خصم 20% على الباقات المدفوعة بعد التحقق من الترخيص، وعقود سنوية بسعر أحد عشر شهرًا.',
    featuresTitle: 'في كل الباقات',
    features: [
      'واجهة عربية وإنجليزية كاملة',
      'تحقق بخطوتين وسجل تدقيق',
      'حقوق أصحاب البيانات وسياسة احتفاظ',
      'تصدير CSV ولقطات تقارير ثابتة',
      'إشعارات داخل المنصة وبالبريد',
      'دعم عبر البريد',
    ],
    vat: 'الأسعار لا تشمل ضريبة القيمة المضافة.',
    faqTitle: 'أسئلة عن الاشتراك',
    faq: [
      { q: 'هل أحتاج بطاقة ائتمانية للتجربة؟', a: 'لا. تبدأ التجربة بأربعة عشر يومًا كاملة بلا بطاقة، وتقرر بعدها.' },
      { q: 'ماذا يحدث إذا انتهت التجربة ولم أشترك؟', a: 'تتوقف الكتابة وتبقى بياناتك كما هي، وتستطيع قراءتها وتصديرها. لا شيء يُحذف بانتهاء التجربة.' },
      { q: 'هل أستطيع تغيير الباقة لاحقًا؟', a: 'نعم. الترقية تسري فورًا، والتخفيض يسري عند التجديد، ولا يُسمح بتخفيض يترك بيانات فوق حدود الباقة الجديدة.' },
      { q: 'كيف أدفع؟', a: 'إلكترونيًا بمدى أو البطاقة الائتمانية أو آبل باي عبر بوابة دفع سعودية مرخصة، ويُفعّل الاشتراك فور نجاح العملية. أو بالتحويل البنكي بفاتورة مرجعية، ويُفعّل عند تأكيد التحويل.' },
      { q: 'هل أستطيع تصدير بياناتي إذا قررت المغادرة؟', a: 'نعم. تُصدَّر كل الوحدات بصيغة CSV مع سجل التدقيق، وتُحدَّد مهلة قبل الإتلاف النهائي.' },
    ],
  },
  faq: {
    title: 'أسئلة شائعة',
    items: [
      { q: 'كم يستغرق تجهيز أول برنامج؟', a: 'أقل من ساعة عادة. تنشئ مساحة العمل، وتدعو فريقك، وتبني النموذج والمعايير، ثم تفتح التسجيل.' },
      { q: 'هل تصلح المنصة لجهة تدير برنامجًا واحدًا؟', a: 'نعم. الباقة المجانية مصممة لبرنامج واحد وفريق صغير، وتنتقل إلى باقة أكبر حين تحتاج.' },
      { q: 'هل أستطيع استيراد مستفيدين من ملف عندي؟', a: 'نعم، من ملف CSV مع معاينة تعرض مصير كل سطر وسبب كل رفض قبل إنشاء أي شيء.' },
      { q: 'من يرى البيانات الشخصية؟', a: 'من يحتاجها لعمله فقط. المشاهد يرى أرقامًا مجمعة، والمقيّم يرى الطلبات المسندة إليه، وكل اطلاع مسجل.' },
      { q: 'هل يمكن ربط المنصة بأنظمتنا؟', a: 'نعم، عبر واجهة برمجية بمفاتيح وصلاحيات، وإشعارات أحداث موقَّعة، وموصلات للتقويم وأنظمة التعلم وإدارة العلاقات والتحليلات.' },
      { q: 'أين تُخزن البيانات؟', a: 'في النطاق الذي تختاره الجهة، والتصميم الأولي يضع قاعدة البيانات والملفات والنسخ داخل السعودية.' },
    ],
  },
  cta: {
    title: 'جرّب المنصة على برنامج حقيقي',
    body: 'أنشئ مساحة عملك اليوم، وشغّل برنامجًا واحدًا من أوله إلى آخره. إن لم يوفر عليك وقتًا حقيقيًا فلا شيء يلزمك بالاستمرار.',
    primary: 'ابدأ تجربة مجانية',
    secondary: 'اطلب عرضًا توضيحيًا',
  },
  contact: {
    title: 'تواصل معنا',
    body: 'اكتب لنا ما تديره اليوم وما تحتاجه، ونرد عليك خلال يوم عمل واحد.',
    name: 'الاسم',
    email: 'البريد الإلكتروني',
    organization: 'اسم الجهة',
    phone: 'رقم الجوال',
    phoneHint: 'اختياري، بصيغة دولية تبدأ بعلامة زائد',
    topic: 'موضوع الرسالة',
    topics: { demo: 'طلب عرض توضيحي', pricing: 'سؤال عن الأسعار', security: 'الأمان والخصوصية', support: 'دعم فني', other: 'موضوع آخر' },
    message: 'رسالتك',
    consent: 'أوافق على استخدام بياناتي للرد على هذه الرسالة فقط',
    submit: 'أرسل الرسالة',
    success: 'وصلتنا رسالتك. سنرد عليك خلال يوم عمل واحد.',
    failure: 'تعذر إرسال الرسالة. حاول مرة أخرى بعد قليل.',
    aside: {
      title: 'قبل أن تكتب',
      points: [
        'إن أردت تجربة المنصة فلا تحتاج إلى انتظارنا. ابدأ التجربة مباشرة.',
        'إن كان سؤالك عن الخصوصية أو الاستضافة فاذكر نشاط المعالجة لديك حتى تكون الإجابة دقيقة.',
        'لا ترسل بيانات مستفيدين حقيقية في نموذج التواصل.',
      ],
    },
  },
  legal: {
    updated: 'آخر تحديث',
    tocTitle: 'محتويات الصفحة',
    terms: {
      title: 'شروط الاستخدام',
      intro:
        'تنظم هذه الشروط استخدام منصة برنامج أو إس. استخدام المنصة أو إنشاء مساحة عمل عليها يعني الموافقة عليها. إن كنت توافق نيابة عن جهة فأنت تقر بأنك مخول بذلك.',
      sections: [
        {
          title: 'الخدمة',
          body: 'تتيح المنصة إدارة البرامج والمبادرات واستقبال الطلبات وتقييمها واتخاذ القرار فيها ومتابعة التنفيذ وقياس النتائج وإصدار التقارير. تُقدم الخدمة عبر الإنترنت ويجري تطويرها باستمرار، وقد تُضاف مزايا أو تُعدل مع إشعار مسبق بالتغييرات الجوهرية.',
        },
        {
          title: 'الحساب ومساحة العمل',
          body: 'مساحة العمل تعود للجهة لا للأفراد. يحدد مدير الجهة الأعضاء وأدوارهم ونطاق وصولهم، وهو مسؤول عن صحة هذا التحديد. على كل مستخدم حماية بيانات دخوله وتفعيل التحقق بخطوتين حين يُطلب منه، وإبلاغنا فور الاشتباه في وصول غير مصرح به.',
        },
        {
          title: 'الاستخدام المقبول',
          body: 'يلتزم المستخدم بالأنظمة السعودية النافذة، وبعدم إدخال بيانات لا يملك أساسًا نظاميًا لمعالجتها، وبعدم استخدام المنصة لإيذاء الغير أو الوصول إلى بيانات جهة أخرى أو تعطيل الخدمة أو تجاوز حدود الاستخدام العادل المنصوص عليها في الباقة.',
        },
        {
          title: 'بيانات العميل',
          body: 'تبقى البيانات التي تدخلها الجهة ملكًا لها. نعالجها بصفتنا جهة معالجة وفق تعليماتها ولغرض تشغيل الخدمة فقط. لا نبيع بيانات العملاء ولا نستخدمها في تدريب نماذج، ولا نطلع عليها إلا بموافقة صريحة أو حين يلزم لتشغيل الخدمة، وكل اطلاع من هذا النوع مسجل ومحدد المدة.',
        },
        {
          title: 'الاشتراك والدفع',
          body: 'تبدأ التجربة مجانًا لأربعة عشر يومًا. بعدها تُصدر فاتورة وفق الباقة المختارة وتُسدد خلال المهلة المذكورة فيها. عند التأخر تُمنح فترة سماح ثم تُعلَّق مساحة العمل مع بقاء البيانات كما هي. لا يترتب على التعليق حذف، ويستأنف العمل فور السداد.',
        },
        {
          title: 'مستوى الخدمة والتوافر',
          body: 'نستهدف توافرًا شهريًا لا يقل عن 99.5% مقاسًا بتحقق خارجي، ونجري الصيانة في نوافذ معلنة قدر الإمكان. لا يُفسر هذا الهدف التزامًا تعاقديًا ما لم يرد في عقد موقَّع يحدد طريقة القياس والتعويض.',
        },
        {
          title: 'الملكية الفكرية',
          body: 'المنصة وشفرتها وتصميمها وعلاماتها مملوكة لنا. لا يمنح الاشتراك أي حق في نسخها أو اشتقاق أعمال منها أو إعادة بيعها، ويمنح حق استخدامها للغرض المتفق عليه طوال مدة الاشتراك.',
        },
        {
          title: 'الإنهاء',
          body: 'للجهة إنهاء اشتراكها متى شاءت، ولنا إنهاؤه عند مخالفة جوهرية للشروط بعد إشعار ومهلة معالجة. عند الإنهاء تُمنح الجهة مهلة لتصدير بياناتها كاملة قبل الإتلاف النهائي، ويبقى سجل التدقيق وشواهد الإتلاف بوصفها دليل تنفيذ.',
        },
        {
          title: 'حدود المسؤولية',
          body: 'تُقدم الخدمة بالحالة التي هي عليها مع بذل عناية مهنية معقولة. لا نتحمل الأضرار غير المباشرة أو الفائت من الربح. وفي كل الأحوال لا تتجاوز مسؤوليتنا الإجمالية ما سددته الجهة خلال الاثني عشر شهرًا السابقة للواقعة، ما لم ينص نظام آمر على خلاف ذلك.',
        },
        {
          title: 'النظام الواجب التطبيق',
          body: 'تخضع هذه الشروط للأنظمة المعمول بها في المملكة العربية السعودية، وتختص الجهات القضائية السعودية بالنظر في أي نزاع ينشأ عنها.',
        },
        {
          title: 'تعديل الشروط',
          body: 'قد نعدل هذه الشروط. نُشعر الجهات بالتغييرات الجوهرية قبل سريانها بمدة معقولة عبر البريد المسجل ومن داخل المنصة، ويعني الاستمرار في الاستخدام بعد السريان قبولًا بالنسخة المحدثة.',
        },
      ],
    },
    privacy: {
      title: 'سياسة الخصوصية',
      intro:
        'توضح هذه السياسة كيف نتعامل مع البيانات الشخصية في منصة برنامج أو إس. نميز بين حالتين: بيانات المستفيدين التي تدخلها الجهة العميلة وتكون هي جهة التحكم فيها ونكون نحن جهة معالجة، وبيانات حسابات التعاقد والزوار التي نكون نحن جهة التحكم فيها.',
      sections: [
        {
          title: 'دورنا في كل حالة',
          body: 'عندما تدير جهة برنامجها على المنصة فهي التي تحدد غرض معالجة بيانات مستفيديها ووسيلتها، ونحن نعالجها وفق تعليماتها ولتشغيل الخدمة فقط. أما بياناتك أنت بصفتك ممثلًا للجهة أو زائرًا يراسلنا، فنحن جهة التحكم فيها ونعالجها لإدارة العلاقة والرد عليك.',
        },
        {
          title: 'ما نجمعه عنك',
          body: 'بيانات الحساب مثل الاسم والبريد واسم الجهة والدور. بيانات الاستخدام التقنية اللازمة للتشغيل والأمان مثل وقت الدخول ومعرّف الطلب. وما ترسله إلينا طوعًا في نموذج التواصل. لا نستخدم أدوات تتبع إعلانية ولا نبني ملفات اهتمامات.',
        },
        {
          title: 'ملفات الارتباط',
          body: 'نستخدم ملفات ارتباط ضرورية فقط: ملف الجلسة لإبقائك مسجل الدخول، وملف يحفظ اللغة، وملف يحفظ الوضع الفاتح أو الداكن. لا توجد ملفات ارتباط إعلانية أو تحليلية من طرف ثالث.',
        },
        {
          title: 'أساس المعالجة',
          body: 'نعالج بيانات الحساب لتنفيذ العقد معك، وبيانات الأمان والسجلات لمصلحة مشروعة في حماية الخدمة والوفاء بالالتزامات النظامية، وما ترسله في نموذج التواصل بناء على موافقتك التي تستطيع سحبها في أي وقت.',
        },
        {
          title: 'مشاركة البيانات',
          body: 'لا نبيع البيانات الشخصية. نشاركها فقط مع مزودي خدمة لازمين للتشغيل مثل الاستضافة والبريد، بعقود تقصر استخدامهم على ما نطلبه، ومع الجهات المختصة حين يوجب النظام ذلك. أي نقل خارج المملكة يخضع لتقييم مسبق وضوابط تعاقدية.',
        },
        {
          title: 'مدة الاحتفاظ',
          body: 'تحدد كل جهة مدد الاحتفاظ ببيانات مستفيديها داخل مساحتها، وتنفذ المنصة الإتلاف باعتماد بشري مع شاهد موثق. أما بيانات التعاقد فنحتفظ بها طوال العلاقة وللمدة التي توجبها الأنظمة بعدها. ورسائل التواصل تُحذف بعد انتهاء الغرض منها.',
        },
        {
          title: 'حقوقك',
          body: 'لك الحق في العلم والاطلاع والحصول على نسخة وطلب التصحيح أو الإتلاف وسحب الموافقة. إن كانت بياناتك لدى جهة تستخدم المنصة فالطلب يُوجه إليها بوصفها جهة التحكم، وتوفر لها المنصة أدوات تنفيذ هذه الحقوق ومتابعة مهلها. وإن كانت لدينا فراسلنا مباشرة.',
        },
        {
          title: 'الأمان',
          body: 'تشفير النقل، وتجزئة كلمات المرور، وتحقق بخطوتين إلزامي لمن يصل إلى بيانات الجهة، وعزل بين الجهات يُختبر آليًا، وفحص للمرفقات، وسجل تدقيق لكل عملية مع معرّف تتبع. ولا يعني أي من ذلك غياب المخاطر تمامًا، ولذلك لدينا مسار حوادث موثق.',
        },
        {
          title: 'الحوادث',
          body: 'نسجل وقت العلم بالحادثة ونطاقها وتقييمها والإجراء المتخذ، ونصعّدها إلى الجهة العميلة دون تأخير غير مبرر حتى تتمكن من إشعار الجهة المختصة وأصحاب البيانات حين تتحقق شروط ذلك نظامًا.',
        },
        {
          title: 'الذكاء الاصطناعي',
          body: 'المساعد داخل المنصة معطّل افتراضيًا. لا يُفعّل إلا بقرار من مدير الجهة مع إقرار بطريقة المعالجة، ولا تُستخدم بيانات العملاء في تدريب النماذج. تستطيع الجهة إيقافه في أي لحظة فيتوقف أي إرسال خارجي فورًا.',
        },
        {
          title: 'التواصل بشأن الخصوصية',
          body: 'لأي سؤال أو طلب يتعلق بهذه السياسة استخدم صفحة التواصل واختر موضوع الأمان والخصوصية، ونرد خلال المهلة النظامية.',
        },
      ],
    },
  },
  footer: {
    tagline: 'منصة إدارة البرامج والمبادرات وقياس الأثر.',
    product: 'المنتج',
    company: 'الجهة',
    legal: 'الوثائق',
    guide: 'دليل المستخدم (PDF)',
    rights: 'جميع الحقوق محفوظة.',
    madeIn: 'مبنية للسوق السعودي.',
  },
} as const;

type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: Widen<T[K]> }
      : T;

export type SiteCopy = Widen<typeof ar>;

const en: SiteCopy = {
  meta: {
    title: 'ProgramOS · Program management and impact measurement',
    description:
      'A Saudi platform that runs the whole program cycle from registration to decision to attendance, measures results with verified baseline and endline pairs, and produces reports anyone can reproduce.',
  },
  nav: {
    product: 'Product',
    measurement: 'Impact',
    security: 'Security',
    pricing: 'Pricing',
    contact: 'Contact',
    login: 'Sign in',
    start: 'Start a free trial',
    menu: 'Menu',
  },
  hero: {
    eyebrow: 'A Saudi platform for programs and initiatives',
    title: 'Run your programs, and prove what they achieved',
    body: 'ProgramOS brings applications, review, decisions, attendance and measurement into one place. You know where every participant stands at any moment, and you produce a report where every figure can be traced back to its source.',
    primary: 'Start a 14 day free trial',
    secondary: 'See how it works',
    note: 'No credit card. Your workspace is ready in minutes.',
    scene: 'One program inside the platform, from setup to the final report, in seven recorded stages.',
    mock: {
      caption: 'Dashboard',
      kpis: [
        { label: 'Programs', value: '12' },
        { label: 'Applications', value: '348' },
        { label: 'Enrolled', value: '196' },
        { label: 'Completion', value: '82%' },
      ],
      chart: 'Program fill',
      bars: [
        { label: 'Leadership skills', value: 92 },
        { label: 'Entrepreneurship', value: 74 },
        { label: 'Technical training', value: 58 },
        { label: 'Career guidance', value: 41 },
      ],
      change: 'Mean change in skill level',
      changeValue: '+18',
      changeUnit: 'points',
      pairs: 'across 64 verified measurement pairs',
    },
  },
  trust: [
    { title: 'Data stays in Saudi Arabia', body: 'Database, files and backups in a region you choose.' },
    { title: 'Complete tenant isolation', body: 'Every organization in its own space. No query, report or file crosses the line.' },
    { title: 'An audit record for everything', body: 'Who did what, when and why, with the identifier that ties it to its request.' },
    { title: 'Arabic and English together', body: 'A full interface in both directions, with Riyadh time on every screen.' },
  ],
  problem: {
    title: 'Scattered files cost more than you think',
    body: 'When applications live in a spreadsheet, attendance in a chat group, and results in one person’s file, every simple question turns into a project of its own.',
    pains: [
      { title: 'Nobody knows where a participant stands', body: 'The application is in an inbox, the decision in a conversation, the attendance on paper. Answering takes three people and a day.' },
      { title: 'The report cannot be reproduced', body: 'A number in a slide deck traces back to nothing. Ask where it came from a month later and no one can say.' },
      { title: 'Impact stays an impression', body: 'You know the program helps, but you have no baseline and endline pair proving how much changed and for whom.' },
    ],
  },
  audience: {
    title: 'Built for people who run programs that reach real lives',
    body: 'Not a general project tool. Every screen is shaped around the participant, the program and the result.',
    items: [
      { title: 'Nonprofits and foundations', body: 'Training, empowerment and care programs, with the reports a funder and a regulator ask for at the end of every cycle.' },
      { title: 'Government and development programs', body: 'Initiatives spanning several programs, needing one picture and figures that hold up in front of a committee.' },
      { title: 'Training providers and accelerators', body: 'Successive cohorts with registration, screening, acceptance and attendance, and a measure of what actually changed for the participant.' },
    ],
  },

  modules: {
    title: 'A module for every step of the journey',
    body: 'Everything needed to run a program from first idea to final report, with no side tools.',
    items: [
      { title: 'Initiatives and programs', body: 'Create a program with its dates, capacity and completion rule, and drive its life cycle from draft to archive.' },
      { title: 'Forms and applications', body: 'Design the application form with defined fields, and freeze its version with each application so the rules cannot shift after submission.' },
      { title: 'Review and decisions', body: 'Weighted criteria, assigned reviewers, declared conflicts of interest, and a decision whose written justification stays on record.' },
      { title: 'Beneficiaries and enrollments', body: 'One profile inside the organization gathering a person’s applications, enrollments, attendance and results.' },
      { title: 'Activities and attendance', body: 'A schedule and an attendance record, with a completion rule computed by the system rather than assumed.' },
      { title: 'Indicators and impact', body: 'Indicators with units and targets, and baseline and endline measurements verified before they reach any report.' },
      { title: 'Reports and export', body: 'Operational and results dashboards, saved snapshots that never shift, and exports behind a short lived link that is re-checked.' },
      { title: 'Privacy and audit', body: 'Data subject requests, a retention policy, and deletion approved by a person and recorded with a tombstone.' },
    ],
  },
  journey: {
    eyebrow: 'How it works',
    title: 'From open registration to a report you can defend',
    body: 'The same journey your team lives today, in one path where every step is recorded.',
    steps: [
      { title: 'Set the program up', body: 'Dates, capacity, application form, review criteria and privacy notice.' },
      { title: 'Open registration', body: 'A person applies, receives a reference number, and your team is notified at once.' },
      { title: 'Review and decide', body: 'The coordinator screens, the reviewer scores against weighted criteria, the manager decides with a written reason.' },
      { title: 'Deliver and follow up', body: 'Activities, attendance and completion tracking, with suspension, resumption and withdrawal where needed.' },
      { title: 'Measure and publish', body: 'Verified baseline and endline measurements, then a report frozen as a snapshot you can revisit a year later.' },
    ],
  },
  measurement: {
    eyebrow: 'What sets the platform apart',
    title: 'We measure change, and never claim what the measurement cannot carry',
    body: 'Most reports show a single number with no source behind it. Here every figure traces back to verified individual measurements, and is shown beside the number of complete pairs and the coverage, so the reader sees the strength of the evidence and not only the result.',
    points: [
      { title: 'A measurement pair per participant', body: 'One reading before the program and one after, for the same person. An incomplete pair never enters the calculation and is never hidden.' },
      { title: 'Verified before it counts', body: 'A measurement stays a draft until the impact specialist verifies it, and correcting it later requires a reason and keeps the previous value.' },
      { title: 'Coverage stated openly', body: 'If measurement is complete for forty of sixty participants, the report says so instead of generalising to everyone.' },
      { title: 'No leap to causality', body: 'The difference between before and after is called change. Attributing it to the program alone is a claim that needs a different research design, and we say so plainly.' },
    ],
    note: 'That clarity is not false modesty. It is what makes your report defensible in front of a funder or a regulator.',
  },
  security: {
    eyebrow: 'Security and privacy',
    title: 'Built on the idea that data is held in trust',
    body: 'A participant hands you their data because they want a service, not to become a row in a file. The controls below are not settings that can be forgotten. They are part of how the product is built.',
    items: [
      { title: 'Two step verification, required', body: 'For everyone on the team who reaches organization data, with sessions that end on idle or after twelve hours.' },
      { title: 'Permissions scoped to programs', body: 'A reviewer sees only what was assigned to them, and a viewer sees aggregate figures with no names.' },
      { title: 'Data subject rights', body: 'Access, copy, correction, erasure and withdrawal of consent are implemented paths with statutory deadlines and follow up.' },
      { title: 'Disciplined retention and deletion', body: 'A retention period per organization, a deletion queue an admin approves, and a legal hold that stops deletion when needed.' },
      { title: 'Attachment scanning', body: 'Every file is scanned before it becomes downloadable, and a suspicious file is quarantined and cannot carry an application.' },
      { title: 'Traceability', body: 'A correlation identifier on every response and every audit row, so an incident can be followed end to end.' },
    ],
  },
  platform: {
    title: 'Open to your tools, with an assistant that never decides for you',
    api: {
      title: 'A public API and event delivery',
      body: 'Read programs, applications and results with a scoped key, and receive events as they happen through a signed request. Connectors send only what your field map allows, and an outside system going down stays inside a retry queue without stopping a program.',
      points: ['Scoped keys with rotation and instant revocation', 'A signature covering the timestamp, so a captured request cannot be replayed', 'A calendar address per program that works in any client'],
    },
    ai: {
      title: 'An optional assistant, under your control',
      body: 'It drafts a program description, summarises results, and answers from your own documents. It is off until you enable it, has a monthly spending cap, and every number in its summary must match a measurement in the system or the summary is refused outright.',
      points: ['It never accepts, rejects or ranks anyone', 'Its output stays a draft until a named person approves it', 'Retrieval never leaves your organization'],
    },
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'A plan that grows with your programs',
    body: 'Fourteen days free with every feature. After that you pick what fits your size, and change it whenever you like.',
    perMonth: 'per month',
    free: 'Free',
    cta: 'Start on this plan',
    contactCta: 'Talk to us',
    limits: { programs: 'programs', members: 'team members', enrollments: 'enrollments' },
    unlimited: 'Unlimited',
    featured: 'Most chosen',
    includes: 'Includes',
    featureLabels: {
      reports: 'Report dashboards and snapshots',
      exports: 'CSV export',
      impact: 'Impact measurement with baseline and endline',
      api: 'Public API and event notifications',
      import: 'CSV import',
      assistant: 'Assistant',
      sso: 'Single sign on',
      messaging: 'SMS and WhatsApp',
      support: 'Named account manager',
    },
    payment: 'Pay by mada, credit card or Apple Pay, or by bank transfer against a referenced invoice.',
    nonprofit: 'Licensed non profit organizations receive 20% off paid plans once the licence is verified, and annual contracts at the price of eleven months.',
    featuresTitle: 'In every plan',
    features: [
      'A full Arabic and English interface',
      'Two step verification and an audit log',
      'Data subject rights and a retention policy',
      'CSV export and frozen report snapshots',
      'In app and email notifications',
      'Support over email',
    ],
    vat: 'Prices exclude value added tax.',
    faqTitle: 'Questions about subscribing',
    faq: [
      { q: 'Do I need a credit card for the trial?', a: 'No. The trial runs a full fourteen days with no card, and you decide afterwards.' },
      { q: 'What happens if the trial ends and I do not subscribe?', a: 'Writing stops and your data stays exactly as it is, readable and exportable. Nothing is deleted when a trial ends.' },
      { q: 'Can I change plan later?', a: 'Yes. An upgrade applies at once, a downgrade applies at renewal, and a downgrade that would strand data above the new limits is refused.' },
      { q: 'How do I pay?', a: 'Online with mada, a credit card or Apple Pay through a licensed Saudi gateway, with the subscription active the moment the payment succeeds. Or by bank transfer against a referenced invoice, activated once the transfer is confirmed.' },
      { q: 'Can I export my data if I decide to leave?', a: 'Yes. Every module is exported as CSV together with the audit log, and a window is set before final deletion.' },
    ],
  },
  faq: {
    title: 'Common questions',
    items: [
      { q: 'How long does the first program take to set up?', a: 'Usually under an hour. You create the workspace, invite your team, build the form and criteria, then open registration.' },
      { q: 'Does the platform suit an organization running a single program?', a: 'Yes. The free plan is built for one program and a small team, and you move up when you need to.' },
      { q: 'Can I import beneficiaries from a file I already have?', a: 'Yes, from a CSV file, with a preview showing the fate of every row and the reason for every rejection before anything is created.' },
      { q: 'Who can see personal data?', a: 'Only those whose work needs it. A viewer sees aggregates, a reviewer sees the applications assigned to them, and every access is recorded.' },
      { q: 'Can the platform connect to our systems?', a: 'Yes, through a scoped API, signed event delivery, and connectors for calendars, learning systems, customer relationship tools and analytics.' },
      { q: 'Where is the data stored?', a: 'In the region the organization chooses, and the initial design places the database, files and backups inside Saudi Arabia.' },
    ],
  },
  cta: {
    title: 'Try it on a real program',
    body: 'Create your workspace today and run one program end to end. If it does not save you real time, nothing obliges you to continue.',
    primary: 'Start a free trial',
    secondary: 'Request a walkthrough',
  },
  contact: {
    title: 'Contact us',
    body: 'Tell us what you run today and what you need, and we reply within one working day.',
    name: 'Name',
    email: 'Email',
    organization: 'Organization',
    phone: 'Mobile number',
    phoneHint: 'Optional, in international format starting with a plus',
    topic: 'Topic',
    topics: { demo: 'Request a walkthrough', pricing: 'A question about pricing', security: 'Security and privacy', support: 'Technical support', other: 'Something else' },
    message: 'Your message',
    consent: 'I agree that my details are used to answer this message only',
    submit: 'Send message',
    success: 'Your message reached us. We reply within one working day.',
    failure: 'The message could not be sent. Please try again shortly.',
    aside: {
      title: 'Before you write',
      points: [
        'If you want to try the platform you do not need to wait for us. Start the trial directly.',
        'If your question is about privacy or hosting, describe your processing activity so the answer is precise.',
        'Please do not send real beneficiary data through this form.',
      ],
    },
  },
  legal: {
    updated: 'Last updated',
    tocTitle: 'On this page',
    terms: {
      title: 'Terms of use',
      intro:
        'These terms govern use of the ProgramOS platform. Using the platform or creating a workspace on it means accepting them. If you accept on behalf of an organization, you confirm you are authorised to do so.',
      sections: [
        { title: 'The service', body: 'The platform manages programs and initiatives, receives and reviews applications, records decisions, tracks delivery, measures results and produces reports. It is delivered over the internet and developed continuously, and features may be added or changed with advance notice of material changes.' },
        { title: 'Accounts and workspaces', body: 'A workspace belongs to the organization, not to individuals. The organization admin sets members, roles and scope of access, and is responsible for that setting. Each user protects their credentials, enables two step verification when required, and tells us at once if they suspect unauthorised access.' },
        { title: 'Acceptable use', body: 'Users comply with applicable Saudi regulations, do not enter data they have no lawful basis to process, and do not use the platform to harm others, reach another organization’s data, disrupt the service, or exceed the fair use limits stated in their plan.' },
        { title: 'Customer data', body: 'Data entered by an organization remains its property. We process it as a processor, under its instructions, solely to operate the service. We do not sell customer data, do not use it to train models, and access it only with explicit approval or where operating the service requires it, with every such access recorded and time bound.' },
        { title: 'Subscription and payment', body: 'A trial runs free for fourteen days. After that an invoice is issued for the chosen plan and settled within the stated period. Late payment leads to a grace period and then suspension of the workspace with data left intact. Suspension never deletes anything, and work resumes as soon as payment is recorded.' },
        { title: 'Service level and availability', body: 'We target monthly availability of at least 99.5% measured by external verification, and schedule maintenance in announced windows where possible. This target is not a contractual commitment unless it appears in a signed contract defining measurement and remedy.' },
        { title: 'Intellectual property', body: 'The platform, its code, design and marks belong to us. A subscription grants no right to copy it, derive works from it, or resell it, and grants the right to use it for the agreed purpose throughout the subscription.' },
        { title: 'Termination', body: 'An organization may end its subscription at any time, and we may end it for a material breach after notice and a period to remedy. On termination the organization is given a window to export all of its data before final deletion, while the audit log and deletion tombstones remain as evidence of what was done.' },
        { title: 'Limitation of liability', body: 'The service is provided as it stands, with reasonable professional care. We are not liable for indirect damages or lost profit. In every case our total liability does not exceed what the organization paid in the twelve months before the event, unless mandatory law provides otherwise.' },
        { title: 'Governing law', body: 'These terms are governed by the laws in force in the Kingdom of Saudi Arabia, and Saudi courts have jurisdiction over any dispute arising from them.' },
        { title: 'Changes to these terms', body: 'We may amend these terms. Organizations are notified of material changes a reasonable time before they take effect, by email and inside the platform, and continued use after they take effect means acceptance of the updated version.' },
      ],
    },
    privacy: {
      title: 'Privacy policy',
      intro:
        'This policy explains how personal data is handled in ProgramOS. Two cases are distinguished: beneficiary data entered by a customer organization, where that organization is the controller and we are the processor, and contracting and visitor data, where we are the controller.',
      sections: [
        { title: 'Our role in each case', body: 'When an organization runs its program on the platform, it determines the purpose and means of processing its beneficiaries’ data, and we process that data under its instructions solely to operate the service. Your own data, as a representative of an organization or a visitor who writes to us, is data we control and process to manage the relationship and reply to you.' },
        { title: 'What we collect about you', body: 'Account data such as name, email, organization and role. Technical usage data needed for operation and security, such as sign in time and request identifier. And whatever you choose to send us through the contact form. We use no advertising trackers and build no interest profiles.' },
        { title: 'Cookies', body: 'We use strictly necessary cookies only: a session cookie to keep you signed in, one that stores the language, and one that stores light or dark appearance. There are no advertising or third party analytics cookies.' },
        { title: 'Basis for processing', body: 'Account data is processed to perform our contract with you. Security data and logs rest on a legitimate interest in protecting the service and meeting regulatory obligations. What you send through the contact form rests on your consent, which you may withdraw at any time.' },
        { title: 'Sharing', body: 'We do not sell personal data. We share it only with service providers necessary to operate, such as hosting and email, under contracts limiting their use to what we instruct, and with competent authorities where the law requires. Any transfer outside the Kingdom is subject to prior assessment and contractual safeguards.' },
        { title: 'Retention', body: 'Each organization sets retention periods for its beneficiaries’ data inside its workspace, and the platform carries out deletion with human approval and a recorded tombstone. Contracting data is kept for the life of the relationship and for the period the regulations require afterwards. Contact messages are deleted once their purpose ends.' },
        { title: 'Your rights', body: 'You have the right to be informed, to access, to obtain a copy, to request correction or erasure, and to withdraw consent. If your data sits with an organization using the platform, the request goes to that organization as the controller, and the platform gives it the tools to fulfil these rights and track their deadlines. If the data sits with us, write to us directly.' },
        { title: 'Security', body: 'Encryption in transit, hashed passwords, mandatory two step verification for anyone reaching organization data, tenant isolation tested automatically, attachment scanning, and an audit record of every operation with a correlation identifier. None of this means risk is absent, which is why we maintain a documented incident path.' },
        { title: 'Incidents', body: 'We record when we learned of an incident, its scope, its assessment and the action taken, and escalate to the customer organization without undue delay so it can notify the competent authority and data subjects where the conditions for that are met.' },
        { title: 'Artificial intelligence', body: 'The in platform assistant is disabled by default. It is enabled only by a decision of the organization admin with an acknowledgement of how data is processed, and customer data is not used to train models. An organization can switch it off at any moment, and all outbound sending stops immediately.' },
        { title: 'Privacy contact', body: 'For any question or request about this policy use the contact page and choose the security and privacy topic. We reply within the statutory period.' },
      ],
    },
  },
  footer: {
    tagline: 'Program and initiative management with impact measurement.',
    product: 'Product',
    company: 'Company',
    legal: 'Documents',
    guide: 'User guide (PDF)',
    rights: 'All rights reserved.',
    madeIn: 'Built for the Saudi market.',
  },
};

const copy: Record<Locale, SiteCopy> = { ar, en };
export function getSiteCopy(locale: Locale): SiteCopy {
  return copy[locale];
}

/** The date shown on the legal pages. Bump it when the wording changes. */
export const LEGAL_UPDATED = '2026-09-13';
