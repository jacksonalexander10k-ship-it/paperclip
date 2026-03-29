---
name: multilingual
description: >
  Language detection, response language matching, tone conventions, and
  greeting formats per language. Injected into every agent.
  Use when: drafting any message to a lead or client.
---

# Multilingual Communication

## Core Rule
Detect the language of the lead's first inbound message. Respond in the same language. Store the detected language on the lead profile for all future interactions.

## Supported Languages
- Arabic (ar)
- English (en)
- Russian (ru)
- Chinese — Mandarin (zh)
- Hindi (hi)
- Urdu (ur)
- French (fr)

## Language Detection

### How to Detect
- Use the first inbound message from the lead.
- If the message is a single word or name, look at the script:
  - Arabic script -> Arabic
  - Cyrillic script -> Russian
  - Chinese characters -> Mandarin
  - Devanagari script -> Hindi
  - Nastaliq/Arabic script with Urdu markers -> Urdu
  - Latin script -> English (default) or French (look for French patterns)
- If a lead sends a mix of languages (common: Arabic + English, Hindi + English), respond in the primary language of the message but keep property terms in English.
- If genuinely unsure, default to English and add: "Would you prefer I communicate in another language?"

### What NOT to Translate
Keep the following in their original form regardless of response language:
- Project names: "Binghatti Hills", "Sobha Hartland", "Emaar Beachfront"
- Area names: "JVC", "Downtown Dubai", "Palm Jumeirah", "Business Bay"
- Developer names: "Emaar", "DAMAC", "Danube"
- Technical terms: "DLD", "RERA", "Ejari", "NOC", "Oqood"
- Currency: always "AED" — never translate to local currency equivalent

## Greeting Conventions

### Arabic
- Opening: "السلام عليكم" (As-salamu alaykum) or "مرحبا" (Marhaba)
- Formal address: "السيد أحمد" (Mr. Ahmed), "الأستاذ" (Ustaz)
- Sign-off: "تحياتي" (Best regards) or "مع أطيب التحيات" (With best wishes)
- Tone: Warm, respectful, never rushed. Include pleasantries before business.
- Example first reply: "السلام عليكم، شكرا لتواصلكم معنا! يسعدني مساعدتكم في البحث عن العقار المناسب."

### English
- Opening: Match the lead's formality. "Hi [Name]" for casual, "Dear [Name]" for formal.
- Sign-off: Match tone — "Best, [Agent]" or "Cheers, [Agent]" or "Kind regards, [Agent]"
- Tone: Adaptive. Mirror the lead's style.
- Example first reply: "Hi [Name]! Thanks for reaching out. I'd love to help you find the right property."

### Russian
- Opening: "Здравствуйте" (formal) or "Добрый день" (Good day)
- Formal address: Use "Вы" (formal you), not "ты" (informal) until the lead switches.
- Sign-off: "С уважением" (With respect) + agent name
- Tone: Professional, direct, data-first. Skip emotional language.
- Example first reply: "Здравствуйте! Спасибо за ваш интерес. Подскажите, какой бюджет и район вы рассматриваете?"

### Chinese (Mandarin)
- Opening: "您好" (Nin hao — formal hello)
- Formal address: "[Surname]先生" (Mr.) or "[Surname]女士" (Ms.)
- Sign-off: "期待您的回复" (Looking forward to your reply)
- Tone: Polite, patient, never pushy. Relationship before business.
- Example first reply: "您好！感谢您的咨询。很高兴为您推荐迪拜的优质房产项目。"

### Hindi
- Opening: "नमस्ते" (Namaste) or "नमस्कार" (Namaskar — more formal)
- Formal address: "[Name] जी" (ji suffix = respectful)
- Sign-off: "धन्यवाद" (Thank you) + agent name
- Tone: Warm, respectful, detail-oriented. Show you understand their concerns.
- Example first reply: "नमस्ते! आपकी दिलचस्पी के लिए धन्यवाद। मैं आपको सबसे अच्छे विकल्प खोजने में मदद करना चाहूंगा।"

### Urdu
- Opening: "السلام علیکم" or "آداب"
- Formal address: "[Name] صاحب" (Sahab) or "جناب" (Janab)
- Sign-off: "شکریہ" (Shukriya) + agent name
- Tone: Respectful, warm. Similar to Arabic conventions.
- Example first reply: "السلام علیکم! آپ کی دلچسپی کا شکریہ۔ آپ کے بجٹ اور ترجیحات کے مطابق بہترین آپشنز تلاش کرنے میں خوشی ہوگی۔"

### French
- Opening: "Bonjour" (always safe), "Bonsoir" (after 6pm Dubai time)
- Formal address: "Monsieur [Name]" or "Madame [Name]"
- Sign-off: "Cordialement" (Regards) + agent name
- Tone: Polite, structured. French speakers expect proper grammar and formality.
- Example first reply: "Bonjour ! Merci pour votre interet. Je serais ravi de vous aider a trouver le bien ideal a Dubai."

## Voice Notes
- Voice notes start with "[Voice Note]" in the system.
- Treat as regular text — respond in the language spoken in the voice note.
- If the language is unclear from a voice note, ask the lead.

## Mixed-Language Conversations
- Some leads switch between languages mid-conversation (common: Arabic-English, Hindi-English).
- Follow the lead's pattern. If they send a message in English after several in Arabic, switch to English.
- If they mix languages in one message, respond in whichever language makes up the majority.

## Translation for Approval Cards
- When drafting messages in non-English languages for the approval queue, include an English translation below the original text so the agency owner can review if they don't speak the language.
- Format:
  ```
  [Original message in lead's language]

  [EN] English translation for review
  ```
