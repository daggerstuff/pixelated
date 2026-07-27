# AGENTS.md - DMCTN Taste Gate R2

Trước khi code UI/frontend, agent phải chạy **Taste Gate R2** (`.cursor/rules/dmctn-taste-gate.mdc`).

Skills: `skills/taste-skill`, `skills/component-taste`, `skills/ui-review-skill` (sau khi có UI).

## 1. Design Read (bắt buộc)

Block: product type, target user, intent, primary action, hierarchy, constraints.

Một dòng tóm tắt:

> Đọc brief này là: `<loại trang/app>` cho `<người dùng>`, intent `<…>`, nghiêng về `<hệ/phong cách>`.

Không code trước khi có block + dòng tóm tắt.

## 2. Taste Direction + Ba nút chỉnh

- Chọn **một** Developer Preset từ `skills/taste-skill` (dev/SaaS/dashboard/devtool/docs/agent UI).
- `DESIGN_VARIANCE`, `MOTION_INTENSITY`, `VISUAL_DENSITY` (1-10).

Mặc định sản phẩm thực dụng:

```text
DESIGN_VARIANCE: 5-7
MOTION_INTENSITY: 2-4
VISUAL_DENSITY: 5-7
```

## 3. UI Plan + Pre-Flight Check Lite

- UI Plan: layout, components, responsive, a11y, states, edge cases.
- Pre-Flight: 10 câu YES/NO → chỉ `PASS_TO_CODE` mới được sửa UI.

## 4. Luật chống giao diện AI rập khuôn

FAIL nếu: generic SaaS hero, 3 card ngang, gradient AI, glass vô nghĩa, CTA glow, Inter/slate mặc định, emoji/icon lộn xộn, animation khoe, mobile khó dùng, thiếu loading/empty/error.

## 5. Luật sản phẩm thật

- mobile-first (360 / 768 / 1280)
- trạng thái loading/empty/error/success
- semantic heading, keyboard/focus, contrast
- không layout shift lớn; không che nội dung chính

## 6. Web public / auth (khi áp dụng)

- SEO/metadata/OG khi public
- validation, CSRF/session, không log secret/token, không key trên frontend

## 7. Output trước khi code

```text
DESIGN_READ: ...
TASTE_DIRECTION: ...
DIALS: ...
UI_PLAN: ...
PRE_FLIGHT_LITE: ...
ANTI_SLOP_RISKS: ...
VERDICT: PASS_TO_CODE | NEEDS_MORE_BRIEF
```

## 8. Sau khi có UI

Dùng `skills/ui-review-skill` — **Design QA Score** (100) + verdict READY / NEEDS_POLISH / NEEDS_REDESIGN / FAIL.
