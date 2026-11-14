[English](next.md) | 简体中文

## 新增

## 改进

## 修复

- 通知来源：`POST /v1/sources` 和 `PATCH /v1/sources/{id}` 的顶层也接受 `preset`；不认识的字段或预设名返回 `400`，不再默默建出一个没有映射的来源。
- 来源页和空收件箱的说明里把聊天机器人写成了可用来源，但它还没做；现在文案只写当前能用的：Webhook、Gotify、ntfy 和邮件。
