English | [简体中文](next.zh-CN.md)

## Added

## Improved

## Fixed

- Every page shows its title again: the bar's compact title faded in from a scroll value nothing drove, so it stayed at zero opacity.
- **Android draws edge to edge again.** The content starts under the status bar,
  in the app's own background, with icons that follow the appearance: the native
  toolbar the navigation stack added over each page is gone (its light window
  colour was the white band, and it pushed every page 100 pt down).
- **The type face is the platform's.** Android draws Roboto for Latin and Noto
  Sans CJK SC for Chinese, windows Segoe UI, and the web follows the system, so
  glyphs are no longer a loose fallback; iOS's letter spacing now applies only
  where SF Pro is the font it was measured against.
- **One spinner.** The list's pull to refresh is the Cupertino indicator; the
  platform's teal Material spinner no longer appears beside the bar's.

