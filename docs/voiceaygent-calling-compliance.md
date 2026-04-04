# VoiceAygent — Outbound AI Calling Compliance Guide

Last updated: April 2026

This document covers the legal and compliance requirements for operating an AI-powered outbound calling platform across the United States, United Kingdom, European Union, and United Arab Emirates. VoiceAygent makes automated outbound sales calls using AI voices that sound human — every jurisdiction covered here has specific rules that apply.

---

## Table of Contents

1. [US — TCPA (Telephone Consumer Protection Act)](#1-us--tcpa)
2. [US — FCC 2024/2025 Rulings on AI Voices](#2-us--fcc-20242025-rulings-on-ai-voices)
3. [US — Do-Not-Call Registry](#3-us--do-not-call-registry)
4. [US — State-Level Laws](#4-us--state-level-laws)
5. [US — Caller ID / STIR-SHAKEN](#5-us--caller-id--stir-shaken)
6. [US — Recording Consent (One-Party vs Two-Party)](#6-us--recording-consent)
7. [United Kingdom](#7-united-kingdom)
8. [European Union](#8-european-union)
9. [United Arab Emirates](#9-united-arab-emirates)
10. [AI Disclosure Requirements — All Jurisdictions](#10-ai-disclosure-requirements--all-jurisdictions)
11. [Consent Management — What VoiceAygent Must Store](#11-consent-management--what-voiceaygent-must-store)
12. [Product Compliance Checklist](#12-product-compliance-checklist)

---

## 1. US -- TCPA

The Telephone Consumer Protection Act (47 U.S.C. 227) is the primary federal law governing automated and prerecorded calls in the United States. It is enforced by the FCC.

### What the TCPA Requires

**Prior Express Written Consent (PEWC)** is required before making:
- Telemarketing or advertising calls using an automatic telephone dialing system (ATDS) or prerecorded/artificial voice to **cell phones**
- Calls using a prerecorded/artificial voice to **residential landlines** for telemarketing

**Prior Express Consent** (verbal, not necessarily written) is sufficient for:
- Non-telemarketing, informational calls using an ATDS or prerecorded voice to cell phones (e.g., appointment reminders, delivery notifications)

**No consent required** for:
- Live, manually-dialed calls to cell phones (but the person on the phone must still be able to opt out)
- Calls made for emergency purposes

### What Counts as Prior Express Written Consent

A signed agreement (electronic signatures count) that:
- Clearly authorises the specific caller to deliver calls using an ATDS or artificial/prerecorded voice
- Includes the phone number to be called
- Is not a condition of purchasing goods or services (consent must be optional)
- The consumer was informed that they are consenting to receive automated/prerecorded calls

### Key TCPA Rules for Outbound Calling

| Rule | Requirement |
|------|-------------|
| Calling hours | 8:00 AM to 9:00 PM local time of the called party |
| Opt-out mechanism | Must provide an automated opt-out during every prerecorded call |
| Opt-out processing | Must honour revocation within **10 business days** (FCC rule effective April 11, 2025) |
| Caller identification | Must transmit caller ID and provide the caller's name and phone number if requested |
| Internal DNC list | Must maintain a company-specific do-not-call list |

### Penalties

| Type | Amount |
|------|--------|
| Statutory damages (private litigation) | **$500 per violation** (per call) |
| Willful/knowing violations | **$1,500 per violation** (treble damages) |
| FTC enforcement (Telemarketing Sales Rule) | Up to **$51,744 per violation** |
| No cap on aggregate damages | Class actions regularly reach $10M-$100M+ |

### The One-to-One Consent Rule — Status as of April 2026

In December 2023, the FCC adopted a rule requiring "one-to-one" consent — meaning a consumer visiting a comparison-shopping website could not have their consent shared with dozens of sellers. This was set to take effect January 27, 2025.

**Current status: STRUCK DOWN.** On January 24, 2025, the Eleventh Circuit Court of Appeals (Insurance Marketing Coalition v. FCC) ruled that the FCC exceeded its statutory authority. The court found the rule contradicted the plain meaning of "prior express consent" in the TCPA. In April 2025, the FCC stated it would not challenge this ruling.

**What this means for VoiceAygent:** The one-to-one consent requirement is dead. The pre-existing consent framework applies — but this does NOT reduce the need for robust consent. Consent from lead generators that names your company (or a broad enough category) remains valid. Best practice is still to obtain consent that specifically identifies your business.

### Consent Revocation Rules (Active as of April 2025)

- Consumers can revoke consent by **any reasonable means** (saying "stop calling," texting STOP, email, etc.)
- Businesses must process revocations within **10 business days**
- The "revocation-all" requirement (where revoking consent to one seller revokes consent to all sellers using the same lead data) has been **delayed until January 31, 2027**

---

## 2. US -- FCC 2024/2025 Rulings on AI Voices

### The February 2024 Declaratory Ruling (FCC 24-17)

On February 8, 2024, the FCC adopted a Declaratory Ruling that is the single most important regulation for VoiceAygent:

**AI-generated voices are "artificial voices" under the TCPA.**

This means:
- Any call using an AI-generated voice is a "robocall" under TCPA definitions
- All TCPA consent requirements apply to AI voice calls — no exceptions
- AI voices that sound human are still "artificial" — sounding natural does not exempt them
- Voice cloning technology is explicitly covered
- There is no carve-out for AI systems that provide "the equivalent of a live agent"

**Key quote from the FCC:** "We confirm that the TCPA's restrictions on the use of 'artificial or prerecorded voice' encompass current AI technologies that generate human voices."

This ruling was **effective immediately** — no implementation period.

### The July 2024 NPRM (Further Proposed Rules)

In July 2024 (Federal Register, September 10, 2024), the FCC issued a Notice of Proposed Rulemaking seeking comment on additional AI-specific rules:

- **Defining "AI-generated call"** — establishing a formal regulatory definition
- **Mandatory in-call disclosure** — requiring callers to disclose within the first 30 seconds that AI voice technology is being used
- **Specific consent for AI calls** — potentially requiring separate, affirmative consent specifically for AI-generated voice calls (above and beyond standard TCPA consent)

Comment period closed January 5, 2026. Reply comments due February 3, 2026. **As of April 2026, the FCC has not yet issued a final rule from this NPRM, but the direction is clear: more requirements, not fewer.**

### What This Means Practically for VoiceAygent

1. **Every outbound AI voice call requires TCPA-compliant prior express written consent** — period
2. **AI voice calls are robocalls** — all robocall restrictions apply (calling hours, opt-out, DNC, etc.)
3. **Disclosing AI use at the start of the call is de facto required** — even though the NPRM hasn't finalised, multiple states already require it, and the FCC has signalled this is the direction of federal regulation
4. **"It sounds like a real person" is not a defence** — it is actually an aggravating factor if a consumer feels deceived
5. **VoiceAygent must treat every AI call identically to a prerecorded robocall** for compliance purposes

---

## 3. US -- Do-Not-Call Registry

The National Do-Not-Call Registry is administered by the FTC under the Telemarketing Sales Rule (TSR). The FCC enforces parallel DNC provisions under the TCPA.

### Requirements

| Requirement | Detail |
|-------------|--------|
| Registry scrubbing | Must check all outbound call lists against the National DNC Registry **at least once every 31 days** |
| Internal DNC list | Must maintain your own company-specific DNC list of people who have asked not to be called |
| Established Business Relationship (EBR) exemption | If there is an existing business relationship, you may call — but the consumer can still opt out at any time |
| Access fee (2025) | $82 per area code of data (after first 5 free), maximum $22,626/year |
| Safe harbour | Telemarketers who can show they checked the registry, maintained internal DNC lists, and have written DNC procedures have a safe harbour defence against TCPA claims |

### State DNC Lists

Many states maintain their own Do-Not-Call lists in addition to the federal registry. Notable examples:
- **Indiana** — maintains a separate state DNC list
- **Pennsylvania** — separate state list
- **Texas** — separate state list
- **Colorado** — separate state list

VoiceAygent must check against **both** the federal registry and any applicable state DNC lists.

### Exemptions from DNC (Limited)

- Calls to people with whom you have an established business relationship (within 18 months of last transaction, or 3 months of last enquiry)
- Calls where written consent was obtained
- Calls by tax-exempt nonprofit organisations
- Political calls (not applicable to VoiceAygent)

---

## 4. US -- State-Level Laws

Several states have laws stricter than federal TCPA requirements. VoiceAygent must comply with the most restrictive applicable law.

### California

**California is the strictest state for AI calling.**

- **AB 2905 (effective January 1, 2025):** Requires disclosure of AI use in automated calls. **$500 fine per undisclosed AI call.**
- **SB 243 (effective January 1, 2026):** Targets AI-powered "companion chatbots" — broadly defines AI systems with natural language interfaces that provide adaptive, human-like responses. Requires disclosure, notice, and regulatory reporting.
- **California AI Transparency Act (SB 942):** Mandates AI systems with 1M+ monthly users implement measures to disclose AI-generated content. Penalties of **$5,000 per violation per day** for noncompliance.
- **California's CCPA/CPRA:** Additional data privacy requirements — consumers can opt out of data sale, request deletion. Applies to call recordings and lead data.
- **Two-party consent for recording** (Cal. Penal Code 632) — see Section 6.

### Florida

- **Florida Telephone Solicitation Act:** Stricter than federal TCPA on calling hours and consent
- **Two-party consent for recording** (Fla. Stat. 934.03) — criminal penalties for noncompliance
- State-level DNC provisions

### Colorado

- **Colorado AI Act (postponed to June 2026):** When effective, requires deployers of "high-risk AI systems" to use reasonable care to avoid algorithmic discrimination. Mandates impact assessments, transparency disclosures, and documentation of AI decision-making processes. Directly relevant if VoiceAygent's AI is making decisions about who to call or how to pitch.

### Illinois

- **Illinois AI Video Interview Act:** While focused on video, sets a precedent for AI disclosure in hiring contexts
- **Biometric Information Privacy Act (BIPA):** If VoiceAygent captures voiceprints from call recipients, BIPA's strict biometric consent rules apply. **$1,000-$5,000 per violation.**

### Texas

- Maintains a separate state DNC list
- Telemarketing Disclosure Act imposes additional requirements

### Washington

- Two-party consent state for recording
- Washington Privacy Act requirements for data handling

### New York

- New York City's AI employment law (Local Law 144) establishes AI disclosure precedent
- State-level telemarketing restrictions apply

**VoiceAygent must implement geo-location-based compliance** — detecting the called party's state and adjusting disclosure scripts, recording consent, and DNC checks accordingly.

---

## 5. US -- Caller ID / STIR-SHAKEN

### Caller ID Requirements

Under the Truth in Caller ID Act (47 U.S.C. 227(e)):
- It is **illegal to transmit misleading or inaccurate caller ID information** with the intent to defraud, cause harm, or wrongfully obtain anything of value
- The caller ID must display the **actual number** of the calling party or a number that the calling party has the right to use
- Businesses must show a valid, dialable callback number

### STIR/SHAKEN Framework

STIR (Secure Telephone Identity Revisited) / SHAKEN (Signature-based Handling of Asserted information using toKENs) is a set of technical standards that authenticate caller ID on IP networks:

- **A-level attestation:** The carrier can verify the caller is authorised to use the calling number (highest trust)
- **B-level attestation:** The carrier knows the customer but cannot verify the specific number
- **C-level attestation:** The call originates from a gateway; the carrier cannot verify the origin

**What this means for VoiceAygent:**
- Use a legitimate telephony provider (Twilio, Vonage, etc.) that implements STIR/SHAKEN
- Ensure your outbound numbers are properly registered and attested at **A-level** whenever possible
- Calls without proper STIR/SHAKEN attestation are increasingly being blocked or flagged as spam by carriers
- The FCC proposed in October 2025 to require terminating providers to transmit verified caller name via Rich Call Data (RCD) for A-level attested calls — this will make proper number registration even more important

### FCC 2025 Actions

- The FCC is closing the "non-IP gap" — requiring caller ID authentication even for calls that traverse non-IP (legacy TDM) network segments
- Carriers are increasingly required to block calls that fail authentication
- VoiceAygent should register all outbound numbers with carrier registries and maintain proper CNAM (Caller Name) records

---

## 6. US -- Recording Consent

If VoiceAygent records calls (for quality assurance, training data, dispute resolution, or compliance), recording consent laws apply separately from calling consent.

### Federal Law

Federal wiretap law (18 U.S.C. 2511) requires **one-party consent** — as long as one party to the conversation consents to the recording, it is legal. Since VoiceAygent (the caller) consents, federal law is satisfied.

**However, state law can be stricter, and the stricter law applies.**

### Two-Party (All-Party) Consent States

These states require **all parties** to the conversation to consent to recording:

| State | Statute | Penalties |
|-------|---------|-----------|
| **California** | Penal Code 632 | Criminal: up to 1 year jail + $2,500 fine. Civil: $5,000 per violation |
| **Connecticut** | Conn. Gen. Stat. 52-570d | Civil liability |
| **Delaware** | 11 Del. C. 2402 | Criminal: felony |
| **Florida** | Fla. Stat. 934.03 | Criminal: up to 5 years. Civil: damages |
| **Illinois** | 720 ILCS 5/14-2 | Criminal: felony. Civil: $10,000-$20,000 per violation |
| **Maryland** | Md. Code, Cts. & Jud. Proc. 10-402 | Criminal: up to 5 years. Civil: damages |
| **Massachusetts** | Mass. Gen. Laws ch. 272 99 | Criminal: up to 5 years. Civil: damages |
| **Montana** | Mont. Code Ann. 45-8-213 | Criminal: up to 1 year + $500 fine |
| **Nevada** | NRS 200.620 | Criminal: category D felony |
| **New Hampshire** | RSA 570-A:2 | Criminal: class B felony |
| **Pennsylvania** | 18 Pa.C.S. 5703 | Criminal: up to 7 years. Civil: damages |
| **Washington** | RCW 9.73.030 | Criminal: gross misdemeanor. Civil: damages |

### What VoiceAygent Must Do

1. **Detect the called party's state** (by phone number area code and/or address on file)
2. **In two-party consent states:** Include a recording disclosure at the start of the call: "This call may be recorded for quality and compliance purposes. By continuing, you consent to recording."
3. **In one-party consent states:** Recording disclosure is not legally required but is still best practice
4. **If the called party objects to recording:** Either stop recording immediately or end the call
5. **Store recording consent evidence** — log that the disclosure was played and the called party continued the conversation (implied consent) or explicitly agreed

### Interstate Calls

When calling across state lines, the general rule is to follow the stricter state's law. If VoiceAygent is based in a one-party state but calling someone in California, California's two-party consent law applies. **Best practice: always disclose recording and obtain consent, regardless of jurisdiction.**

---

## 7. United Kingdom

### Regulatory Framework

Three bodies govern outbound calling in the UK:

| Regulator | Scope |
|-----------|-------|
| **ICO** (Information Commissioner's Office) | Data protection (UK GDPR) and direct marketing (PECR) |
| **Ofcom** | Nuisance calls, silent calls, general telecoms regulation |
| **TPS/CTPS** | Telephone Preference Service (consumer) / Corporate TPS (business) |

### PECR — Privacy and Electronic Communications Regulations 2003

PECR is the primary law for outbound marketing calls:

**Automated marketing calls (prerecorded messages):**
- Require **prior consent** from the recipient — no exceptions
- This directly applies to VoiceAygent's AI voice calls

**Live marketing calls:**
- Do NOT require prior consent (unlike automated calls)
- BUT you must check the TPS/CTPS register and not call numbers listed there
- The recipient can opt out at any time

**The critical question for AI voice agents:**
The ICO and Ofcom are actively debating whether conversational AI systems that conduct real-time dialogue are "automated calls" (requiring consent) or "live calls" (requiring only TPS checking). As of April 2026, the safer interpretation — and the one the ICO is signalling — is that **AI voice calls should be treated as automated calls requiring prior consent**, because no live human is present on the calling end.

### PECR Penalty Regime (Updated 2025)

The Data (Use and Access) Act 2025 (effective June 2025) aligned PECR penalties with UK GDPR:
- Maximum fine: **GBP 17.5 million or 4% of global annual turnover** (whichever is higher)
- Previously, PECR fines were capped at GBP 500,000 — this is a massive increase

### TPS/CTPS Requirements

- **TPS (Telephone Preference Service):** Register of individuals who do not wish to receive unsolicited sales calls
- **CTPS (Corporate Telephone Preference Service):** Register of businesses that do not wish to receive unsolicited sales calls
- Must screen all call lists against TPS/CTPS **before calling**
- Calling a TPS-registered number without specific consent is a PECR breach

### UK GDPR

Applies to all personal data processing related to calls:
- Requires a **lawful basis** for processing (consent or legitimate interest)
- Legitimate interest can be used for B2B marketing calls — but you must conduct a **Legitimate Interest Assessment (LIA)** and document it
- Data subjects have the right to object to processing at any time
- Right to erasure — must delete call data on request
- Data Protection Impact Assessment (DPIA) required for high-risk processing (AI-driven calling at scale likely qualifies)

### Ofcom — Silent and Abandoned Calls

Ofcom regulates "persistent misuse" of telecoms networks:
- **Abandoned call rate** must not exceed **3%** of live calls answered over any 24-hour period
- An abandoned call is one where no live operator connects within 2 seconds of the called party answering
- **For AI voice agents:** The AI must begin speaking within 2 seconds of the call being answered, or it counts as an abandoned/silent call
- Penalty: up to **GBP 2 million** for persistent misuse

### ICO AI Guidance

The ICO has issued warnings to firms using automated voice systems that did not identify the caller as non-human. While not yet codified as a specific legal requirement, the ICO's position is clear: **disclose AI use in calls.**

---

## 8. European Union

### Regulatory Framework

| Regulation | Scope |
|------------|-------|
| **GDPR** (General Data Protection Regulation) | Data protection, consent, processing of personal data |
| **ePrivacy Directive** (2002/58/EC, as amended) | Electronic communications, marketing calls, cookies |
| **EU AI Act** (Regulation 2024/1689) | AI transparency, disclosure, risk classification |
| **National telecom laws** | Each EU member state implements the ePrivacy Directive with local variations |

### GDPR Requirements for Outbound Calling

**Lawful basis:** Every marketing call involves processing personal data (phone number, name, conversation content). You need one of:
- **Consent** (Article 6(1)(a)) — explicit, informed, freely given, specific, and withdrawable
- **Legitimate interest** (Article 6(1)(f)) — only for B2B contexts, and only after a balancing test showing your interest doesn't override the data subject's rights

**For B2C telemarketing:** Most EU member states require **explicit consent** under their national implementation of the ePrivacy Directive. Legitimate interest is generally not sufficient for unsolicited consumer calls.

**For B2B telemarketing:** Some member states allow legitimate interest as a basis — but the trend is toward requiring consent even for B2B.

**Data subject rights:**
- Right to object (Article 21) — must stop processing immediately when someone objects to direct marketing
- Right to erasure (Article 17) — delete their data on request
- Right to be informed (Articles 13-14) — must tell them what data you have, why, and how long you keep it

### ePrivacy Directive — Automated Calls

Article 13 of the ePrivacy Directive:
- **Automated calling systems** (which includes AI voice calls) require **prior consent** for direct marketing — this is not optional and cannot be overridden by legitimate interest
- Each member state implements this differently, but the consent requirement for automated calls is consistent across the EU

### EU AI Act — Transparency Obligations

The EU AI Act (entered into force August 1, 2024) introduces AI-specific requirements:

**Article 50 — Transparency obligations (enforceable August 2026):**

1. **Disclosure of AI interaction (Article 50(1)):** "Providers of AI systems that are intended to interact directly with natural persons shall design and develop the AI system in such a way that the natural persons concerned are informed that they are interacting with an AI system, unless this is obvious from the circumstances and the context of use."

2. **Synthetic voice content (Article 50(4)):** Deployers of AI systems that generate or manipulate audio content (including voice) that "appreciably resembles existing persons" must disclose that the content is AI-generated or manipulated.

**What this means for VoiceAygent:**
- From August 2026, it is a legal requirement under EU law to **disclose to the called party that they are speaking with an AI system**
- This disclosure must happen before meaningful interaction begins
- The AI voice itself may need to be labelled/watermarked as synthetic content
- The Code of Practice on marking and labelling AI-generated content is being finalised (draft published December 2025, final expected June 2026)

**Penalties under the EU AI Act:**
- Up to **EUR 35 million or 7% of global annual turnover** for the most serious violations
- Up to **EUR 15 million or 3% of global annual turnover** for transparency obligation violations (Article 50)

### Country-Specific Variations

| Country | Key Rule |
|---------|----------|
| **Germany** | Particularly strict — prior express consent required for all marketing calls. Federal Network Agency (BNetzA) actively enforces. Fines up to EUR 300,000 per violation. |
| **France** | Bloctel (DNC list) must be checked. CNIL enforces GDPR. Consent required for automated calls. |
| **Spain** | AEPD actively enforces. Robinson List (DNC) must be checked. |
| **Italy** | Registro delle Opposizioni (DNC) implemented 2022. Consent required for all marketing calls. Garante actively enforces. |
| **Netherlands** | Bel-me-niet Register (DNC). ACM enforces. Consent required. |

### Call Recording in the EU

- **GDPR requires a lawful basis** for recording calls — consent is the safest
- **Must inform the called party** before recording begins
- Recordings containing personal data are subject to all GDPR data subject rights (access, erasure, portability)
- **Data retention limits** — recordings must not be kept longer than necessary for the stated purpose

---

## 9. United Arab Emirates

### Regulatory Framework

| Regulator | Scope |
|-----------|-------|
| **TDRA** (Telecommunications and Digital Government Regulatory Authority) | Telecoms regulation, telemarketing licensing |
| **Ministry of Economy** | Consumer protection, business licensing |
| **DED / RERA** | Business licensing (for real estate specifically) |

### UAE Telemarketing Regulations (Cabinet Resolution 2024)

TDRA Decisions 56/2024 and 57/2024, enforced from August 27, 2024, represent the most comprehensive telemarketing regulation in the UAE:

**Licensing:**
- Companies **must obtain prior approval from TDRA** before engaging in any telemarketing activity
- Telemarketing operations must be registered with TDRA

**Call Hours:**
- Marketing calls permitted **9:00 AM to 6:00 PM only** (local time)
- This is significantly stricter than the US (8am-9pm) or UK

**Number Requirements:**
- All marketing calls must be made using **local UAE phone numbers** registered under the company's commercial licence
- International or virtual numbers are not permitted for outbound telemarketing to UAE recipients

**Call Frequency Limits:**
- Maximum **once per day** to any individual consumer
- Maximum **twice per week** if the call goes unanswered
- If a consumer rejects the product/service, the company **must not call them again**

**Script Pre-Approval:**
- Telemarketing scripts must be **pre-approved** by TDRA
- This could be complex for AI agents that generate dynamic scripts — the approved "script" may need to be the AI's prompt template or conversational boundaries

**Training:**
- Telemarketers must be trained on professional ethics and use of the Do Not Call Registry
- For AI agents: this requirement likely translates to demonstrable compliance programming and behavioural guardrails

### UAE Do Not Contact Register (DNCR)

- Managed by TDRA
- Consumers can register to avoid unsolicited marketing calls
- Companies are **prohibited from contacting consumers listed on the DNCR**
- Must check the DNCR before any outbound campaign

### UAE Personal Data Protection Law (PDPL)

Federal Decree-Law No. 45 of 2021 (effective January 2, 2022):
- Requires **consent** for processing personal data for direct marketing
- Data subjects have the right to withdraw consent at any time
- Right to erasure and data portability
- Cross-border data transfer restrictions apply

### Penalties

| Violation | Penalty |
|-----------|---------|
| First offence | Warning |
| Repeat offences (corporate) | **AED 10,000 to AED 150,000** in fines |
| Severe violations | License suspension or cancellation, removal from commercial register, termination of communications services |

### AI-Specific Considerations in the UAE

As of April 2026, the UAE does not have AI-specific telemarketing legislation equivalent to the FCC's ruling or the EU AI Act. However:
- The general telemarketing regulations apply equally to AI and human callers
- TDRA's script pre-approval requirement may create complexity for conversational AI that adapts in real-time
- The UAE is generally pro-innovation with AI, but consumer protection is enforced
- Dubai's AI strategy (Dubai Universal Blueprint for AI) encourages responsible AI deployment — transparency and disclosure are expected even if not yet legally mandated for telemarketing specifically

---

## 10. AI Disclosure Requirements -- All Jurisdictions

This is the single biggest compliance question for VoiceAygent: **must you tell people they are talking to AI?**

### Summary by Jurisdiction

| Jurisdiction | AI Disclosure Required? | Status | Penalty |
|-------------|------------------------|--------|---------|
| **US Federal (FCC)** | Proposed — disclosure within 30 seconds | NPRM pending (comments closed Jan 2026). Not yet final rule, but strongly signalled. | TBD (likely $500-$1,500/call) |
| **California** | **Yes** — AB 2905 effective Jan 1, 2025 | Active law | $500 per undisclosed AI call |
| **Colorado** | AI transparency disclosures (postponed to June 2026) | Pending | TBD |
| **Utah** | Must disclose AI use if consumer asks; regulated services must proactively disclose | Active law | TBD |
| **Illinois** | Disclosure law for AI interactions taking effect | Active | TBD |
| **UK (ICO)** | Not codified, but ICO has issued warnings to firms not disclosing | Regulatory guidance, not statute (yet) | Up to GBP 17.5M (PECR) |
| **EU (AI Act Article 50)** | **Yes** — must inform person they are interacting with AI | Enforceable **August 2026** | Up to EUR 15M or 3% global turnover |
| **UAE** | No specific AI disclosure law for telemarketing | No specific requirement (yet) | N/A |

### VoiceAygent's Position

**Disclose always, everywhere, at the start of every call.** This is not optional — it is the only defensible position:

1. It is already legally required in California (where a huge portion of US calls terminate)
2. It will be legally required EU-wide from August 2026
3. The FCC has signalled it will become federal US law
4. The UK ICO is actively warning companies that do not disclose
5. Non-disclosure is deceptive — if a consumer discovers they were tricked into thinking they spoke with a human, the reputational damage alone is catastrophic, and it could be used as evidence of willful TCPA violation (treble damages)
6. Disclosure builds trust and is better for conversion long-term

### Recommended Disclosure Script

At the start of every VoiceAygent call:

```
"Hi [Name], this is [Agent Name] from [Company]. I'm an AI assistant calling
on behalf of [Company]. This call may be recorded for quality purposes.
Is this a good time to talk?"
```

This covers:
- AI disclosure (all jurisdictions)
- Recording disclosure (two-party consent states, UK, EU)
- Caller identification (TCPA, UK PECR)
- Consent check (best practice)

---

## 11. Consent Management -- What VoiceAygent Must Store

VoiceAygent must maintain detailed, auditable consent records. In a TCPA class action, the burden of proof is on the caller to show they had valid consent.

### Required Consent Records

```sql
-- Consent record per contact per campaign
consent_records (
  id uuid PRIMARY KEY,
  contact_id uuid NOT NULL,
  phone_number text NOT NULL,           -- the consented number
  consent_type text NOT NULL,           -- 'PEWC' | 'prior_express' | 'opt_in'
  consent_source text NOT NULL,         -- 'web_form' | 'paper' | 'verbal' | 'sms_opt_in'
  consent_text text NOT NULL,           -- exact language the consumer agreed to
  consented_company text NOT NULL,      -- which company the consent names
  consented_to_ai_calls boolean,        -- explicit AI call consent (future-proofing)
  consented_to_recording boolean,       -- recording consent
  ip_address text,                      -- for web forms
  user_agent text,                      -- browser info for web forms
  form_url text,                        -- URL of the consent form
  timestamp timestamptz NOT NULL,       -- when consent was obtained
  evidence_type text,                   -- 'screenshot' | 'audio' | 'signed_document'
  evidence_url text,                    -- link to stored evidence
  revoked_at timestamptz,              -- when consent was revoked (null = active)
  revocation_method text,              -- 'verbal' | 'sms_stop' | 'email' | 'in_call'
  jurisdiction text,                    -- which jurisdiction's rules apply
  created_at timestamptz DEFAULT now()
)

-- DNC check log — proof you checked before calling
dnc_check_log (
  id uuid PRIMARY KEY,
  phone_number text NOT NULL,
  registry_checked text NOT NULL,       -- 'federal_dnc' | 'state_dnc' | 'internal_dnc' | 'tps' | 'ctps' | 'uae_dncr'
  check_timestamp timestamptz NOT NULL,
  result text NOT NULL,                 -- 'clear' | 'listed' | 'error'
  registry_data_date date,             -- when the registry data was last downloaded
  campaign_id uuid
)

-- Call attempt log — every call, whether answered or not
call_attempts (
  id uuid PRIMARY KEY,
  contact_id uuid NOT NULL,
  phone_number text NOT NULL,
  campaign_id uuid,
  consent_record_id uuid REFERENCES consent_records(id),
  called_at timestamptz NOT NULL,
  call_duration_seconds int,
  outcome text,                         -- 'answered' | 'voicemail' | 'no_answer' | 'busy' | 'rejected'
  ai_disclosure_played boolean,         -- was AI disclosure given?
  recording_disclosure_played boolean,  -- was recording disclosure given?
  opt_out_requested boolean,            -- did they ask to stop?
  caller_id_displayed text,             -- what caller ID was shown
  called_party_state text,              -- for state-level compliance
  called_party_country text,            -- for international compliance
  stir_shaken_attestation text,         -- 'A' | 'B' | 'C'
  recording_url text,                   -- if call was recorded
  transcript_url text                   -- AI call transcript
)

-- Opt-out / revocation log
opt_out_log (
  id uuid PRIMARY KEY,
  contact_id uuid NOT NULL,
  phone_number text NOT NULL,
  opt_out_method text NOT NULL,         -- 'verbal_during_call' | 'sms_stop' | 'email' | 'web_form' | 'dnc_registration'
  opt_out_timestamp timestamptz NOT NULL,
  processed_at timestamptz,             -- when the opt-out was processed in the system
  processing_deadline timestamptz,      -- 10 business days from request (FCC rule)
  channel_scope text,                   -- 'all' | 'calls_only' | 'sms_only'
  evidence_url text                     -- recording/transcript of opt-out request
)
```

### Retention Requirements

| Data | Minimum Retention | Reason |
|------|------------------|--------|
| Consent records | **5 years** after last call | TCPA statute of limitations is 4 years; keep 5 for safety |
| DNC check logs | **5 years** | Proof of safe-harbour compliance |
| Call attempt logs | **5 years** | Evidence in case of TCPA litigation |
| Opt-out records | **Indefinitely** | Must never call an opted-out number again; need the record forever |
| Call recordings | **Per stated purpose** — typically 90 days to 2 years | GDPR/UK GDPR: only as long as necessary. Longer if litigation hold |
| Transcripts | Same as recordings | Same rules apply |

---

## 12. Product Compliance Checklist

What VoiceAygent must build into the product to stay compliant:

### Pre-Call

- [ ] **Consent verification** — before placing any call, verify that a valid, non-revoked consent record exists for that phone number and that specific campaign/company
- [ ] **DNC registry check** — verify the number is not on the National DNC Registry (US), state DNC lists, TPS/CTPS (UK), DNCR (UAE), or national DNC equivalents (EU)
- [ ] **Internal DNC check** — verify the number is not on the company's internal do-not-call list
- [ ] **Calling hours enforcement** — verify the current time in the called party's timezone is within permitted hours (US: 8am-9pm, UAE: 9am-6pm, UK/EU: check local rules)
- [ ] **Frequency cap enforcement** — verify call frequency limits are not exceeded (UAE: max 1/day, 2/week)
- [ ] **State/country detection** — determine the jurisdiction of the called party for compliance rule selection
- [ ] **Budget/rate limit check** — ensure daily/hourly call limits are not exceeded (carrier rate limits, internal caps)

### During Call

- [ ] **AI disclosure** — within the first few seconds, disclose that the caller is an AI assistant (required: CA, EU from Aug 2026; best practice: everywhere)
- [ ] **Recording disclosure** — in two-party consent states and UK/EU, disclose that the call may be recorded
- [ ] **Caller identification** — identify the company name and callback number
- [ ] **Opt-out mechanism** — provide a way for the called party to opt out during the call (e.g., "Say 'stop' at any time to be removed from our call list")
- [ ] **Real-time opt-out processing** — if the person says "stop," "don't call me," "remove me," etc., the AI must acknowledge and end the call gracefully
- [ ] **Call timeout** — if no one answers, terminate after appropriate ring time (avoid silent/abandoned call violations)
- [ ] **Accurate caller ID** — display a valid, dialable callback number

### Post-Call

- [ ] **Log everything** — call time, duration, outcome, disclosures given, opt-out requests, consent record used
- [ ] **Process opt-outs** — add to internal DNC immediately; must complete within 10 business days (FCC)
- [ ] **Store recordings securely** — encrypted at rest, access-controlled, retention-limited
- [ ] **Update contact records** — mark contacts appropriately (opted out, do not call, callback requested, etc.)

### Administrative

- [ ] **TDRA registration** (UAE) — register as telemarketing operator before any UAE calling
- [ ] **DNC registry subscription** (US) — maintain active subscription, download at least every 31 days
- [ ] **TPS/CTPS subscription** (UK) — maintain active subscription
- [ ] **DPIA** (UK/EU) — complete a Data Protection Impact Assessment for the AI calling system
- [ ] **Legitimate Interest Assessment** (UK/EU, if using legitimate interest as lawful basis) — document the balancing test
- [ ] **Script pre-approval** (UAE) — submit AI conversation templates/boundaries to TDRA for approval
- [ ] **Record retention policy** — implement and enforce retention limits for all call data
- [ ] **Staff/system training** — ensure the AI system is programmed with all compliance rules; document this
- [ ] **Consent form review** — regularly audit that consent collection forms/processes meet current legal requirements
- [ ] **Regular compliance audit** — quarterly review of all the above

---

## Key Risks and Recommendations

### Highest-Risk Scenarios

1. **Calling California without AI disclosure** — $500/call, private right of action, easy to prove
2. **Calling without TCPA consent** — $500-$1,500/call, class action territory
3. **Calling DNC-listed numbers** — up to $51,744/violation (FTC) plus private action
4. **Recording in two-party consent states without disclosure** — criminal penalties in some states (Florida: up to 5 years)
5. **EU calls without GDPR-compliant consent after August 2026** — up to EUR 15M or 3% turnover for AI Act violations
6. **UAE calls outside 9am-6pm** — license suspension risk
7. **UK automated calls without consent post-PECR update** — up to GBP 17.5M (new 2025 penalty regime)

### Strategic Recommendations

1. **Default to consent-based calling everywhere.** Do not rely on exemptions (EBR, legitimate interest) as the primary basis — they are defences, not strategies.

2. **Build consent into the lead acquisition flow.** Every lead that enters VoiceAygent must come with a consent record attached. No consent = no call. Enforce this at the system level, not the operator level.

3. **Geo-fence aggressively.** Use phone number geolocation to apply the strictest applicable rules. When in doubt, apply California rules (the strictest US state) or EU rules (the strictest international framework).

4. **Disclose AI use on every call, everywhere, no exceptions.** This is already law in California and will be law in the EU by August 2026. The FCC is moving this direction federally. Get ahead of it now.

5. **Treat AI voice calls as robocalls for all compliance purposes.** The FCC has ruled this explicitly. Do not attempt to argue that conversational AI is "live" — that argument will lose in court and lose worse in public opinion.

6. **Invest in consent infrastructure before scaling.** The consent management system (Section 11) is not optional — it is the single most important compliance investment. Without it, every call is a potential $1,500 liability.

7. **Monitor regulatory developments actively.** The FCC's July 2024 NPRM is still pending. The EU AI Act Article 50 becomes enforceable in August 2026. Colorado's AI Act activates in June 2026. This is a fast-moving regulatory landscape.

---

## Sources

### US Federal
- [FCC Declaratory Ruling — AI-Generated Voices in Robocalls (Feb 2024)](https://www.fcc.gov/document/fcc-makes-ai-generated-voices-robocalls-illegal)
- [FCC Confirms TCPA Applies to AI Technologies](https://www.fcc.gov/document/fcc-confirms-tcpa-applies-ai-technologies-generate-human-voices)
- [FCC 24-17 Full Text](https://docs.fcc.gov/public/attachments/FCC-24-17A1.pdf)
- [Federal Register — AI in Robocalls NPRM (Sep 2024)](https://www.federalregister.gov/documents/2024/09/10/2024-19028/implications-of-artificial-intelligence-technologies-on-protecting-consumers-from-unwanted-robocalls)
- [FCC One-to-One Consent Rule Document](https://docs.fcc.gov/public/attachments/DOC-408396A1.pdf)
- [FCC STIR/SHAKEN — Combating Spoofed Robocalls](https://www.fcc.gov/call-authentication)
- [FTC — Do Not Call Registry FAQ](https://consumer.ftc.gov/national-do-not-call-registry-faqs)
- [FTC — Telemarketing Sales Rule Compliance](https://www.ftc.gov/business-guidance/resources/complying-telemarketing-sales-rule)

### US State Laws
- [Top Six TCPA/Robocall Developments 2024/2025 (NCLC)](https://library.nclc.org/article/top-six-tcparobocall-developments-20242025)
- [State AI Legislation 2026 Compliance (Kiteworks)](https://www.kiteworks.com/regulatory-compliance/state-ai-legislation-2026-compliance-data-governance/)
- [New California AI Laws Taking Effect 2026 (National Law Review)](https://natlawreview.com/article/new-california-ai-laws-taking-effect-2026)
- [State-by-State Call Recording Compliance for AI (Hostie)](https://hostie.ai/resources/state-by-state-call-recording-compliance-ai-virtual-hosts-2025)
- [Call Recording Laws by State 2026 (NextPhone)](https://www.getnextphone.com/blog/call-recording-laws-by-state)

### US Industry Guides
- [AI-Powered Robocalls in 2025: Guide to New Rules (Kixie)](https://www.kixie.com/sales-blog/ai-powered-robocalls-in-2025-a-guide-to-the-new-rules/)
- [AI Voice and TCPA: The 2026 Compliance Paradox (Bigly Sales)](https://biglysales.com/ai-outbound-calling-tcpa-compliance/)
- [FCC Regulations for AI-Generated Calls (AgentVoice)](https://www.agentvoice.com/fcc-regulations-for-ai-generated-calls/)
- [TCPA Compliance 2025 Full Guide (SecurePrivacy)](https://secureprivacy.ai/blog/telephone-consumer-protection-act-compliance-tcpa-2025-full-guide)
- [AI Voice Agents Face $1,500/Call TCPA Fines (Henson Legal)](https://www.henson-legal.com/ai-voice-compliance)

### UK
- [Laws Surrounding AI Cold Calling in the UK 2025 (Compare Telemarketing)](https://comparetelemarketing.co.uk/telemarketing-insigh/laws-surrounding-ai-cold-calling-in-the-uk-2025/)
- [Are AI Voice Agents Legal for Cold Calling in the UK? (DialShark)](https://dialshark.ai/blog/ai-voice-agents/are-ai-voice-agents-legal-for-cold-calling-in-the-uk-pecr-ico-explained/)
- [AI Cold Calling in the UK: Laws and Compliance (Neural Voice)](https://www.neural-voice.ai/blog/ai-cold-calling-uk-legal-guide)
- [UK Outbound Call Regulations 2025 (TALK-Q)](https://talk-q.com/outbound-call-regulations-in-uk)
- [Ofcom Strategic Approach to AI 2025/26](https://www.ofcom.org.uk/siteassets/resources/documents/about-ofcom/annual-reports/ofcoms-strategic-approach-to-ai-202526.pdf)

### EU
- [EU AI Act Article 50 — Transparency Obligations](https://artificialintelligenceact.eu/article/50/)
- [EU AI Act Compliance for Voice AI (Telnyx)](https://telnyx.com/resources/eu-ai-act)
- [AI Voice Agent GDPR Compliance Guide 2026 (Ainora)](https://ainora.lt/blog/ai-voice-agent-gdpr-compliance-guide)
- [AI Privacy Rules: GDPR, EU AI Act, US Law (Parloa)](https://www.parloa.com/blog/AI-privacy-2026/)
- [Voice AI Compliance 2026 Guide (Speechmatics)](https://www.speechmatics.com/company/articles-and-news/your-essential-guide-to-voice-ai-compliance-in-todays-digital-landscape)
- [Code of Practice on AI-Generated Content (EU Commission)](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)

### UAE
- [UAE Telemarketing Regulations 2024 — Compliance & Penalties (NR Doshi)](https://www.nrdoshi.ae/uae-implements-new-telemarketing-regulations-things-you-should-be-aware-about/)
- [UAE Tightens Telemarketing Regulations (Lexology)](https://www.lexology.com/library/detail.aspx?g=bebc2336-1f72-4aae-9c20-a806473b3a28)
- [Sales Calls in UAE: What's Changing 2025 (FreJun)](https://frejun.com/sales-calls-uae-whats-changing/)
- [Cabinet Resolution 2024 Concerning Telemarketing Regulations](https://uaelegislation.gov.ae/en/legislations/2519)
- [New Telemarketing Rules UAE: Fines and Enforcement (Legal500)](https://www.legal500.com/developments/thought-leadership/new-telemarketing-rules-and-regulations-in-the-uae-a-comprehensive-guide-to-fines-and-enforcement/)
- [UAE Telemarketing Regulations (Morgan Lewis)](https://www.morganlewis.com/blogs/sourcingatmorganlewis/2024/07/telemarketing-in-an-evolving-legal-landscape-uae-adopts-regulations-on-telemarketing-activities)

### Consent and One-to-One Rule
- [FCC's Final Rule Kills One-to-One Consent (Consumer Financial Services Law Monitor)](https://www.consumerfinancialserviceslawmonitor.com/2025/09/fccs-final-rule-on-consent-kills-one-to-one-consent-requirement/)
- [Understanding the FCC One-to-One Consent Rule Update (ActiveProspect)](https://activeprospect.com/blog/fcc-one-to-one-consent/)
- [FCC One-to-One Consent Rule Struck Down (Adams and Reese)](https://www.adamsandreese.com/insights/fcc-one-to-one-consent-rule-struck-down)
- [Using AI in Customer Service and Telemarketing: Legal Tips (CommLawGroup)](https://commlawgroup.com/2025/using-ai-in-customer-service-and-telemarketing-top-7-legal-tips/)

---

*This document is for product planning and compliance architecture purposes. It is not legal advice. VoiceAygent should retain telecommunications compliance counsel in each jurisdiction where it operates.*
