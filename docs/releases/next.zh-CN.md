[English](next.md) | 简体中文

## 新增

## 改进

## 修复

- 通知来源：`POST /v1/sources` 和 `PATCH /v1/sources/{id}` 的顶层也接受 `preset`；不认识的字段或预设名返回 `400`，不再默默建出一个没有映射的来源。
