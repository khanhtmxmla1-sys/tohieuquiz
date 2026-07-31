# Thiáº¿t káº¿ bá»™ icon thÆ°Æ¡ng hiá»‡u TÃ´Hiá»‡uQuiz

## Má»¥c tiÃªu

ÄÆ°a bá»™ 12 icon riÃªng cá»§a TÃ´Hiá»‡uQuiz vÃ o dá»± Ã¡n theo cÃ¡ch cÃ³ kiá»ƒm soÃ¡t, lÃ m giao diá»‡n cÃ³ báº£n sáº¯c giÃ¡o dá»¥c rÃµ rÃ ng hÆ¡n mÃ  khÃ´ng thay tháº¿ cÃ¡c icon thao tÃ¡c nhá» Ä‘ang dÃ¹ng tá»‘t tá»« Lucide.

## Pháº¡m vi láº§n triá»ƒn khai nÃ y

- Chuáº©n hÃ³a 12 icon thÃ nh 12 file WebP riÃªng, khung 256 Ã— 256 px, ná»n trong suá»‘t.
- LÆ°u táº¡i `public/icons/tohieuquiz/`.
- Táº¡o component dÃ¹ng chung `TohieuIcon` vá»›i danh sÃ¡ch tÃªn icon Ä‘Æ°á»£c kiá»ƒm soÃ¡t báº±ng TypeScript.
- Ãp dá»¥ng thá»­ nghiá»‡m táº¡i sÃ¡u tháº» â€œThao tÃ¡c nhanhâ€ trÃªn Dashboard giÃ¡o viÃªn.
- KhÃ´ng thay icon trong Sidebar, nÃºt sá»­a/xÃ³a/tÃ¬m kiáº¿m, tráº¡ng thÃ¡i, cáº£nh bÃ¡o hoáº·c form.
- KhÃ´ng thay Ä‘á»•i nghiá»‡p vá»¥, Ä‘iá»u hÆ°á»›ng hoáº·c dá»¯ liá»‡u.

## Bá»™ icon

1. `overview` â€” Tá»•ng quan
2. `quiz-create` â€” Táº¡o Ä‘á»
3. `quiz-management` â€” Quáº£n lÃ½ Ä‘á»
4. `assignment` â€” Giao bÃ i
5. `classroom` â€” Lá»›p há»c
6. `live-exam` â€” Thi trá»±c tiáº¿p
7. `learning-results` â€” Káº¿t quáº£ há»c táº­p
8. `certificate` â€” Chá»©ng nháº­n
9. `parent-portal` â€” Phá»¥ huynh
10. `notification` â€” ThÃ´ng bÃ¡o
11. `gift-shop` â€” Tiá»‡m táº¡p hÃ³a
12. `settings` â€” CÃ i Ä‘áº·t

## Quy táº¯c sá»­ dá»¥ng

- Icon module lá»›n: 40â€“72 px; Dashboard thá»­ nghiá»‡m dÃ¹ng 48 px.
- Icon lÃ  hÃ¬nh trang trÃ­ khi Ä‘Ã£ cÃ³ nhÃ£n chá»¯, vÃ¬ váº­y pháº£i dÃ¹ng `alt=""` vÃ  `aria-hidden="true"`.
- KhÃ´ng dÃ¹ng icon áº£nh á»Ÿ kÃ­ch thÆ°á»›c 16â€“24 px; cÃ¡c vá»‹ trÃ­ nÃ y tiáº¿p tá»¥c dÃ¹ng Lucide.
- Má»i Ä‘Æ°á»ng dáº«n asset pháº£i Ä‘i qua `TohieuIcon`, khÃ´ng viáº¿t ráº£i rÃ¡c trong component khÃ¡c.
- KhÃ´ng thÃªm dependency áº£nh má»›i.

## Kiáº¿n trÃºc

`TohieuIcon.tsx` sá»Ÿ há»¯u map tÃªn icon â†’ Ä‘Æ°á»ng dáº«n asset vÃ  render tháº» `img` cÃ³ kÃ­ch thÆ°á»›c xÃ¡c Ä‘á»‹nh. `DashboardQuickAction` chá»‰ lÆ°u tÃªn icon thÆ°Æ¡ng hiá»‡u. `QuickActionGrid` render icon qua component nÃ y vÃ  giá»¯ nguyÃªn hÃ nh vi button, focus ring, responsive grid vÃ  nhÃ£n chá»¯ hiá»‡n táº¡i.

## Tráº£i nghiá»‡m hÃ¬nh áº£nh

- Bá» mÃ u icon Lucide khá»i sÃ¡u tháº» thá»­ nghiá»‡m.
- Duy trÃ¬ ná»n tháº» sÃ¡ng, viá»n nháº¹ vÃ  hover hiá»‡n cÃ³.
- Khung icon dÃ¹ng ná»n trung tÃ­nh ráº¥t nháº¹ Ä‘á»ƒ hÃ¬nh áº£nh ná»•i rÃµ nhÆ°ng khÃ´ng táº¡o thÃªm hiá»‡u á»©ng gradient/glow giáº£.
- Icon khÃ´ng Ä‘Æ°á»£c lÃ m tÄƒng chiá»u cao tháº» quÃ¡ má»©c trÃªn mobile.

## Kiá»ƒm thá»­

- Unit test map Ä‘Æ°á»ng dáº«n, kÃ­ch thÆ°á»›c vÃ  accessibility cá»§a `TohieuIcon`.
- Cáº­p nháº­t test Dashboard Ä‘á»ƒ xÃ¡c nháº­n sÃ¡u icon thÆ°Æ¡ng hiá»‡u Ä‘Æ°á»£c render vÃ  cÃ¡c button váº«n Ä‘iá»u hÆ°á»›ng Ä‘Ãºng.
- Cháº¡y test liÃªn quan, typecheck, lint vÃ  build.
- Kiá»ƒm tra axe hiá»‡n cÃ³ cho Dashboard giÃ¡o viÃªn.

## TiÃªu chÃ­ hoÃ n thÃ nh

- CÃ³ Ä‘Ãºng 12 file asset riÃªng.
- SÃ¡u tháº» thao tÃ¡c nhanh hiá»ƒn thá»‹ icon riÃªng, khÃ´ng cÃ²n dÃ¹ng Lucide cho pháº§n minh há»a module.
- KhÃ´ng cÃ³ lá»—i TypeScript, lint, test hoáº·c build má»›i.
- KhÃ´ng thay Ä‘á»•i Sidebar vÃ  cÃ¡c icon thao tÃ¡c nhá».

