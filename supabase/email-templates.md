# 知己 · 邮件模板（贴到 Supabase）

位置：Supabase 后台 → Authentication → Emails → Templates。下面三封各有一个「主题」和一段「内容」，分别贴进对应的模板里，保存。

`{{ .Token }}` 是验证码，Supabase 发信时会换成数字，**不要改**。验证码放在主题里，iPhone 的「邮件」收到后，输入框上方会直接提示这串数字。

---

## 1. Confirm signup（注册）

主题：

```
知己 Knowwo 验证码：{{ .Token }}
```

内容：

```html
<div style="max-width:420px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue',sans-serif;color:#1c1c1e">
  <p style="font-size:15px;line-height:1.6;margin:0 0 18px">你好，你正在注册知己账户。把下面的验证码填回知己里：</p>
  <p style="font-size:34px;font-weight:600;letter-spacing:8px;margin:0 0 18px">{{ .Token }}</p>
  <p style="font-size:13px;line-height:1.6;color:#8e8e93;margin:0">验证码 1 小时内有效。如果不是你本人在注册，忽略这封邮件就好。</p>
  <p style="font-size:13px;color:#8e8e93;margin:28px 0 0">知己 Knowwo</p>
</div>
```

## 2. Reset password（忘记密码）

主题：

```
知己 Knowwo 重设密码验证码：{{ .Token }}
```

内容：

```html
<div style="max-width:420px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue',sans-serif;color:#1c1c1e">
  <p style="font-size:15px;line-height:1.6;margin:0 0 18px">你在知己里点了「忘记密码」。把下面的验证码填回知己，再设一个新密码：</p>
  <p style="font-size:34px;font-weight:600;letter-spacing:8px;margin:0 0 18px">{{ .Token }}</p>
  <p style="font-size:13px;line-height:1.6;color:#8e8e93;margin:0">验证码 1 小时内有效。如果不是你本人操作，忽略这封邮件，密码不会变。</p>
  <p style="font-size:13px;color:#8e8e93;margin:28px 0 0">知己 Knowwo</p>
</div>
```

## 3. Change email address（绑定 / 更换邮箱）

主题：

```
知己 Knowwo 绑定邮箱验证码：{{ .Token }}
```

内容：

```html
<div style="max-width:420px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue',sans-serif;color:#1c1c1e">
  <p style="font-size:15px;line-height:1.6;margin:0 0 18px">你正在把知己账户的邮箱换成这个邮箱。把下面的验证码填回知己里：</p>
  <p style="font-size:34px;font-weight:600;letter-spacing:8px;margin:0 0 18px">{{ .Token }}</p>
  <p style="font-size:13px;line-height:1.6;color:#8e8e93;margin:0">验证码 1 小时内有效。如果不是你本人操作，忽略这封邮件就好。</p>
  <p style="font-size:13px;color:#8e8e93;margin:28px 0 0">知己 Knowwo</p>
</div>
```

其他模板（Magic Link、Invite user、Reauthentication）知己用不到，不用改。
