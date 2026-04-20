# REPUTEXA Zenith WhatsApp and Google preview (internal)

## Sampling (anti-spam)

- Production does **not** send a review-solicitation WhatsApp to every eligible customer by default.
- Document the **controlled sampling** model (typically about **one invitation per ten eligible visits or checkouts**, merchant-configurable) anywhere we describe outreach volume, landing copy, pricing matrix, or support answers.
- Keep this aligned with product truth: avoid implying a message goes to 100% of ticket lines unless a specific merchant setting does so.

## Google public reply in demos and UI

- **Landing tunnel** `googleScene.businessReply` must read like a **real owner reply**: explicitly reuse **at least two concrete terms** from the published review snippet, same quality bar as dashboard review-reply settings (tone, length, instructions).
- When editing `lib/landing/whatsapp-tunnel-demo-ai.ts` prompts or static fallbacks, preserve this rule.

## WhatsApp: copy + link (never one wall of text)

- After the customer approves the draft, **do not** put the Google URL inside the same bubble as long copy-paste instructions.
- **Demo transcripts**: use **at least two business bubbles** for the handoff: (1) copy instruction referring to the draft message above (long-press), (2) **link-only** bubble with the write-review URL (demo or production).
- **Production**: `handlePublishReview` sends an intro line, then the `/api/review/publish?id=…` URL on its own, then thanks; Zenith capture sends copy hint, then raw `google_review_url` (or writereview URL), then short instructions.

## WhatsApp: consent without naming the channel

- In **customer-facing** text (French and other locales), **do not** write phrases like « pour continuer sur WhatsApp », « sur WhatsApp », « cette conversation WhatsApp ». The channel is obvious; repeating it sounds like a template bot.
- Consent **explicit yes/no** for continuing the written thread (GDPR) must stay clear, but phrased like a human: « si vous voulez qu’on continue », « pour la suite par message », « vous préférez qu’on s’arrête là ou qu’on en parle deux minutes ».
- Same idea in English: avoid stiff "to continue on WhatsApp" / "on WhatsApp for this thread"; use "here", "keep going", "yes or no".

## WhatsApp: structural variety and emojis

- **Every** generated transcript must differ in **structure** (order of blocks, first-bubble shape, rhythm). No reusable template across generations.
- **Emojis**: 0-3 total per thread for business bubbles; sometimes 1-2 in one bubble when it fits (e.g. 🙏 after thanks, ✨ on a compliment); never spam. See `SMS_WHATSAPP_TONE` in `lib/ai/concierge-prompts.ts`.

## Public Google replies (review text)

- **Never** reuse the same skeleton twice in a row for the same merchant (opening pattern, paragraph order). Use `openingPatternIdx` / variant instructions in `lib/ai/concierge-prompts.ts` and `review-reply-brain.ts`.
- **0 or 1 emoji** max on public replies if tone allows; never a row of emojis. Reinforced in `HUMAN_CHARTER_BASE` and `buildStyleInstruction` in `review-reply-brain.ts`.

## Typography

- Follow project typography: ASCII hyphen only (no em-dash or en-dash) in code comments and user-facing strings unless a locale file already uses special punctuation by design.
