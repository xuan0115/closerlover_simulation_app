/*
 * 回复方式和模型服务的默认值。
 * 模型更新换代后，在这里改默认值即可；网页「设置 → 回复方式」里填的会覆盖这里。
 */

/* 回复方式 */
const REPLY_MODES = {
  template: { label: '固定模板', desc: '不联网、不花钱。TA 按 js/data/templates.js 里的台词说话，回你时按关键词挑说法。' },
  ai:       { label: 'AI', desc: '每句话都由 AI 按 TA 的人设现想，最像真人。要填一个 AI 服务的 Key，按用量付费。' }
};

/* 聊天用的 AI 服务 */
const CHAT_PROVIDERS = {
  builtin:  { label: '知己内置AI（免填Key）', base: 'https://zhiji-ai.xuan0115.workers.dev', model: 'deepseek-chat' },
  openai:   { label: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-5-mini' },
  gemini:   { label: 'Gemini', base: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-flash-latest' },
  deepseek: { label: 'DeepSeek', base: 'https://api.deepseek.com', model: 'deepseek-flash' },
  compat:   { label: '其他兼容 OpenAI 格式的接口', base: '', model: '' }
};


/* 生成照片用 */
const IMAGE_PROVIDERS = {
  openai: { label: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-image-2' },
  gemini: { label: 'Gemini', base: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-3.1-flash-image' }
};
