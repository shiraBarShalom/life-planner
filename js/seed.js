// Initial personal data. Everything here is editable in the app.
import { today, weekStart } from './date.js';

export const SCHEMA = 1;
let n = 0;
const id = (p) => `${p}-${(++n).toString(36)}`;

export const DEFAULT_SETTINGS = {
  wake: '04:30',
  bed: '21:00',
  sleepTarget: 7.5,
  commuteMin: 40,
  workStart: '08:00',
  workEnd: '17:00',
  exerciseMin: 30,
  viewStart: '04:00',
  viewEnd: '21:30',
  theme: 'auto', // auto | light | dark
  defaultPattern: 'regular',
  autoPlan: false,
  exportTheme: 'blush', // blush | night
  customQuotes: [],
  name: '',
  planner: {
    // relative weights for the weekly planner (higher = more focus time)
    infi1: 1.2, infi2: 1.1, db: 1.0, amiram: 1.0,
    learnFirstH: 3, // hours of material catch-up planned before solving an assignment
    minAssignmentBlock: 90,
  },
};

export const CATEGORIES = [
  { id: 'study', name: 'לימודים', color: '#C76D7E', icon: 'book', target: 14 },
  { id: 'lesson', name: 'שיעור / זום', color: '#D98BA0', icon: 'school', target: 0 },
  { id: 'assignment', name: 'מטלות', color: '#B4545F', icon: 'flag', target: 0 },
  { id: 'exam', name: 'מבחנים', color: '#C9A15E', icon: 'target', target: 4 },
  { id: 'career', name: 'קריירה', color: '#6E9C9A', icon: 'briefcase', target: 6 },
  { id: 'project', name: 'פרויקט אישי', color: '#8AA27A', icon: 'cpu', target: 3 },
  { id: 'english', name: 'אנגלית מדוברת', color: '#7192BC', icon: 'globe', target: 2 },
  { id: 'confidence', name: 'צמיחה אישית', color: '#DE8AAE', icon: 'heart', target: 3 },
  { id: 'exercise', name: 'תנועה וספורט', color: '#E2A285', icon: 'run', target: 3.5 },
  { id: 'driving', name: 'נהיגה', color: '#A27FB8', icon: 'car', target: 0 },
  { id: 'work', name: 'עבודה', color: '#998AA6', icon: 'briefcase', target: 27 },
  { id: 'commute', name: 'נסיעה', color: '#B4AAA6', icon: 'route', target: 0 },
  { id: 'home', name: 'בית וסידורים', color: '#B9A27A', icon: 'home', target: 0 },
  { id: 'family', name: 'משפחה ושבת', color: '#B89CCB', icon: 'users', target: 0 },
  { id: 'break', name: 'ארוחות והפסקות', color: '#E3C29E', icon: 'coffee', target: 0 },
  { id: 'routine', name: 'שגרה', color: '#C8B8AE', icon: 'sun', target: 0 },
  { id: 'personal', name: 'קריאה ואישי', color: '#C0968A', icon: 'book', target: 2 },
];

export const PATTERNS = {
  regular: { name: 'שבוע רגיל (עבודה ב׳–ד׳)', work: [1, 2, 3], zoom: [] },
  zoom: { name: 'שבוע עם זום בשני (עבודה ג׳–ה׳)', work: [2, 3, 4], zoom: [1] },
};

export const DAY_TYPES = {
  work: 'יום עבודה',
  zoom: 'יום זום אוניברסיטה',
  study: 'יום לימודים',
  friday: 'שישי – בית והכנות לשבת',
  shabbat: 'שבת – מנוחה ומשפחה',
};

function series(from, title, cat, start, end, types, extra = {}) {
  return {
    id: id('s'), title, cat, start, end,
    rec: { kind: 'daytype', types },
    from, until: null, fixed: false, notes: '',
    courseId: null, goalId: null, assignmentId: null, slot: null, tag: null,
    exceptions: {}, done: {}, actual: {},
    ...extra,
  };
}

function buildTemplates(from) {
  const S = (...a) => series(from, ...a);
  const WEEKDAYS = ['work', 'zoom', 'study', 'friday'];
  const NONFRI = ['work', 'zoom', 'study'];
  return [
    // Every morning
    S('קימה, כוס מים ופתיחת יום', 'routine', '04:30', '04:45', WEEKDAYS, { tag: 'wake', goalId: 'g-health' }),
    S('הליכה / מתיחות / אימון ביתי', 'exercise', '04:45', '05:15', WEEKDAYS, { tag: 'exercise', goalId: 'g-health', notes: '30 דקות תנועה. אפשר לשלב תרגול יציבה זקופה.' }),
    S('מקלחת והתארגנות', 'routine', '05:15', '05:30', WEEKDAYS),

    // Workday
    S('בלוק למידה עמוק', 'study', '05:30', '07:00', ['work'], { slot: 'focus', goalId: 'g-academic' }),
    S('התארגנות וארוחת בוקר', 'break', '07:00', '07:20', ['work']),
    S('נסיעה לעבודה', 'commute', '07:20', '08:00', ['work'], { tag: 'commuteAm', notes: 'אפשר להאזין לפודקאסט או לחזור על אוצר מילים.' }),
    S('עבודה', 'work', '08:00', '17:00', ['work'], { tag: 'work', fixed: true }),
    S('נסיעה הביתה', 'commute', '17:00', '17:40', ['work'], { tag: 'commutePm' }),
    S('ארוחת ערב ומנוחה', 'break', '17:40', '18:30', ['work']),

    // University Zoom day (Monday in a Zoom week)
    S('בלוק למידה עמוק', 'study', '05:30', '07:30', ['zoom'], { slot: 'focus', goalId: 'g-academic' }),
    S('ארוחת בוקר', 'break', '07:30', '08:00', ['zoom']),
    S('קריאה והרחבת ידע', 'personal', '08:00', '08:45', ['zoom']),
    S('הפסקה והכנה לשיעור', 'break', '08:45', '09:00', ['zoom']),
    S('שיעור זום', 'lesson', '09:00', '12:00', ['zoom'], { fixed: true, notes: 'ניתן לשנות תאריך/שעה לכל מפגש בנפרד.' }),
    S('ארוחת צהריים ומנוחה', 'break', '12:00', '13:00', ['zoom']),
    S('סיכום ותרגול אחרי השיעור', 'study', '13:00', '14:30', ['zoom'], { goalId: 'g-academic' }),
    S('הפסקה', 'break', '14:30', '15:00', ['zoom']),
    S('קריירה', 'career', '15:00', '16:30', ['zoom'], { slot: 'career', goalId: 'g-career' }),
    S('ארוחת ערב', 'break', '17:45', '18:30', ['zoom', 'study']),

    // Non-work study day
    S('בלוק למידה עמוק', 'study', '05:30', '07:45', ['study'], { slot: 'focus', goalId: 'g-academic' }),
    S('ארוחת בוקר', 'break', '07:45', '08:15', ['study']),
    S('בלוק למידה עמוק', 'study', '08:15', '10:30', ['study'], { slot: 'focus', goalId: 'g-academic' }),
    S('הפסקה והליכה קצרה', 'break', '10:30', '11:00', ['study']),
    S('תרגול שאלות וחזרה', 'study', '11:00', '12:00', ['study'], { goalId: 'g-academic' }),
    S('ארוחת צהריים ומנוחה', 'break', '12:00', '13:00', ['study']),
    S('קריירה', 'career', '13:00', '15:00', ['study'], { slot: 'career', goalId: 'g-career' }),
    S('הפסקה', 'break', '15:00', '15:30', ['study']),
    S('פרויקט אישי', 'project', '15:30', '17:00', ['study']),

    // Evenings (Sun–Thu)
    S('שיחה והקשבה באנגלית', 'english', '18:30', '18:50', NONFRI, { notes: '20 דקות: לדבר בקול, להאזין לפודקאסט.' }),
    S('זמן חופשי ומשפחה', 'family', '18:50', '19:40', NONFRI, { goalId: 'g-home' }),
    S('קריאה + רפלקציה יומית', 'confidence', '19:40', '20:10', NONFRI, { notes: 'מה עשיתי היום שדרש אומץ? מה למדתי?' }),
    S('הכנה למחר וסגירת מסכים', 'routine', '20:10', '20:40', NONFRI),
    S('רגיעה לפני שינה', 'routine', '20:40', '21:00', NONFRI, { tag: 'winddown' }),

    // Friday
    S('בלוק למידה עמוק', 'study', '05:30', '07:30', ['friday'], { slot: 'focus', goalId: 'g-academic' }),
    S('ארוחת בוקר', 'break', '07:30', '08:00', ['friday']),
    S('סקירה ותכנון שבועי', 'personal', '08:00', '08:30', ['friday'], { notes: 'מה הצליח? מה לשפר? מה העדיפויות לשבוע הבא?' }),
    S('ניקיון וסידור הבית', 'home', '08:30', '11:00', ['friday'], { goalId: 'g-home', notes: 'אפשר להאזין לפודקאסט באנגלית בזמן הניקיון.' }),
    S('הפסקה', 'break', '11:00', '11:30', ['friday']),
    S('סידורים ומשימות בית', 'home', '11:30', '12:30', ['friday'], { goalId: 'g-home' }),
    S('ארוחת צהריים', 'break', '12:30', '13:15', ['friday']),
    S('הכנות לשבת – בישול', 'home', '13:15', '15:00', ['friday'], { goalId: 'g-home' }),
    S('הכנות אחרונות לשבת', 'home', '15:00', '16:00', ['friday'], { goalId: 'g-home' }),
    S('שבת – ארוחה וזמן משפחה', 'family', '16:00', '20:30', ['friday'], { fixed: true }),

    // Shabbat
    S('הליכה רגועה', 'exercise', '07:00', '07:30', ['shabbat'], { goalId: 'g-health' }),
    S('זמן משפחה וסעודה', 'family', '09:00', '12:30', ['shabbat'], { fixed: true }),
    S('מנוחה', 'break', '13:00', '15:00', ['shabbat']),
    S('קריאה להנאה', 'personal', '15:00', '16:00', ['shabbat']),
    S('זמן משפחה', 'family', '16:00', '18:00', ['shabbat']),
    S('מוצאי שבת – רגיעה', 'routine', '18:00', '19:00', ['shabbat']),
  ];
}

const step = (title, done = false) => ({ id: id('st'), title, done });
const ms = (title, date) => ({ id: id('m'), title, date, done: false });

function buildGoals() {
  return [
    {
      id: 'g-career', title: 'קריירה בפיתוח תוכנה', icon: 'briefcase', color: '#6E9C9A', priority: 1, deadline: null, cats: ['career'],
      outcome: 'הצעת עבודה בתחום שאני אוהבת.', why: '',
      steps: [step('לעדכן קורות חיים'), step('לתרגל שאלות אלגוריתמים'), step('לבנות פרויקט End-to-End'), step('להגיש מועמדויות באופן קבוע')],
      milestones: [], progressMode: 'auto', progress: 0, longTerm: false, notes: '',
    },
    {
      id: 'g-academic', title: 'מצוינות בלימודים', icon: 'school', color: '#C76D7E', priority: 1, deadline: null, cats: ['study', 'lesson', 'assignment', 'exam'],
      outcome: 'להגיש מטלות בזמן ולהגיע מוכנה לבחינות.', why: '',
      steps: [step('להוסיף את הקורסים והמטלות במסך "אוניברסיטה"'), step('ללמוד את החומר לפני פתרון מטלות'), step('לפתור מבחנים קודמים')],
      milestones: [], progressMode: 'auto', progress: 0, longTerm: false, notes: '',
    },
    {
      id: 'g-health', title: 'שגרה בריאה', icon: 'run', color: '#E2A285', priority: 2, deadline: null, cats: ['exercise'],
      outcome: 'שינה מספקת, תנועה כל בוקר, ארוחות והפסקות.', why: '',
      steps: [step('שעת קימה קבועה'), step('30 דקות תנועה בבוקר'), step('שעת שינה קבועה')],
      milestones: [], progressMode: 'auto', progress: 0, longTerm: false, notes: '',
    },
    {
      id: 'g-home', title: 'בית, משפחה וחיים אישיים', icon: 'home', color: '#B9A27A', priority: 3, deadline: null, cats: ['home', 'family', 'personal'],
      outcome: 'בית מסודר וזמן איכות עם המשפחה.', why: '', steps: [step('ניקיון וסידור בימי שישי'), step('זמן משפחה קבוע')],
      milestones: [], progressMode: 'auto', progress: 0, longTerm: false, notes: '',
    },
    { id: 'g-dream', title: 'חלום ארוך טווח', icon: 'sparkle', color: '#DE8AAE', priority: 3, deadline: null, cats: [], outcome: '', why: '', steps: [], milestones: [], progressMode: 'manual', progress: 0, longTerm: true, notes: '' },
  ];
}

function buildCourses() {
  return [];
}

function buildAssignments() {
  return [];
}

function buildTasks(start) {
  const T = (title, cat, extra = {}) => ({
    id: id('t'), title, cat, priority: 2, estimate: 30, deadline: null, date: null, status: 'todo',
    subtasks: [], rec: null, doneDates: {}, notes: '', goalId: null, courseId: null, createdAt: start, ...extra,
  });
  return [
    T('להתאים את השגרה וההגדרות לשעות שלי', 'personal', { priority: 1, date: start, estimate: 15 }),
    T('להוסיף קורסים, מטלות ומועדי הגשה', 'study', { priority: 1, date: start, estimate: 20, goalId: 'g-academic' }),
    T('כביסה וקיפול', 'home', { priority: 3, estimate: 40, rec: { kind: 'weekly', days: [5], every: 1, from: start, until: null }, goalId: 'g-home' }),
  ];
}

const HABITS = [
  { id: 'h-wake', name: 'קימה ב-04:30', icon: 'sun' },
  { id: 'h-move', name: '30 דק׳ תנועה', icon: 'run' },
  { id: 'h-sleep', name: 'שינה ב-21:00', icon: 'moon' },
  { id: 'h-posture', name: 'יציבה זקופה', icon: 'heart' },
  { id: 'h-brave', name: 'אתגר ביטחון', icon: 'sparkle' },
  { id: 'h-english', name: 'דיברתי אנגלית', icon: 'globe' },
  { id: 'h-read', name: 'קריאה', icon: 'book' },
  { id: 'h-scroll', name: 'בלי גלילה מיותרת', icon: 'phone' },
];

export function createSeed({ empty = false } = {}) {
  n = 0;
  const start = weekStart(today());
  const base = {
    schema: SCHEMA,
    meta: { createdAt: Date.now(), updatedAt: Date.now() },
    settings: structuredClone(DEFAULT_SETTINGS),
    categories: structuredClone(CATEGORIES),
    patterns: structuredClone(PATTERNS),
    weekPlans: {},
    series: [], blocks: [], tasks: [], goals: [], courses: [], assignments: [], exams: [],
    habits: structuredClone(HABITS), habitLog: {}, days: {}, reviews: {},
  };
  if (empty) return base;
  base.series = buildTemplates(start);
  base.goals = buildGoals();
  base.courses = buildCourses();
  base.assignments = buildAssignments();
  base.tasks = buildTasks(start);
  base.exams = [];
  base.blocks = [];
  return base;
}
