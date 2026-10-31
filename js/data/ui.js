/*
 * 手机里有哪些 App、桌面怎么排、壁纸。
 *
 * 只有「著信」是这个项目自己做的聊天 App，其余都是壳子：
 *   ios  在 iPhone 上点图标，跳到这个地址（打开真实的 App）；留空就打开网页里的仿真版
 *   在电脑上点，一律打开网页里的仿真版
 * 名字、图标图片、跳转地址也可以在网页「设置 → 主屏幕与 App 资源库」里改，那里改的优先。
 * 带 ? 的跳转地址是 iOS 没有公开说明、但一直能用的，万一失效会退回仿真版。
 */
const APP_TITLE = '知己';   // 浏览器标签页、添加到主屏幕时的名字

/* 还没做好的功能：false = 按钮还在，点了提示「待开发」 */
const FEATURES = { voice: false };   // 语音消息、语音通话

const APPS = {
  /* 这个项目自己做的聊天 App。label 是桌面图标下的名字，short 用在 App 里的标题和「聊我号」 */
  wx:         { label: 'chatwe聊我', short: '聊我' },
  settings:   { label: '设置' },
  camera:     { label: '相机' },                                       // iPhone 没有能跳转的地址，用仿真相机
  calc:       { label: '计算器' },                                     // 同上
  photos:     { label: '照片',     ios: 'photos-redirect://' },
  calendar:   { label: '日历',     ios: 'calshow://' },
  notes:      { label: '备忘录',   ios: 'mobilenotes://' },
  reminders:  { label: '提醒事项', ios: 'x-apple-reminderkit://' },
  music:      { label: '音乐',     ios: 'music://' },
  maps:       { label: '地图',     ios: 'maps://' },
  mail:       { label: '邮件',     ios: 'message://' },
  messages:   { label: '信息',     ios: 'sms:' },
  health:     { label: '健康',     ios: 'x-apple-health://' },
  files:      { label: '文件',     ios: 'shareddocuments://' },
  weather:    { label: '天气',     ios: 'weather://' },                // ?
  clock:      { label: '时钟',     ios: 'clock-alarm://' },            // ?
  safari:     { label: 'Safari 浏览器', ios: 'x-web-search://' },
  appstore:   { label: 'App Store' },                                // 网页里的仿真 App Store：在这里下载、重新下载壳子
  books:      { label: '图书',     ios: 'ibooks://' },
  podcasts:   { label: '播客',     ios: 'podcasts://' },
  tv:         { label: 'TV',       ios: 'videos://' },
  facetime:   { label: 'FaceTime 通话', ios: 'facetime://' },
  findmy:     { label: '查找',     ios: 'findmy://' },
  wallet:     { label: '钱包',     ios: 'shoebox://' },
  shortcuts:  { label: '快捷指令', ios: 'shortcuts://' },
  voicememos: { label: '语音备忘录', ios: 'voicememos://' },           // ?
  stocks:     { label: '股市',     ios: 'stocks://' },
  /* 第三方 App：手机上装了才能跳过去；没装的话网页会提示，然后打开说明页 */
  xhs:        { label: '小红书',   ios: 'xhsdiscover://' },
  meituan:    { label: '美团外卖', ios: 'meituanwaimai://' },
  netease:    { label: '网易云音乐', ios: 'orpheus://' },
  douban:     { label: '豆瓣',     ios: 'douban://' },
  weread:     { label: '微信读书', ios: 'weread://' },
  duolingo:   { label: '多邻国',   ios: 'duolingo://' },
  xiaoyuzhou: { label: '小宇宙',   ios: 'cosmos://' },                 // ?
  wxwork:     { label: '企业微信', ios: 'wxwork://' },
  /* 只在 App Store 里、默认没装的壳子。art = [渐变起色, 渐变止色, 图案名（js/ui/icons.js 的 ICONS）] */
  douyin:     { label: '抖音',     ios: 'snssdk1128://',     art: ['#7B5CFF', '#E0408A', 'play'] },
  taobao:     { label: '淘宝',     ios: 'taobao://',         art: ['#FF9A3D', '#FF5A1F', 'box'] },
  bilibili:   { label: '哔哩哔哩', ios: 'bilibili://',       art: ['#FF8DB5', '#F25D96', 'chat'] },
  weibo:      { label: '微博',     ios: 'sinaweibo://',      art: ['#FFB13D', '#F2552C', 'sound'] },
  zhihu:      { label: '知乎',     ios: 'zhihu://',          art: ['#3FA0FF', '#1767E0', 'search'] },
  amap:       { label: '高德地图', ios: 'iosamap://',        art: ['#4DA8FF', '#1F6FF0', 'compass'] },
  eleme:      { label: '饿了么',   ios: 'eleme://',          art: ['#36B6FF', '#0B8CE9', 'gift'] },
  qqmusic:    { label: 'QQ音乐',   ios: 'qqmusic://',        art: ['#43D17E', '#18A957', 'music'] },
  jd:         { label: '京东',     ios: 'openapp.jdmobile://', art: ['#F5484A', '#D21F2B', 'tag'] },
  pdd:        { label: '拼多多',   ios: 'pinduoduo://',      art: ['#FF6B4A', '#E8332B', 'grid'] },
  keep:       { label: 'Keep',     ios: 'keep://',           art: ['#5E4DB2', '#3A2C85', 'dumbbell'] },
  didi:       { label: '滴滴出行', ios: 'diditaxi://',       art: ['#FF9F45', '#FF7A1A', 'pin'] },
  ctrip:      { label: '携程旅行', ios: 'ctrip://',          art: ['#4AA3FF', '#2A6FE8', 'plane'] },
  dianping:   { label: '大众点评', ios: 'dianping://',       art: ['#FF8A47', '#F2552C', 'star'] },
  xianyu:     { label: '闲鱼',     ios: 'fleamarket://',     art: ['#FFE14D', '#FFC400', 'flip'] },
  alipay:     { label: '支付宝',   ios: 'alipay://',         art: ['#3FA9FF', '#1677FF', 'scan'] },
  weixin:     { label: '微信',     ios: 'weixin://',         art: ['#4FD17A', '#1AAD5C', 'chat'] },
  qq:         { label: 'QQ',       ios: 'mqq://',            art: ['#45B4FF', '#1C8BF0', 'person'] }
};

/* 删不掉的 App（和 iPhone 一样，系统自带的几个删不掉；chatwe聊我 也删不掉） */
const NO_DELETE = ['wx', 'settings', 'appstore', 'camera', 'photos', 'messages', 'safari', 'wallet', 'health', 'findmy'];

/* App Store 里能下载的东西：分类和一句话介绍。没列在这里的 App 不会出现在商店里 */
const STORE = {
  xhs: '生活 · 种草笔记', douyin: '娱乐 · 短视频', meituan: '美食 · 外卖', taobao: '购物', netease: '音乐',
  bilibili: '娱乐 · 视频', weibo: '社交', zhihu: '问答', douban: '书影音', weread: '读书', xiaoyuzhou: '播客',
  duolingo: '教育 · 学语言', keep: '健康健美', amap: '导航', didi: '出行', ctrip: '旅行', eleme: '美食 · 外卖',
  dianping: '美食 · 生活', qqmusic: '音乐', jd: '购物', pdd: '购物', xianyu: '购物 · 二手', alipay: '财务',
  weixin: '社交', qq: '社交', wxwork: '商务',
  books: 'Apple · 图书', podcasts: 'Apple · 播客', weather: 'Apple · 天气', clock: 'Apple · 时钟', calc: 'Apple · 计算器',
  calendar: 'Apple · 日历', notes: 'Apple · 备忘录', reminders: 'Apple · 提醒事项', mail: 'Apple · 邮件', maps: 'Apple · 地图',
  music: 'Apple · 音乐', tv: 'Apple · TV', files: 'Apple · 文件', facetime: 'Apple · FaceTime', voicememos: 'Apple · 语音备忘录',
  shortcuts: 'Apple · 快捷指令', stocks: 'Apple · 股市'
};

/*
 * 桌面布局：pages 是每一页从左到右、从上到下的内容（一页 4 列 6 行），dock 是最下面一排。
 *   'widget:her'        她最近的消息（2×2）
 *   'widget:countdown'  倒数日（2×2），在「设置 → chatwe聊我 → 倒数日」里改，或者直接点它
 *   'widget:checkin'    学习、健身打卡（两个 2×2）
 *   'folder:xxx'        文件夹，里面有什么写在 FOLDERS 里
 * 第一页照 iPhone 出厂的首页排：上面两个小组件，下面 4×4 系统 App，Dock 是常用的四个。
 */
const FOLDERS = {
  tools: { name: '实用工具', apps: ['calc', 'voicememos', 'findmy', 'shortcuts', 'stocks'] }
};
const HOME_LAYOUT = {
  pages: [
    ['widget:her', 'widget:countdown',
     'facetime', 'calendar', 'photos', 'camera',
     'mail', 'notes', 'reminders', 'clock',
     'weather', 'tv', 'files', 'appstore',
     'maps', 'health', 'wallet', 'settings'],
    ['xhs', 'meituan', 'netease', 'douban',
     'weread', 'books', 'podcasts', 'duolingo',
     'xiaoyuzhou', 'wxwork', 'folder:tools',
     'widget:checkin']
  ],
  dock: ['wx', 'safari', 'messages', 'music']
};

/* 精选墙纸：draw 是用代码画的，css 是一段 CSS background。自己的照片在「设置 → 墙纸」里选 */
const WALLPAPERS = {
  bamboo: { label: '竹林', draw: 'bamboo' },
  night:  { label: '夜色', css: 'radial-gradient(90% 50% at 80% 8%,rgba(122,106,214,.45),transparent 70%),linear-gradient(180deg,#1b1846 0%,#221d55 45%,#2d2468 100%)' },
  dawn:   { label: '晨光', css: 'radial-gradient(120% 60% at 50% 112%,#F7C59F 0%,rgba(247,197,159,0) 60%),linear-gradient(180deg,#1D2046 0%,#33346F 38%,#7B6BB5 72%,#D99A8A 100%)' },
  mint:   { label: '薄荷', css: 'linear-gradient(180deg,#0f3b3a 0%,#1f6b5f 55%,#7fc8a9 100%)' },
  sky:    { label: '晴空', css: 'radial-gradient(80% 40% at 70% 10%,rgba(255,255,255,.7),transparent 70%),linear-gradient(180deg,#5AA9F0 0%,#8CC8F7 50%,#D6ECFB 100%)' },
  dusk:   { label: '黄昏', css: 'linear-gradient(180deg,#2B1E4A 0%,#7A3E6B 45%,#E0785A 80%,#F6C37A 100%)' }
};
