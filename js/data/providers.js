/*
 * 回复方式和模型服务的默认值。
 * 模型更新换代后，在这里改默认值即可；网页「设置 → 回复方式」里填的会覆盖这里。
 */

/* 回复方式 */
const REPLY_MODES = {
  template: { label: '固定模板', desc: '不联网、不花钱。她按 js/data/templates.js 里的台词说话，回你时按关键词挑说法。' },
  hybrid:   { label: '混合', desc: '早安、提醒、晚安这些定时消息用模板，回你的消息用 AI。AI 调用少很多，省钱。' },
  ai:       { label: '全部用 AI', desc: '每句话都由 AI 按她的人设现想。最像真人，调用最多。' }
};

/* 聊天用的 AI 服务 */
const CHAT_PROVIDERS = {
  openai: { label: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-5-mini' },
  gemini: { label: 'Gemini', base: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-flash-latest' },
  compat: { label: '其他兼容 OpenAI 格式的接口', base: '', model: '' } // 比如 DeepSeek、通义、Kimi 或你自己的转发地址
};

/* 生成照片用 */
const IMAGE_PROVIDERS = {
  openai: { label: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-image-2' },
  gemini: { label: 'Gemini', base: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-3.1-flash-image' }
};
