# 商業模式 & 收費模式 & 合約決策報告

**產出日期**：2026-04-25
**用途**：Ryan 與 1008 + 第 2 家店談錢、簽約前的策略性決策依據
**前置研究**：[00 主統合](./00-master-synthesis.md) / [01 西方同業](./01-western-peers-evolution.md) / [02 亞洲同業](./02-asia-taiwan-peers.md) / [03 VC 框架](./03-sv-vc-framework.md) / [04 Persona](./04-personas-iteration.md) / [競品研究](../competitive-research.md)

---

## 0. TL;DR — 五條收斂結論

如果只看一頁，看這頁：

1. **走「純訂閱 + 月繳不綁約」**。不要抽 GMV、不要學 Fresha 走 marketplace、不要學 17FIT 鎖年約。河狸家、Vaniday、GoLife 死於抽成；台灣老闆對「你吃我流水」敏感度比歐美高一倍（02-§3.2、04-1008 老闆原話）。
2. **定價錨點：1 人店 NT$1,500 / 月，3 人店 NT$3,000 / 月（+ NT$500 per staff）**。比夯客 NT$400/人貴 ~2 倍但比 Mangomint NT$5,300 便宜 60%——切「精品 LINE 原生」中段，避開地板價戰也避開 enterprise sales 戰。
3. **第一年只賣訂閱，金流分潤等 V2+**。台灣金流 take rate 已被綠界/藍新/街口壓到 1.5–2.8%，你疊一層幾乎無 margin（00-§事實 4）。先用「對帳 copilot」當 embedded finance 的 wedge，3 年後 LINE Pay / 街口 SDK 成熟再串。
4. **合約最大差異化武器是「資料屬於老闆 + 解約 60 天匯出 + 不綁約」**。台灣老闆對 SaaS 最深恐懼 = 「資料被卡」。把 Phorest 60 天保留期 + 3 工作天匯出寫進合約頂部白話 TL;DR，是你對抗夯客 / 客立樂的軟性護城河。
5. **千萬不要在合約裡放「自動續年 + 提前 2 個月通知 + 剩餘月份照付」**。這是 17FIT、Phorest、台灣中大型 SaaS 的標準做法，但也是 PTT 美業老闆最常抱怨的地雷。**走相反路線就是你的賣點**。

---

## 1. 商業模式抉擇（5 個關鍵決策）

### 1.1 訂閱 vs 抽成 vs 廣告／刊登費

| 模式 | 代表 | 規模化結果 | 對你適用度 |
|---|---|---|---|
| 純訂閱 | GlossGenius、Boulevard、Vagaro、Phorest、Mindbody | 全部活到 $500M–$8B 估值 | ★★★★★ |
| 訂閱 + Payments 抽成 | Square、Toast、Booksy（30% 新客 + 2.5% 刷卡）| Toast $25B、Booksy ARR $66M | ★★★★（V2+ 後考慮）|
| 純抽成 / Marketplace fee | Fresha 2015–2024、StyleSeat、河狸家、Vaniday | Fresha 2025 回頭收訂閱；其他全死或停滯 | ★★（不要走）|
| 廣告刊登費（雜誌型）| HPB（日本）| 月費 25,000–300,000 日圓，10 萬店 | ★（只在日本成立，台灣沒有 Recruit 式 BD 機器）|

**結論**：訂閱先行，payments 後至，廣告永遠不做。

### 1.2 SaaS 工具 vs Marketplace（消費者品牌）

> 「Come for the tool, stay for the network」（Chris Dixon 2015）— 但 2016 後被反覆驗證在美業**失敗率極高**：StyleSeat、Mindbody+ClassPass 都引爆店家反彈。Booksy 是極少數成功，因為 day 1 雙邊並行 + barber 適合消費者搜尋。

**你的位置**：純 tool。**這是好事，不是 bug。** 至少 3 年保持純 SaaS，消費者品牌 100% 交給老闆自己的 LINE 官方帳號。**這條決策也是法律上的紅線**——你接 marketplace 的瞬間，個資處理者角色從「受託」變「共同處理者」，PDPA 責任跟著加重。

### 1.3 Compound Startup vs Single-product Depth

- Conrad / Bessemer 派：一次做 4–5 個整合產品（預約 + POS + CRM + 薪資 + 金融）
- Fried / PG 派：一個產品做到極致

**收斂**：時間順序問題。
- **Year 1（現在）**：純預約 + 對帳 + 推播 三件事做到飽和（你已有雛形）。
- **Year 2**：第二個 compound 產品 = AI 對帳 copilot 或 CRM 推播 copilot。
- **Year 3+**：才考慮 POS / 薪資 / 庫存。

### 1.4 PLG vs Sales-led

| | PLG（Fresha / GlossGenius）| Sales-led（Boulevard / Mindbody / 17FIT）|
|---|---|---|
| ICP | 1 人 ~ 3 人小店 | 3+ 分店、Premium |
| GTM | 自助註冊、信用卡綁定 | demo + 客製報價 |
| ARPU | 低（$25–60/mo）| 高（$200–700/mo + per location）|

**你的選擇**：**PLG-first，但「精品 onboarding」**。
- 自助註冊 + 信用卡月扣（PLG 機制）
- 但每家店初期由你親自 onboarding（精品手感）
- 到 30 家店後再考慮要不要分流（自助 + sales-touch）

### 1.5 LINE 渠道 vs LINE 依賴

LINE 是你最大 unfair advantage 也是最大 killshot risk（LINE Taiwan 2025/10 已推 AI Voice Reservation 2.0）。

**對沖策略**：**渠道用 LINE 到底，資料自己存，UI 隨時可切 PWA**。你現有架構（Next.js + Prisma + LIFF wrapper）已是正確設計，**不要為了 LINE depth 加太多 LINE-only 功能**。

---

## 2. 定價策略（具體數字）

### 2.1 市場價格錨點（2026-04 實查）

| 區段 | 廠商 | 月費 | 註 |
|---|---|---|---|
| 地板 | 樂創約進階 | NT$399/月 | 超小店、限會員數 |
| 地板 | 夯客體驗版 | NT$0 | 限會員 80 筆 |
| 入門 | 夯客商務 | NT$400/服務人員 | 3,000+ 店家、續約率 99% |
| 中階 | 客立樂 QLiEER | NT$950/月 | 年約、會員 800 上限 |
| 中階 | LineBooking.me | NT$500/行事曆 + NT$1,200 setup | 按行事曆計 |
| 中高階 | Booksy（國際）| NT$965/月（單人）| 業界 mobile-first 標竿 |
| 高階 | Mangomint（國際）| NT$5,300/月 | 1008 老闆認過的價格範圍 |
| 不公開 | 美業歐巴 / BookNow / Boulevard / Mindbody / Phorest | contact sales | sales-led 標誌 |

### 2.2 給 1008 + 第 2 家店的建議定價（首年）

| 方案 | 月費 | 對象 | 包含 |
|---|---|---|---|
| **試用** | NT$0 / 14 天 | 新客戶 | 全功能、無信用卡 |
| **單人店** | **NT$1,500/月** | 1 人店（1008 是這個）| 預約 + LINE 整合 + CRM + 對帳助手 + 推播 1,000 則/月 |
| **多人店** | **NT$1,500 + NT$500/額外設計師** | 2–4 人店 | 同上 + 多設計師排班 |
| **連鎖** | NT$3,500/店 + custom | 5+ 人或 2 店以上 | + 跨店分析 + 專屬支援 |

**為什麼是 NT$1,500/月**：

1. **比夯客 NT$400/人貴 ~3.7 倍**：但你提供「精品 onboarding + 客製化 UI + 無 SMS 額外費」三項夯客做不到的事。NT$1,500 約是夯客 4 人店的價格——你的單人店 ARPU 直接對標夯客中型店。
2. **比 Mangomint NT$5,300 便宜 72%**：避開「老闆覺得貴」的心理門檻。1008 老闆訪談說過「1 萬以下都可以」，NT$1,500 在他舒適區內 80%。
3. **訂閱費 60% 毛利**：1 人店伺服器成本 ~NT$50–100/月（Vercel Pro 分攤、Supabase free tier、Upstash free tier、LINE messaging API push 1,000 則 ~NT$500），毛利 ~NT$900。**這是健康的 SMB SaaS unit economics**。
4. **Jason Lemkin 試金石**：00-§3 提到的「3 個月若沒多賺 NT$4,500 全退」對應的就是 NT$1,500/月 × 3。如果 1008 願意接這個賭注，PMF 確認。

### 2.3 SMS / LINE 推播計費策略

| 選項 | 操作 | 對你 | 對老闆 |
|---|---|---|---|
| A. 全免費（包月）| 1,000 LINE/月內含 | LINE 成本 ~NT$500 / 1,000 則 | 心理上「無上限」感受好 |
| B. 配額 + 超出加購 | 1,000 內含、超出 NT$1/則 | 多店時保護毛利 | 中性 |
| C. 完全獨立計費 | LINE NT$1/則、SMS NT$2/則 | 透明 | 老闆要算成本，麻煩 |

**建議走 A，3 家店後重新評估**。理由：1 人店每月推播絕不會破 1,000 則（每位客人月 ~5 則 × 200 客 = 1,000），你 cost 可控；對老闆來說「不用每則記帳」是 selling point；對抗夯客 SMS NT$1/則的差異化武器。**等到單店推播 > 3,000 則/月才需要切 B**。

### 2.4 Payments 暫時不做（V2+ 規劃）

- **不要在 V1 做金流分潤**：台灣 take rate 1.5–2.8% 已被壓到底，你自己疊一層無 margin。
- **V1.5 做「對帳 copilot」**：語音輸入「阿嬤付我 1500 末五碼 12345」→ 自動匹配。**這是 embedded finance 的 wedge，不收錢**。
- **V2+（2027–）才接金流**：等 LINE Pay / 街口 / 玉山 SDK 對 SaaS 開放分潤條件，take 0.3–0.5% on top。屆時 ARPU 可從 NT$1,500 推到 NT$3,000+。

---

## 3. 合約 10 條建議草案

針對 1 人店老闆，**白話、不嚇人、保護你 + 符合台灣 PDPA / 民法 247-1**。每條附「為什麼」。

### 條文之前先放白話 TL;DR（5 行）

> 月繳 NT$1,500，可隨時停止下個月扣款、不收解約金。
> 你的所有客戶資料屬於你，解約後 60 天內可隨時 Excel 匯出（3 工作天交付）。
> 14 天免費試用，繳了的月費不退。
> 漲價提前 30 天通知，那一個月按舊價。
> 系統故障超過每月 8 小時，下月按比例折抵。

> **這 5 行比 10 條法條更打動 1 人店老闆**。是你對抗台灣 SaaS 業界（17FIT 年約、客立樂年約、夯客自動續訂）最大的軟武器。

### 1. 試用 14 天 + 月費不退、隨時可停

> 「首次訂閱享 14 天免費試用，期間隨時可取消不收費。試用結束自動進入月繳。已扣的月費**不論是否使用滿月一律不退**，但你可隨時停止下個月扣款。」

**為什麼**：14 天 = Booksy / GlossGenius 業界標準（比 Fresha 7 天友善）。「繳了不退」與 GlossGenius / Phorest 一致，避免被當 ATM；但「隨時可停」消除老闆對「綁約」的恐懼。

### 2. 月約滾動 + 自動續訂 + 取消無解約金

> 「月繳制每月自動續訂直到主動取消。**取消請於下次扣款日前 3 天**透過後台或 LINE 通知。**不收任何解約金**。」

**為什麼**：刻意不抄 Phorest 「年約 + 提前 2 個月通知 + 剩餘月份照付」——那是台灣老闆的 PTT 抱怨王。「不收解約金」是你跟競品最大差異化。3 天緩衝避免月底突襲取消造成對帳混亂。

### 3. 漲價必須提前 30 天通知 + 最後一個月按舊價

> 「調整月費將提前 **30 天**以 email + LINE 通知。漲價生效前你可選擇取消，**最後一個月按舊費率收費**。」

**為什麼**：抄 Fresha 30 天標準，加「最後一個月按舊費率」這個甜點。避免被指控「定型化契約顯失公平」（民法 247-1）。

### 4. 資料 100% 屬老闆 + 解約後 60 天內可下載

> 「**所有客戶資料、預約紀錄都屬於老闆**。解約後 60 天內，你可隨時請求 Excel 匯出（**3 個工作天內提供**）。第 91 天起自動刪除，除非法規要求保留。」

**為什麼**：抄 Phorest 60 天保留，但匯出時間從 15 工作天壓到 3 工作天——1 人店資料量小你做得到，這是你贏 Phorest 的點。**「資料屬於老闆」一句話化解最深恐懼**。

### 5. 個資委託處理 DPA 條款（PDPA 細則第 8 條必要）

> 「老闆委託我們處理顧客個資（姓名、電話、LINE ID、預約紀錄），用途僅限預約與通知。我們承諾：(a) 加密儲存與存取控制；(b) **複委託對象**：Supabase（資料庫，AWS Tokyo）、Upstash（快取，AWS Tokyo）、Vercel（運算）、LINE Messaging API；(c) 資料外洩 **72 小時內**通知老闆；(d) 解約後依第 4 條處置資料。」

**為什麼**：PDPA 施行細則第 8 條委託監督要求。**揭露複委託是台灣最常被忽略的義務**，72 小時通知是參考 GDPR 已成事實標準。透明度本身就是賣點。

### 6. 服務可用性：99% 力求 + 故障 > 8 小時按比例折抵

> 「力求每月 99% 可用率。若**單月累積故障超過 8 小時**，下個月月費**按比例折抵**。日常維護提前 24 小時公告。」

**為什麼**：6 家西方廠商都不給 SLA，全寫 disclaim。但你做 1 人店要有溫度。99% = 每月可故障 7.2 小時，給自己 8 小時 buffer。「折抵不退現金」對你現金流安全。

### 7. 賠償上限 = 過去 3 個月已付月費

> 「對任何因使用本服務造成的損失，賠償上限為過去 3 個月你已支付的月費總額。間接損失（客戶流失、營業中斷、商譽損害）一律不負責。」

**為什麼**：Square 用 3 個月、GlossGenius 用 12 個月。3 個月對 1 人店 ARPU 是中位數，**台灣法院通常認可**。完全免責（Vagaro 的 US$100）在台灣可能被打掉成「顯失公平」。

### 8. 條款修改：實質變更提前 30 天 email + LINE 通知

> 「修改本條款的**重大內容**（費用、資料處理、服務範圍），提前 30 天 email + LINE 通知。其他文字修正即時生效並公告。**繼續使用即視為同意**，30 天內可取消。」

**為什麼**：比 GlossGenius（無預告）和 Booksy（隨時改）友善。雙重通知（email + LINE）符合 1 人店老闆只看 LINE 的習慣。

### 9. 金流：本服務不代收款 + LINE 平台異常免責

> 「本服務僅提供預約管理，**不代收任何款項**。客戶與老闆之間的現金、轉帳、退款糾紛，由老闆自行處理。LINE 通知失效（例如 LINE 平台異常）非本服務責任。」

**為什麼**：你目前沒做金流是優勢——一句話切割乾淨。LINE 異常排除責任跟 GlossGenius 切 Stripe 同樣邏輯。為 V2+ 接金流預留空間。

### 10. 爭議處理：先協商 30 天 + 台北地院第一審

> 「合約爭議雙方**先以 LINE/email 協商 30 天**。協商不成，雙方同意以**台灣台北地方法院**為第一審管轄法院。本合約適用中華民國法律。」

**為什麼**：強制協商 30 天**避免老闆衝動告你**。台北地院是合理選擇（你公司設籍）。**不要學西方 arbitration**——台灣仲裁費用比訴訟貴，老闆看到會覺得你在防他。

### 簽署形式建議

- **訂閱條款**：用 click-wrap（後台第一次登入勾選同意）即可，符合電子簽章法 2024 修法
- **個資委託處理 DPA（第 5 條）**：另外做成 PDF 用 DottedSign 簽章存證——因涉及「書面同意」要件較嚴
- **白話 TL;DR**：放在合約最頂端 + 後台註冊頁面顯眼處——降低老闆心防

---

## 4. 跟 1008 老闆的「轉訂閱」談判 script

引自 [00-master-synthesis §3](./00-master-synthesis.md#1-未來-3-個月202604--202607)的 Jason Lemkin 試金石：

> **「老闆，我下個月開始要收訂閱費，每月 NT$1,500。我跟你保證一件事：3 個月後如果你沒多賺 NT$4,500（= 3 × NT$1,500），我全退。多賺的部分（省下回訊息時間 + no-show 減少 + 客單價提升）我們一起算。」**

**這句話的設計**：
- **NT$1,500 × 3 = NT$4,500**：老闆腦中「投入產出比」一秒成立
- **「我全退」**：你願意承擔風險 → 老闆心理門檻消失
- **「一起算」**：把他變成 partner 不是 customer
- **3 個月而不是 1 個月**：你需要他長期使用累積數據（cohort retention 才有意義）

**如果他答應**：拿合約讓他簽（用上面 10 條 + 白話 TL;DR）
**如果他遲疑**：補一句「**繳一個月試試看，覺得不對隨時可以停**」
**如果他拒絕**：問「**那你覺得合理價是多少？**」——讓他自己 anchor，這是 Chesky 在 Airbnb 早期做的 Deep Truth Discovery（04-§Chesky）

---

## 5. 12 個月路線圖（從「合約 + 收費」延伸）

這是 [00-master-synthesis §3](./00-master-synthesis.md#3-最終-roadmap交叉四份研究後的收斂版) 的具體執行版：

### 🔵 月 1–3（2026-04 → 2026-07）：1008 簽約 + 找第 2 家店

- [ ] 把這份合約 10 條交給 1 位律師朋友看 1 小時（NT$3,000 內可搞定）
- [ ] 後台加「服務條款 + 白話 TL;DR」頁面
- [ ] 1008 簽約：NT$1,500/月、3 個月退費試金石
- [ ] 冷開發第 2 家店（必須非 1008 介紹）
- [ ] 埋 metric pipeline：DAU、LIFF 預約比率、推播 ROI、no-show 率

### 🟢 月 4–12（2026-07 → 2027-04）：到 10 家店 + 驗證單位經濟

- [ ] 10 家店家（冷開發 7 + 轉介 3）
- [ ] 90 天 gross retention > 80%（ServiceTitan benchmark）
- [ ] ARPU NT$1,500–2,500（基本訂閱 + 偶爾 SMS 加購）
- [ ] 推出第二個 compound 產品：**AI 對帳 copilot**（NT$500/月加購）→ 驗證 ARPU 能否上推到 NT$2,000+
- [ ] 12 個月 go/no-go 數字（00-§3 Green section）
   - MRR ≥ NT$15 萬 / Gross retention ≥ 90% / 主動推薦率 ≥ 40% / CAC payback < 6 個月

### 🟡 月 13–36：路線 A（VC seed）vs 路線 B（bootstrap）分岔

依 12 個月數字決定，詳見 [00-master-synthesis §3](./00-master-synthesis.md#-1-3-年202704--202904regional-霸主-or-利基深耕)

---

## 6. 一句話收斂

> **訂閱 NT$1,500、不綁約、資料是老闆的、合約頂端寫白話 5 行 TL;DR——這四件事就是你跟夯客 / 客立樂 / 17FIT 的真正差異化護城河。商業模式在第一年不是「策略」問題，是「合約寫不寫得讓老闆敢簽」的問題。**

---

## 7. 引用路徑索引

- 想看**為何純抽成在美業撐不住** → [00-§事實 2](./00-master-synthesis.md#事實-2純抽成marketplace-fee模式在美業撐不住規模化-revenue) / [01-§Q1](./01-western-peers-evolution.md#q1fresha-2022-改全抽成成功嗎)
- 想看**Booksy 為什麼 SaaS→marketplace 成功** → [01-§2](./01-western-peers-evolution.md#2-booksy波蘭華沙2014-創辦)
- 想看**夯客真實規模 / 續約率** → [競品研究 §3.1](../competitive-research.md#31-夯客-hotcake)
- 想看**Mangomint NT$5,300 為何 1008 接受** → [競品研究 §2.2](../competitive-research.md#22-mangomint)
- 想看**台灣 PDPA 委託處理條款細節** → 本文 §3 條 5
- 想看**民法 247-1 顯失公平判斷** → 本文 §3 條 3、條 7
- 想看**Jason Lemkin 試金石** → 本文 §4 / [00-§3 Blue section](./00-master-synthesis.md#-未來-3-個月202604--202607)

---

## Sources（本份新加，前作 00–04 的來源不重複）

**2026 西方廠商實際定價**
- [Fresha Pricing](https://www.fresha.com/pricing) / [Fresha 2025 改價分析](https://thesalonbusiness.com/fresha-review/)
- [Booksy Biz Pricing](https://biz.booksy.com/en-us/pricing) / [Booksy Pricing 2026](https://slotcut.com/blog/booksy-pricing-2026-what-you-actually-pay)
- [GlossGenius Pricing](https://glossgenius.com/pricing) / [GlossGenius 2026 (Pabau)](https://pabau.com/blog/glossgenius-pricing/)
- [Boulevard Pricing](https://www.joinblvd.com/pricing) / [Vagaro Pricing](https://www.vagaro.com/pro/pricing) / [Square Appointments Pricing](https://squareup.com/us/en/appointments/pricing)
- [Mindbody Pricing](https://www.mindbodyonline.com/business/pricing) / [Phorest Pricing](https://www.phorest.com/pricing/)

**台灣 / 亞洲廠商定價**
- [HOTCAKE 夯客 方案](https://intro.hotcake.app/plannpayment/monthlyplan)
- [客立樂 QLiEER（TCloud）](https://www.tcloud.gov.tw/solution/F03FE16036A30DAEE0531512620AC1A1)
- [LineBooking.me](https://linebooking.me/) / [美業歐巴 BeautinQ](https://www.beautinq.com/plan-content) / [BookNow](https://www.booknow.com.tw/Home/AboutUs)

**西方廠商合約條款**
- [Square General ToS](https://squareup.com/us/en/legal/general/ua) / [Fresha Partner Terms](https://terms.fresha.com/partner-terms)
- [Booksy ToS](https://booksy.com/terms.html) / [Vagaro User Agreement](https://www.vagaro.com/pro/user-agreement)
- [GlossGenius ToS](https://glossgenius.com/legal/terms) / [Phorest T&C Ireland](https://www.phorest.com/termsandconditions/)

**台灣本土法規**
- [個資法第 8 條](https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=I0050021&flno=8)
- [個資法施行細則](https://law.moj.gov.tw/LawClass/LawAll.aspx?PCode=I0050022)
- [消費者保護法](https://www.ey.gov.tw/Page/4FF303AE95592945/f65a641d-d096-48c1-b357-435ac7786e72)
- [台灣電子簽章法 2024 修法](https://www.is-law.com/impact-and-expectations-of-the-amendments-to-the-electronic-signatures-act/)
- [線上勾選同意是否合法（益思）](https://www.is-law.com/17-889/)
- [資訊雲端服務採購契約範本（數位部 113.5）](https://gsmarket.adi.gov.tw/portal/storage/uploads/regulations/urDYxDSsGuP2NQqnvH0HXRKpuDQcL78VqqNoI6H9.pdf)
- [SaaS 雲端合約 20 個關鍵詞彙](https://legalenglish.com.tw/blog/20-cloud-service-key-word)
- [Cyberbiz 服務條款](https://www.cyberbiz.io/terms-of-customer/)
