# 知己 · 邮件模板（贴到 Supabase）

知己只发两种邮件：**注册验证码**、**重设密码验证码**。样式是 iPhone 4 小手机（照 privacy.html 的风格做的）。没有「更换邮箱」：账户页里的邮箱只显示、不能改。

位置：Supabase 后台 → Authentication → Emails → Templates。

| 模板 | 主题（Subject） | 内容（Message body） |
|---|---|---|
| Confirm signup | `知己 Knowwo 注册验证码：{{ .Token }}` | 打开 `email-signup.html`，⌘A 全选复制，整个贴进去 |
| Reset password | `知己 Knowwo 重设密码验证码：{{ .Token }}` | 打开 `email-reset.html`，⌘A 全选复制，整个贴进去 |

- `{{ .Token }}` 是验证码，Supabase 发信时会换成数字，**不要改**。放在主题里，iPhone 的「邮件」收到后，输入框上方会直接提示这串数字。
- 用文本编辑器打开 html 文件复制（不要用浏览器打开再复制，那样复制到的是显示出来的字，不是代码）。
- 其他模板（Magic Link、Invite user、Change email address、Reauthentication）知己用不到，不用改。

验证码设置：Authentication → Sign In / Providers → Email

- Confirm email：打开
- Email OTP Expiration：`600`（10 分钟，和邮件、App 里写的一致）
- Email OTP Length：`6`

改样式时注意：邮件里只能用写在标签上的样式（`style="..."`）。不要用「浮在边上」的定位（position）、动画、外部字体和图片，Gmail、QQ 邮箱这些不支持，会排乱。

比例：iPhone 4 的屏幕是 3:2。手机上看邮件时宽度只有 340 左右，所以屏幕最小高度设成 530px、内容排得比较紧，手机和电脑上看比例都接近 3:2。往屏幕里加内容，手机上就会变长。
