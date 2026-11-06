/*
 * 英文模式（设置 → chatwe聊我 → 语言 → English）下的固定模板，结构和 templates.js 一样。
 * 占位符的名字不变（{称呼} {名字} {她} {星座} {我的星座} {时段} {事项} {内容} {礼物}），
 * 填进去的是英文：{称呼} 用「英文里怎么叫你」，{时段} 是 morning / afternoon……
 * 这里没有的场景，会退回中文模板里同名的说法。
 */

const TEMPLATES_EN = {
  common: {
    opening:   [['hey, what are you up to'], ['hey {称呼}']],
    morning:   [['morning', 'you up yet?'], ['morning {称呼}', 'what are you doing today']],
    ask:       [['what are you doing'], ['busy right now?']],
    chat:      [['just thought of you', 'how is your {时段} going'], ['anything fun happen today?']],
    photo:     [['look'], ['just took this']],
    photoNone: [['wanted to send you a pic', 'the light is terrible, next time']],
    moments:   [['just an ordinary day'], ['saving this one'], ['nice weather today']],
    taskRemind: [['time for {事项}'], ['{事项} time', 'come find me when you are done']],
    taskDone:   [['saw you checked in for {事项} today', 'nice'], ['done with {事项} already?', 'good job']],
    taskAck:    [['ok, focus on {事项}', 'tell me when you are done'], ['go go', 'come back after']],
    alarmRemind: [['{内容}', 'don\'t forget'], ['it\'s time', '{内容}']],
    night:     [['going to bed', 'you sleep early too', 'night'], ['good night {称呼}']],
    nightGood: [['you finished everything today', 'reward: go to bed early', 'night']],
    unreplied: [['why aren\'t you answering'], ['hello??']],
    backBusy:  [['sorry, was busy'], ['just got free'], ['wasn\'t looking at my phone']],
    backRun:   [['just got back from my run'], ['went for a run']],
    backSleep: [['just woke up'], ['fell asleep, just saw this']],
    backWoken: [['mm... you woke me up'], ['what is it', 'I was asleep'], ['so many messages', 'you ok?']],

    photoSend: [['here'], ['look']],
    noPhoto:   [['can\'t take one right now', 'later']],
    miss:      [['miss you too'], ['I know']],
    love:      [['me too'], ['why so sweet all of a sudden']],
    tired:     [['you worked hard', 'get some rest'], ['take a break if you\'re tired']],
    sad:       [['what happened', 'tell me'], ['come here', 'what\'s going on']],
    crisis:    [['what you said really worries me', 'can you reach out to someone you trust right now, a friend or family', 'you can also call the 12356 mental health hotline in China, someone will answer', 'if you are in danger, call 120 or 110 right away']],
    food:      [['what did you eat'], ['eat properly ok']],
    busy:      [['ok go do your thing', 'text me after'], ['ok, won\'t bother you']],
    greet:     [['here'], ['hm?']],
    sleep:     [['night'], ['go sleep, good night']],
    sorry:     [['good that you know'], ['fine, forgiven']],
    thanks:    [['no need to thank me'], ['anytime']],
    zodiac:    [['I\'m a {星座}, didn\'t you know'], ['{星座} and {我的星座}', 'apparently a good match']],
    question:  [['guess'], ['hmm let me think']],
    late:      [['why are you still up'], ['it\'s so late, put the phone down']],
    fallback:  [['mm'], ['and then?'], ['haha'], ['for real?']],
    gotPhoto:  [['wow', 'where is this'], ['nice shot'], ['saw it', 'how\'s the weather there']],

    gotVoice:  [['heard it'], ['got it']],
    gotGift:   [['thank you for the {礼物}!'], ['aww, {礼物}', 'so happy']],
    pat:       [['why are you poking me'], ['hm?']],
    recall:    [['what did you unsend', 'I saw it'], ['what was that you deleted?']],
    giftNote:  [['you did well today, here'], ['for you']],

    callHello: [['hello', 'why the sudden call'], ['hey', 'I\'m here']],
    callMe:    [['hey', 'what are you doing'], ['hi, it\'s me', 'wanted to hear your voice']],
    callIdle:  [['why so quiet'], ['hello? still there?']],
    callBye:   [['ok, hanging up now'], ['talk later']],
    callMissed:[['why didn\'t you pick up'], ['busy?', 'call me back when you see this']],

    momentReply: [['haha'], ['you get me'], ['you talk too much']],
    myMoment:    [['nice one'], ['where is this'], ['wow']]
  },

  /* 傲娇毒舌 */
  tease: {
    opening:   [['hey', 'what are you doing'], ['{称呼}', 'did you miss me today']],
    morning:   [['morning {称呼}', 'don\'t tell me you\'re still in bed'], ['up yet?', 'the sun is already out'], ['morning', 'study properly today, ok']],
    ask:       [['what are you doing', 'slacking off again?'], ['report: what are you doing']],
    chat:      [['bored', 'talk to me'], ['just saw a very dumb cat', 'kind of looks like you']],
    taskRemind: [['look at the time', 'where\'s your {事项}'], ['{事项} time', 'phone down'], ['go do {事项}', 'then come play']],
    taskDone:   [['wow, {事项} without being told'], ['saw your {事项} check-in', 'keep it up, no slacking']],
    night:     [['going to sleep', 'don\'t stay up', 'night'], ['did you study today', 'then go sleep', 'no staying up']],
    miss:      [['hmph, only now you remember me'], ['...ok I missed you a tiny bit']],
    love:      [['why so cheesy', '...me too'], ['yeah yeah I know']],
    tired:     [['then rest', 'don\'t push it'], ['who told you to stay up last night']],
    late:      [['why are you still awake', 'want to oversleep tomorrow?'], ['go to bed. now']],
    fallback:  [['mhm', 'and?'], ['seriously'], ['huh?'], ['go on']],
    gotPhoto:  [['not bad', 'better than last time'], ['you took this?', 'it\'s a bit tilted']]
  },

  /* 温柔体贴 */
  sweet: {
    opening:   [['you\'re here', 'how was your day'], ['{称呼}', 'wanted to talk to you']],
    morning:   [['good morning', 'did you sleep well'], ['morning {称呼}', 'don\'t skip breakfast']],
    ask:       [['busy?', 'I just took a break'], ['what are you doing']],
    chat:      [['the {时段} breeze is so nice', 'wanted to share it with you'], ['just thought of you', 'so here I am']],
    taskRemind: [['it\'s {事项} time', 'I\'ll keep you company'], ['time for {事项}', 'come chat after']],
    taskDone:   [['you finished {事项} today, so proud'], ['you were so focused today', 'I noticed']],
    night:     [['going to bed?', 'rest well, good night'], ['you worked hard today', 'sweet dreams']],
    miss:      [['I miss you too'], ['text me whenever you miss me']],
    love:      [['I like you too'], ['I\'m always here']],
    tired:     [['you worked hard', 'want to rest a bit?'], ['don\'t force it if you\'re tired', 'hugs']],
    sad:       [['what\'s wrong', 'whatever it is, I\'m listening'], ['hug first', 'take your time']],
    fallback:  [['mm', 'I\'m listening'], ['and then?'], ['really?'], ['that\'s nice']]
  },

  /* 元气黏人 */
  genki: {
    opening:   [['hiii!', 'I\'m here'], ['{称呼}!!', 'what are you doing what are you doing']],
    morning:   [['morning morning!', 'wake up wake up'], ['good morning {称呼}!', 'full energy today']],
    ask:       [['what are you doing!', 'talk to me'], ['reporting: I\'m so bored', 'what are you up to']],
    chat:      [['guess what!', 'my {时段} was so good'], ['guess what I\'m doing', 'thinking about you hehe']],
    taskRemind: [['{事项} time!', 'let\'s go'], ['go do {事项}!', 'we\'ll chat after']],
    taskDone:   [['{事项} done today!', 'you\'re the best'], ['so diligent!', 'I should learn from you']],
    night:     [['so sleepy', 'night night!'], ['going to bed', 'see you in my dreams!']],
    miss:      [['I miss you too!!', 'so much'], ['miss you miss you miss you']],
    love:      [['love you too!!'], ['hehe', 'me too']],
    fallback:  [['hahaha'], ['really!'], ['and then and then'], ['yay']]
  }
};

/* 挚友（英文）：和 templates.js 的 TEMPLATES_FRIEND 一样，优先用这里的 */
const TEMPLATES_EN_FRIEND = {
  common: {
    opening:  [['you there?'], ['hey {称呼}'], ['come chat']],
    chat:     [['ok listen'], ['anything fun today?'], ['bored this {时段}', 'what are you doing']],
    miss:     [['miss me? sure'], ['haha', 'why so sappy']],
    love:     [['so cheesy'], ['random confession?', 'fine, I like you too']],
    night:    [['going to bed', 'you too'], ['sleeping, talk tomorrow']],
    callMe:   [['hey', 'what are you doing'], ['hi it\'s me', 'free?']],
    giftNote: [['my treat'], ['take it, don\'t be polite']],
    taskRemind: [['done with {事项} yet?', 'I already did mine'], ['{事项} time', 'let\'s see who lasts longer']]
  },
  tease: {
    opening:  [['hey', 'what are you doing'], ['still alive?']],
    miss:     [['just say you miss me'], ['wow, that\'s rare']],
    taskRemind: [['where\'s your {事项}', 'don\'t make me look down on you'], ['look at the time', 'go do {事项}', 'I\'m already done']]
  },
  sweet: {
    miss:     [['miss you too', 'when are we meeting up'], ['me too', 'let\'s catch up soon']],
    love:     [['I treasure you as a friend too'], ['hehe', 'same']]
  },
  genki: {
    chat:     [['guess what!', 'my {时段} was so good'], ['guess what I\'m doing', 'drawing hehe']],
    miss:     [['miss you too!', 'let\'s grab food soon'], ['come visit me in Shanghai!']],
    love:     [['love you too!!', 'friendship forever'], ['hehe', 'you\'re my best friend too']]
  }
};

/* 英文模式下回你时的关键词（中文的也认，你夹着中文说也能对上） */
const REPLY_RULES_EN = [
  { match: /kill myself|suicide|want to die|end my life|don'?t want to live|no reason to live|不想活|想死|自杀|轻生|结束生命/i, reply: 'crisis' },
  { match: /\b(photo|pic|picture|selfie)s?\b|照片|自拍/i, reply: 'photoSend', photo: true },
  { match: /zodiac|horoscope|star sign|星座/i, reply: 'zodiac' },
  { match: /miss (you|u)|想你/i, reply: 'miss' },
  { match: /love (you|u)|like you|hugs?|kiss|爱你|喜欢你|抱抱/i, reply: 'love' },
  { match: /\b(sad|upset|stressed|anxious|depressed|annoyed|crying|frustrated)\b|难过|焦虑/i, reply: 'sad' },
  { match: /\b(tired|exhausted|sleepy|worn out)\b|好累|好困/i, reply: 'tired' },
  { match: /good ?night|going to (bed|sleep)|\bnight\b|晚安/i, reply: 'sleep' },
  { match: /\b(sorry|my bad|apologi[sz]e)\b|对不起/i, reply: 'sorry' },
  { match: /\b(thanks|thank you|thx|ty)\b|谢谢/i, reply: 'thanks' },
  { match: /\b(hungry|eat|ate|lunch|dinner|breakfast|food)\b|吃饭/i, reply: 'food' },
  { match: /\b(busy|in class|meeting|later|brb)\b|在忙/i, reply: 'busy' },
  { match: /^(hi|hello|hey|yo|morning|good morning|在吗)\b/i, reply: 'greet' }
];
