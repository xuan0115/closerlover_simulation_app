/*
 * 手机里有哪些 App、桌面怎么排、壁纸。
 *
 * 只有「著信」是这个项目自己做的聊天 App，其余都是壳子：
 *   ios  在 iPhone 上点图标，跳到这个地址（打开真实的 App）；留空就打开网页里的仿真版
 *   在电脑上点，一律打开网页里的仿真版
 * 名字、图标图片、跳转地址也可以在网页「设置 → 主屏幕与 App 资源库」里改，那里改的优先。
 * 带 ? 的跳转地址是 iOS 没有公开说明、但一直能用的，万一失效会退回仿真版。
 */
const APP_TITLE = '亲密爱人';   // 浏览器标签页、添加到主屏幕时的名字

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
  appstore:   { label: 'App Store', ios: 'itms-apps://' },
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
  wxwork:     { label: '企业微信', ios: 'wxwork://' }
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
