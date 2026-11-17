[English](README.md) | 简体中文

# CI 工作流

| 工作流 | 证明什么 | 什么时候跑 |
|---|---|---|
| `app.yml` | 应用能构建 Web、Linux、Windows、Android 版本并通过测试，产出发布包 | 每次 push 和 PR |
| `core.yml` | 邮件核心 crate | 每次 push 和 PR |
| `server.yml` | 云端服务镜像 | 每次 push 和 PR |
| `android-ui.yml` | AgentInbox 在 Android 模拟器上的亮色、暗色全流程：`.github/android-ui.py` 走完每个界面并截图，`.github/android-perf.py` 测大邮箱的帧率 | 每次 push 到 `main`、每个 `v*` 标签；PR 上只有带 `android-ui` 标签时跑 |
| `ci-flaky.yml` | 反复失败的 Android UI 界面，每个一条 issue | 每次 Android UI 跑完，以及每天一次 |
| `screenshots.yml` | Web 端截图 | 每次 push 和 PR |

## Android UI

它是最慢的那个（模拟器、APK、约 90 张截图），所以只在需要证据的地方跑：

- **PR 上**只有带 `android-ui` 标签时才跑，之后该 PR 每次推送（`opened`、`labeled`、
  `synchronize`、`reopened`，job 的 `if` 读取标签）都会重跑。加别的标签不会触发。
- **一定跑**：`main` 上改到 `app/**` 或驱动脚本的推送，以及 `v*` 标签。
- 每个事件只起一个模拟器：帧率测量和截图在同一个模拟器会话里，只有截图这个 job 会启动模拟器。

时间上限，卡住的运行不会烧掉一小时：

| 位置 | 上限 |
|---|---|
| 整个 job | 20 分钟 |
| 模拟器那一步（启动、帧率、截图） | 15 分钟 |
| 驱动脚本里的一个界面 | 2 分钟 |
| 整个驱动（启动之后） | 9 分钟（`DRIVE_BUDGET`） |
| 帧率测量 | 自己的等待，最多 4 分钟 |

驱动在**第一次**失败处停下，不会继续对着坏掉的应用往下跑。它会打印 `FAILED-STEP: <界面>`，
并在截图目录里留下：

- `<主题>-fail-<n>.png`——出错时的那一屏，
- `<主题>-fail-<n>.xml`——这一屏的无障碍 dump，
- `failure-logcat.txt`——从这一步开始起的 `logcat`，
- `failures.txt` 和 `steps.txt`——失败了什么，每个界面各花多久。

这些都在 `android-ui` artifact 里，成功失败都会上传。

**失败重试一次。** 驱动失败后会重装 APK、用这一步剩下的时间再跑一次，不重启模拟器。第一次的
截图保留在 `screens-attempt-1/`。重试通过的话，这次运行会在 summary 和 warning 标注里标出
**flaky**，不稳定的界面不会被一次侥幸掩盖。

**APK 按源码哈希缓存**，所以只改驱动脚本或文档的运行不会重新构建应用。只按精确的 key 命中：
别的源码编出来的 APK 截出来的就是错的应用。

## 不稳定的界面

`ci-flaky.yml` 读取最近 40 次 Android UI 运行。某个界面在 **`main` 上连续 2 次**、或在
**一个分支上连续 3 次**失败，就会开一条（或更新）标题为 `CI: Android UI <界面> is flaky` 的
issue，带 `ci`、`flaky` 标签，附上运行链接和失败日志。之后再失败是评论到这条 issue 上，不会
重复开新的；已关闭的会被重新打开。

## 手动跑 Android UI

```bash
gh workflow run android-ui.yml --ref main                      # main 上：完整驱动 + 发布截图
gh workflow run android-ui.yml --ref main -f perf_only=true     # 只测帧率
gh pr edit <n> --add-label android-ui                           # PR 上
```
