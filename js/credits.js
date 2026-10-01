// Shared credit taxonomy for the editor and public work pages.
(function () {
  const sections = [
    ['direction', 'Direction & writing', 'کارگردانی و نویسندگی', `Director|کارگردان
Co-director|کارگردان همکار
Assistant director|دستیار کارگردان
First assistant director|دستیار اول کارگردان
Second assistant director|دستیار دوم کارگردان
Showrunner|شورانر
Writer|نویسنده
Co-writer|نویسندهٔ همکار
Screenplay|فیلم‌نامه‌نویس
Story|داستان‌پرداز
Author|مؤلف
Script editor|ویراستار فیلم‌نامه
Script supervisor|منشی صحنه
Story editor|ویراستار داستان
Researcher|پژوهشگر
Game director|کارگردان بازی
Creative director|مدیر خلاقیت
Narrative director|مدیر روایت
Narrative designer|طراح روایت
Game writer|نویسندهٔ بازی
Dialogue writer|نویسندهٔ دیالوگ`],
    ['production', 'Production & management', 'تولید و مدیریت', `Producer|تهیه‌کننده
Executive producer|تهیه‌کنندهٔ اجرایی
Co-producer|تهیه‌کنندهٔ همکار
Associate producer|تهیه‌کنندهٔ مشارکت‌کننده
Line producer|مدیر اجرایی تولید
Production manager|مدیر تولید
Production coordinator|هماهنگ‌کنندهٔ تولید
Production assistant|دستیار تولید
Unit production manager|مدیر واحد تولید
Location manager|مدیر لوکیشن
Location scout|مسئول یافتن لوکیشن
Production accountant|حسابدار تولید
Project manager|مدیر پروژه
Development director|مدیر توسعه
Studio head|مدیر استودیو
Founder|بنیان‌گذار
Scrum master|اسکرام مستر`],
    ['game-design', 'Game design', 'طراحی بازی', `Lead game designer|طراح ارشد بازی
Game designer|طراح بازی
Gameplay designer|طراح گیم‌پلی
Systems designer|طراح سیستم‌های بازی
Level designer|طراح مرحله
Mission designer|طراح مأموریت
Quest designer|طراح کوئست
Combat designer|طراح سیستم مبارزه
Economy designer|طراح اقتصاد بازی
Balance designer|طراح بالانس
Puzzle designer|طراح معما
Multiplayer designer|طراح بخش چندنفره
World designer|طراح جهان بازی
Technical designer|طراح فنی
UX designer|طراح تجربهٔ کاربری
UI designer|طراح رابط کاربری`],
    ['engineering', 'Programming & technology', 'برنامه‌نویسی و فناوری', `Technical director|مدیر فنی
Lead programmer|برنامه‌نویس ارشد
Programmer|برنامه‌نویس
Gameplay programmer|برنامه‌نویس گیم‌پلی
Engine programmer|برنامه‌نویس موتور بازی
Graphics programmer|برنامه‌نویس گرافیک
AI programmer|برنامه‌نویس هوش مصنوعی بازی
Physics programmer|برنامه‌نویس فیزیک
Animation programmer|برنامه‌نویس انیمیشن
Network programmer|برنامه‌نویس شبکه
Audio programmer|برنامه‌نویس صدا
UI programmer|برنامه‌نویس رابط کاربری
Tools programmer|برنامه‌نویس ابزارها
Backend developer|توسعه‌دهندهٔ بک‌اند
Build engineer|مهندس بیلد
DevOps engineer|مهندس دوآپس
Platform engineer|مهندس پلتفرم
Porting engineer|مهندس پورت بازی
Security engineer|مهندس امنیت
Technical support|پشتیبانی فنی`],
    ['art', 'Art & visual design', 'هنر و طراحی بصری', `Art director|مدیر هنری
Lead artist|هنرمند ارشد
Concept artist|هنرمند کانسپت
Character designer|طراح شخصیت
Character artist|هنرمند شخصیت
Environment artist|هنرمند محیط
3D artist|هنرمند سه‌بعدی
3D modeler|مدل‌ساز سه‌بعدی
2D artist|هنرمند دوبعدی
Texture artist|هنرمند بافت
Material artist|هنرمند متریال
Technical artist|هنرمند فنی
Lighting artist|هنرمند نورپردازی
UI artist|هنرمند رابط کاربری
Pixel artist|هنرمند پیکسل‌آرت
Illustrator|تصویرگر
Graphic designer|طراح گرافیک
Cover artist|طراح جلد
Storyboard artist|استوری‌بورد آرتیست
Matte painter|هنرمند نقاشی مات`],
    ['animation', 'Animation & motion capture', 'انیمیشن و موشن کپچر', `Animation director|کارگردان انیمیشن
Animation supervisor|سرپرست انیمیشن
Lead animator|انیماتور ارشد
Animator|انیماتور
Character animator|انیماتور شخصیت
Gameplay animator|انیماتور گیم‌پلی
Cinematic animator|انیماتور سینماتیک
Facial animator|انیماتور چهره
Stop-motion animator|انیماتور استاپ‌موشن
Motion graphics designer|طراح موشن گرافیک
Rigger|ریگر
Rigging supervisor|سرپرست ریگ
Technical animator|انیماتور فنی
Layout artist|هنرمند لی‌اوت
Previsualization artist|هنرمند پیش‌نمایش
Motion capture director|کارگردان موشن کپچر
Motion capture technician|تکنسین موشن کپچر
Motion capture cleanup artist|هنرمند اصلاح موشن کپچر`],
    ['vfx', 'Visual & special effects', 'جلوه‌های بصری و ویژه', `VFX supervisor|سرپرست جلوه‌های بصری
VFX producer|تهیه‌کنندهٔ جلوه‌های بصری
VFX artist|هنرمند جلوه‌های بصری
Real-time VFX artist|هنرمند جلوه‌های بصری بلادرنگ
FX artist|هنرمند افکت
Compositor|کامپوزیتور
Rotoscope artist|هنرمند روتوسکوپی
Matchmove artist|هنرمند مچ‌موو
Simulation artist|هنرمند شبیه‌سازی
Effects technical director|مدیر فنی افکت
Special effects supervisor|سرپرست جلوه‌های ویژهٔ میدانی
Special effects technician|تکنسین جلوه‌های ویژهٔ میدانی
Virtual production supervisor|سرپرست تولید مجازی
Virtual production artist|هنرمند تولید مجازی`],
    ['camera', 'Camera & cinematography', 'تصویربرداری و دوربین', `Cinematographer|مدیر فیلم‌برداری
Camera operator|اپراتور دوربین
First assistant camera|دستیار اول دوربین
Second assistant camera|دستیار دوم دوربین
Focus puller|فوکوس پولر
Steadicam operator|اپراتور استدی‌کم
Drone operator|اپراتور پهپاد
Digital imaging technician|تکنسین تصویر دیجیتال
Video assist operator|اپراتور ویدیو اسیست
Still photographer|عکاس صحنه
Camera trainee|کارآموز دوربین
Cinematic designer|طراح سینماتیک`],
    ['lighting', 'Lighting & grip', 'نورپردازی و تجهیزات صحنه', `Gaffer|سرپرست نورپردازی
Best boy electric|دستیار ارشد نورپردازی
Lighting technician|تکنسین نور
Electrician|برق‌کار صحنه
Key grip|سرپرست گریپ
Best boy grip|دستیار ارشد گریپ
Grip|گریپ
Dolly grip|دالی گریپ
Rigging gaffer|سرپرست نصب نور
Rigging grip|مسئول نصب تجهیزات صحنه`],
    ['sets', 'Sets, props & production design', 'طراحی صحنه و وسایل', `Production designer|طراح صحنه
Set designer|طراح دکور
Set decorator|دکوراتور صحنه
Set dresser|مسئول چیدمان صحنه
Props master|مسئول وسایل صحنه
Props maker|سازندهٔ وسایل صحنه
Construction coordinator|هماهنگ‌کنندهٔ ساخت دکور
Scenic artist|هنرمند دکور
Carpenter|نجار دکور
Greensperson|مسئول فضای سبز صحنه`],
    ['costume', 'Costume, makeup & hair', 'لباس، گریم و مو', `Costume designer|طراح لباس
Costume supervisor|سرپرست لباس
Wardrobe assistant|دستیار لباس
Costume maker|سازندهٔ لباس
Makeup designer|طراح گریم
Makeup artist|گریمور
Key makeup artist|گریمور ارشد
Prosthetic makeup artist|گریمور پروتز
Hair designer|طراح مو
Hair stylist|آرایشگر مو
Costume standby|مسئول تداوم لباس`],
    ['sound', 'Sound & music', 'صدا و موسیقی', `Composer|آهنگساز
Music director|مدیر موسیقی
Music supervisor|سرپرست موسیقی
Music producer|تهیه‌کنندهٔ موسیقی
Music editor|تدوینگر موسیقی
Orchestrator|ارکستراتور
Conductor|رهبر ارکستر
Musician|نوازنده
Songwriter|ترانه‌سرا
Audio director|مدیر صدا
Sound designer|طراح صدا
Sound supervisor|سرپرست صدا
Production sound mixer|صدابردار صحنه
Boom operator|بوم‌من
Sound recordist|ضبط‌کنندهٔ صدا
Sound editor|تدوینگر صدا
Dialogue editor|تدوینگر دیالوگ
Foley artist|هنرمند فولی
Foley mixer|صدابردار فولی
Re-recording mixer|صدابردار میکس نهایی
ADR director|کارگردان دوبله و ADR
ADR engineer|مهندس ضبط دوبله
Audio implementer|پیاده‌ساز صدا در بازی`],
    ['post', 'Editing & post-production', 'تدوین و پس‌تولید', `Editor|تدوینگر
Assistant editor|دستیار تدوین
Online editor|تدوینگر آنلاین
Colorist|کالریست
Color grading assistant|دستیار اصلاح رنگ
Post-production supervisor|سرپرست پس‌تولید
Post-production coordinator|هماهنگ‌کنندهٔ پس‌تولید
Trailer editor|تدوینگر تریلر
Titles designer|طراح تیتراژ
Finishing artist|هنرمند فینیشینگ
Mastering engineer|مهندس مسترینگ`],
    ['cast', 'Cast & performers', 'بازیگران و اجراکنندگان', `Actor|بازیگر
Actress|بازیگر زن
Voice actor|صداپیشه
Voice actress|صداپیشهٔ زن
Narrator|راوی
Motion capture performer|اجراکنندهٔ موشن کپچر
Performance capture performer|اجراکنندهٔ پرفورمنس کپچر
Stunt performer|بدلکار
Stunt double|بدل بازیگر
Background actor|بازیگر پس‌زمینه
Dancer|رقصنده
Puppeteer|عروسک‌گردان
Creature performer|اجراکنندهٔ موجودات
Singer|خواننده`],
    ['casting', 'Casting & action coordination', 'انتخاب بازیگر و هماهنگی اجرا', `Casting director|مدیر انتخاب بازیگر
Casting associate|همکار انتخاب بازیگر
Casting assistant|دستیار انتخاب بازیگر
Voice casting director|مدیر انتخاب صداپیشه
Voice director|کارگردان صداپیشگی
Acting coach|مربی بازیگری
Stunt coordinator|هماهنگ‌کنندهٔ بدلکاری
Fight choreographer|طراح حرکات مبارزه
Choreographer|طراح حرکات
Intimacy coordinator|هماهنگ‌کنندهٔ صحنه‌های صمیمی
Animal trainer|مربی حیوانات صحنه`],
    ['localization', 'Localization & language', 'بومی‌سازی و زبان', `Localization producer|تهیه‌کنندهٔ بومی‌سازی
Localization manager|مدیر بومی‌سازی
Translator|مترجم
Localization editor|ویراستار بومی‌سازی
Localization engineer|مهندس بومی‌سازی
Subtitle translator|مترجم زیرنویس
Subtitle editor|ویراستار زیرنویس
Dialogue adapter|بازنویس دیالوگ دوبله
Linguistic tester|تستر زبانی
Cultural consultant|مشاور فرهنگی
Dialect coach|مربی لهجه`],
    ['qa', 'QA, research & accessibility', 'تست، پژوهش و دسترس‌پذیری', `QA director|مدیر کنترل کیفیت
QA lead|سرپرست کنترل کیفیت
QA tester|تستر کنترل کیفیت
Gameplay tester|تستر گیم‌پلی
Automation engineer|مهندس خودکارسازی تست
Compatibility tester|تستر سازگاری
Certification tester|تستر الزامات پلتفرم
User researcher|پژوهشگر کاربران
Playtest coordinator|هماهنگ‌کنندهٔ پلی‌تست
Accessibility designer|طراح دسترس‌پذیری
Accessibility consultant|مشاور دسترس‌پذیری
Accessibility tester|تستر دسترس‌پذیری`],
    ['publishing', 'Publishing, marketing & community', 'انتشار، بازاریابی و جامعهٔ کاربران', `Publisher|ناشر
Publishing producer|تهیه‌کنندهٔ انتشار
Distribution manager|مدیر توزیع
Marketing director|مدیر بازاریابی
Marketing manager|مسئول بازاریابی
Brand manager|مدیر برند
Publicist|مسئول روابط عمومی
Community manager|مدیر جامعهٔ کاربران
Social media manager|مدیر شبکه‌های اجتماعی
Storefront manager|مدیر صفحهٔ فروشگاه
Live operations producer|تهیه‌کنندهٔ عملیات زنده
Live operations designer|طراح عملیات زنده
Customer support|پشتیبانی مشتریان`],
    ['ai', 'AI assistance', 'دستیارهای هوش مصنوعی', `AI assistant|دستیار هوش مصنوعی
AI model|مدل هوش مصنوعی
AI tools developer|توسعه‌دهندهٔ ابزارهای هوش مصنوعی
Prompt designer|طراح پرامپت`],
    ['other', 'Other contributions & thanks', 'سایر همکاری‌ها و تقدیر', `Consultant|مشاور
Legal advisor|مشاور حقوقی
Historical advisor|مشاور تاریخی
Scientific advisor|مشاور علمی
Safety supervisor|سرپرست ایمنی
Medic|پزشک صحنه
Craft services|پذیرایی صحنه
Catering|تأمین غذا
Transport coordinator|هماهنگ‌کنندهٔ حمل‌ونقل
Driver|راننده
Intern|کارآموز
Special thanks|با تشکر ویژه
Additional support|همکاری تکمیلی`]
  ];
  const groups = sections.map(([id, en, fa, entries]) => ({ id, en, fa, roles: entries.split('\n').map((line) => {
    const [en, fa] = line.split('|');
    return { en, fa, group: id, character: id === 'cast' };
  }) }));
  const roles = groups.flatMap((group) => group.roles);
  const key = (text) => String(text || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const lookup = new Map(roles.flatMap((role) => [[key(role.en), role], [key(role.fa), role]]));
  const aliases = {
    'screenwriter':'Screenplay', 'film director':'Director', 'director of photography':'Cinematographer',
    'dop':'Cinematographer', 'dp':'Cinematographer', 'level design':'Level designer', 'character design':'Character designer',
    'sound design':'Sound designer', 'visual effects':'VFX artist', 'cover art':'Cover artist', 'music':'Composer',
    'voice':'Voice actor', 'cast':'Actor', 'گوینده':'Voice actor', 'بازیگر زن':'Actress',
    'هوش مصنوعی':'AI assistant', 'ai':'AI assistant', 'فیلمنامه':'Screenplay', 'فیلم‌نامه':'Screenplay',
    'فیلم‌نامه‌نویس':'Screenplay', 'طراحی مرحله':'Level designer', 'طراحی شخصیت':'Character designer',
    'طراحی صدا':'Sound designer', 'جلوه‌های ویژه':'VFX artist', 'نویسنده‌ی همکار':'Co-writer'
  };
  Object.entries(aliases).forEach(([alias, en]) => lookup.set(key(alias), lookup.get(key(en))));
  const info = (role) => lookup.get(key(role));
  const normalize = (role) => info(role)?.en || String(role || '').trim();
  const unique = (values) => [...new Map(values.filter(Boolean).map((role) => [key(normalize(role)), normalize(role)])).values()];
  const plays = (role) => Boolean(info(role)?.character);
  const leads = new Set(['Director','Co-director','Showrunner','Writer','Co-writer','Screenplay','Story','Author','Game director','Creative director','Narrative director','Game writer']);
  const department = (credit) => {
    if (groups.some((group) => group.id === credit.department)) return credit.department;
    const known = (credit.roles || []).map(info).filter(Boolean);
    if (known.some((role) => leads.has(role.en))) return 'direction';
    if (known.some((role) => role.en === 'AI assistant' || role.en === 'AI model')) return 'ai';
    return known[0]?.group || 'other';
  };
  const isLead = (credit) => department(credit) === 'direction' && (credit.roles || []).some((role) => leads.has(normalize(role)));
  const translations = Object.fromEntries(groups.concat(roles).map(({en,fa}) => [en,fa]));
  Object.assign(translations, {
    'Role category':'دستهٔ نقش', 'Choose a role':'انتخاب نقش', 'Show under':'بخش نمایش در سایت',
    'All departments':'همهٔ دسته‌ها', 'Automatic from roles':'خودکار بر اساس نقش‌ها',
    'Character':'شخصیت', 'Name':'نام', 'Roles':'نقش‌ها', 'Photo':'عکس', 'Add a role':'افزودن نقش',
    'Roles: Director, Composer, Voice actor…':'نقش‌ها: کارگردان، آهنگساز، صداپیشه…',
    'e.g. Anna (several: Anna, The Friar)':'مثلاً آرتور؛ برای چند شخصیت، نام‌ها را با ویرگول جدا کنید',
    'Move up in its section':'بالا بردن در بخش خودش', 'Remove this person':'حذف این فرد',
    'Choose a department and role below each person, or type a custom role and press Enter. People can have multiple roles. The public section is chosen automatically; use Show under to override it. Performing roles reveal the Character field. Click the photo to upload; use the arrow to reorder within a section.':'برای هر فرد دسته و نقش را انتخاب کنید، یا نقش سفارشی بنویسید و Enter بزنید. هر فرد می‌تواند چند نقش داشته باشد. بخش نمایش به‌صورت خودکار تعیین می‌شود و می‌توانید آن را تغییر دهید. برای نقش‌های اجرایی، فیلد شخصیت باز می‌شود. برای افزودن عکس روی تصویر کلیک کنید؛ پیکان ترتیب فرد در بخش خودش را تغییر می‌دهد.'
  });
  Object.entries(aliases).forEach(([alias, en]) => { translations[alias] = lookup.get(key(en)).fa; });
  if (typeof FA !== 'undefined') Object.assign(FA, translations);
  window.SauFoxCredits = Object.freeze({ groups, roles, info, normalize, unique, plays, department, isLead });
})();
