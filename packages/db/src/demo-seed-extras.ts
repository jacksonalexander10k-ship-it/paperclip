/**
 * Demo Seed Extras — adds WhatsApp threads, CEO Chat conversations,
 * pending/resolved approvals, tasks, and activity events.
 *
 * Run AFTER `pnpm seed:demo`:
 *   pnpm --filter @paperclipai/db exec tsx ../../tests/e2e/demo-seed-extras.ts
 */
import postgres from "postgres";
import { randomUUID } from "node:crypto";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://paperclip:paperclip@127.0.0.1:54329/paperclip";

const sql = postgres(DATABASE_URL, { max: 1 });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ago(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}
function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
function ts(d: Date) {
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Resolve IDs from the main seed
// ---------------------------------------------------------------------------
async function resolveIds() {
  const [company] = await sql`SELECT id FROM companies WHERE issue_prefix = 'DPP' LIMIT 1`;
  if (!company) throw new Error("Demo company not found. Run pnpm seed:demo first.");
  const companyId = company.id as string;

  const agentRows = await sql`SELECT id, name, role FROM agents WHERE company_id = ${companyId}`;
  const agentByName: Record<string, string> = {};
  for (const a of agentRows) agentByName[(a.name as string).toLowerCase()] = a.id as string;

  const ceoId = agentByName["khalid"];
  const salesId = agentByName["layla"];
  const contentId = agentByName["nour"];
  const marketId = agentByName["omar"];
  const viewingId = agentByName["sara"];

  if (!ceoId || !salesId) throw new Error("Could not resolve agent IDs. Ensure seed-demo ran.");

  // Find leads
  const leadRows = await sql`SELECT id, name, phone FROM aygent_leads WHERE company_id = ${companyId} ORDER BY created_at`;
  const leadByName: Record<string, { id: string; phone: string }> = {};
  for (const l of leadRows) leadByName[(l.name as string).toLowerCase()] = { id: l.id as string, phone: l.phone as string };

  // Find demo user
  const [demoUser] = await sql`SELECT id FROM "user" WHERE email = 'demo@aygencyworld.com' LIMIT 1`;
  const userId = demoUser?.id as string | undefined;

  return { companyId, ceoId, salesId, contentId, marketId, viewingId, leadByName, userId };
}

async function seed() {
  console.log("🌱 Seeding demo extras...\n");

  const { companyId, ceoId, salesId, contentId, marketId, viewingId, leadByName, userId } =
    await resolveIds();

  // Clean previous extras (idempotent)
  await sql`DELETE FROM aygent_whatsapp_messages WHERE company_id = ${companyId} AND message_id LIKE 'demoex-%'`;
  await sql`DELETE FROM issues WHERE company_id = ${companyId} AND title LIKE 'CEO Chat — %'`;
  // Keep "CEO Chat" main issue, only remove dated variants

  // =====================================================================
  // a) WhatsApp threads for 3 leads
  // =====================================================================
  const ahmed = leadByName["ahmed al hashimi"];
  const dmitri = leadByName["dmitri volkov"];
  const priya = leadByName["priya sharma"];
  // Maria Santos does not exist in the base seed — use a fallback
  const mariaSantos = { id: null, phone: "+971507654321" };

  const waMessages: Array<{
    agentId: string;
    leadId: string | null;
    chatJid: string;
    fromMe: boolean;
    senderName: string;
    senderPhone: string;
    content: string;
    timestamp: Date;
  }> = [];

  // Thread 1: Ahmed Al Hashimi — 8 messages over 3 days
  if (ahmed) {
    const jid = "971501234567@s.whatsapp.net";
    waMessages.push(
      { agentId: salesId, leadId: ahmed.id, chatJid: jid, fromMe: true, senderName: "Layla", senderPhone: "", content: "Assalamu alaikum Ahmed, this is Layla from Dubai Prestige Properties. Thank you for your interest in JVC properties. I have some excellent 2-bedroom options that match your budget. Would you like to see some options?", timestamp: daysAgo(3) },
      { agentId: salesId, leadId: ahmed.id, chatJid: jid, fromMe: false, senderName: "Ahmed Al Hashimi", senderPhone: "+971501234567", content: "Yes please, I'm looking for something around 1.2-1.5M AED. Corner unit preferred.", timestamp: new Date(daysAgo(3).getTime() + 45 * 60 * 1000) },
      { agentId: salesId, leadId: ahmed.id, chatJid: jid, fromMe: true, senderName: "Layla", senderPhone: "", content: "Great taste! I have a corner unit in Binghatti Hills, 1,050 sqft, AED 1.35M with a 60/40 payment plan. Handover Q2 2027. Shall I send the floor plans?", timestamp: new Date(daysAgo(3).getTime() + 90 * 60 * 1000) },
      { agentId: salesId, leadId: ahmed.id, chatJid: jid, fromMe: false, senderName: "Ahmed Al Hashimi", senderPhone: "+971501234567", content: "That sounds good. What about the service charges?", timestamp: daysAgo(2) },
      { agentId: salesId, leadId: ahmed.id, chatJid: jid, fromMe: true, senderName: "Layla", senderPhone: "", content: "Service charges are AED 14/sqft, so roughly AED 14,700 annually. Very competitive for JVC. The ROI is looking strong at around 7.8% based on current rental yields.", timestamp: new Date(daysAgo(2).getTime() + 30 * 60 * 1000) },
      { agentId: salesId, leadId: ahmed.id, chatJid: jid, fromMe: false, senderName: "Ahmed Al Hashimi", senderPhone: "+971501234567", content: "I'd like to visit. Can we arrange a viewing this Thursday?", timestamp: daysAgo(1) },
      { agentId: salesId, leadId: ahmed.id, chatJid: jid, fromMe: true, senderName: "Layla", senderPhone: "", content: "Absolutely! I've scheduled a viewing for Thursday at 3:00 PM. I'll send you the exact location and building access details closer to the date. Looking forward to meeting you!", timestamp: new Date(daysAgo(1).getTime() + 20 * 60 * 1000) },
      { agentId: salesId, leadId: ahmed.id, chatJid: jid, fromMe: false, senderName: "Ahmed Al Hashimi", senderPhone: "+971501234567", content: "Perfect, see you Thursday", timestamp: new Date(daysAgo(1).getTime() + 60 * 60 * 1000) },
    );
  }

  // Thread 2: Dmitri Volkov — 7 messages
  if (dmitri) {
    const jid = "971559876543@s.whatsapp.net";
    waMessages.push(
      { agentId: salesId, leadId: dmitri.id, chatJid: jid, fromMe: true, senderName: "Layla", senderPhone: "", content: "Здравствуйте Дмитрий, Layla from Dubai Prestige Properties. You inquired about investment properties in Dubai Marina. I have some excellent options for you.", timestamp: daysAgo(4) },
      { agentId: salesId, leadId: dmitri.id, chatJid: jid, fromMe: false, senderName: "Dmitri Volkov", senderPhone: "+971559876543", content: "Hello. Yes I am looking for 1BR for investment. What is best ROI area now?", timestamp: new Date(daysAgo(4).getTime() + 3 * 60 * 60 * 1000) },
      { agentId: salesId, leadId: dmitri.id, chatJid: jid, fromMe: true, senderName: "Layla", senderPhone: "", content: "For 1-bedroom investment, JVC and Business Bay are top performers. JVC yields 7-8% and Business Bay 6.5-7.5%. Starting prices from AED 750K in JVC.", timestamp: new Date(daysAgo(4).getTime() + 4 * 60 * 60 * 1000) },
      { agentId: salesId, leadId: dmitri.id, chatJid: jid, fromMe: false, senderName: "Dmitri Volkov", senderPhone: "+971559876543", content: "Business Bay is better location. What you have there?", timestamp: daysAgo(3) },
      { agentId: salesId, leadId: dmitri.id, chatJid: jid, fromMe: true, senderName: "Layla", senderPhone: "", content: "I have a 1BR in Paramount Tower, 680 sqft, AED 1.1M. Currently rented at AED 75K/year — that's 6.8% yield. Also a 1BR in SLS Residences, 720 sqft, AED 1.35M, newer building with hotel amenities.", timestamp: new Date(daysAgo(3).getTime() + 2 * 60 * 60 * 1000) },
      { agentId: salesId, leadId: dmitri.id, chatJid: jid, fromMe: false, senderName: "Dmitri Volkov", senderPhone: "+971559876543", content: "Send me details on Paramount one", timestamp: new Date(daysAgo(3).getTime() + 5 * 60 * 60 * 1000) },
      { agentId: salesId, leadId: dmitri.id, chatJid: jid, fromMe: true, senderName: "Layla", senderPhone: "", content: "Here are the details for Paramount Tower 1BR. The current tenant's lease expires in September if you want vacant possession, or you can keep the tenant for immediate rental income.", timestamp: daysAgo(2) },
    );
  }

  // Thread 3: Maria Santos (new lead not in base seed, use Priya as fallback if needed)
  {
    const jid = "971507654321@s.whatsapp.net";
    const leadId = mariaSantos.id ?? priya?.id ?? null;
    waMessages.push(
      { agentId: salesId, leadId, chatJid: jid, fromMe: true, senderName: "Layla", senderPhone: "", content: "Hi Maria! This is Layla from Dubai Prestige Properties. I saw you were browsing our JVC listings. How can I help you find your perfect home?", timestamp: daysAgo(2) },
      { agentId: salesId, leadId, chatJid: jid, fromMe: false, senderName: "Maria Santos", senderPhone: "+971507654321", content: "Hi Layla, yes I'm looking to rent a 2BR in JVC or Sports City area for my family. Budget around 80-90K per year.", timestamp: new Date(daysAgo(2).getTime() + 2 * 60 * 60 * 1000) },
      { agentId: salesId, leadId, chatJid: jid, fromMe: true, senderName: "Layla", senderPhone: "", content: "Great areas for families! I have a lovely 2BR in JVC Circle Mall area, 1,200 sqft, AED 82K/year with 4 cheques. Also one in Sports City near the canal, 1,100 sqft, AED 78K/year.", timestamp: new Date(daysAgo(2).getTime() + 3 * 60 * 60 * 1000) },
      { agentId: salesId, leadId, chatJid: jid, fromMe: false, senderName: "Maria Santos", senderPhone: "+971507654321", content: "The JVC one sounds nice. Is it furnished?", timestamp: daysAgo(1) },
      { agentId: salesId, leadId, chatJid: jid, fromMe: true, senderName: "Layla", senderPhone: "", content: "It's semi-furnished — kitchen appliances, curtains, and AC included. The building has a gym, pool, and kids play area. Shall I arrange a viewing?", timestamp: new Date(daysAgo(1).getTime() + 1 * 60 * 60 * 1000) },
      { agentId: salesId, leadId, chatJid: jid, fromMe: false, senderName: "Maria Santos", senderPhone: "+971507654321", content: "Let me discuss with my husband and get back to you", timestamp: new Date(daysAgo(1).getTime() + 4 * 60 * 60 * 1000) },
    );
  }

  for (const m of waMessages) {
    const msgId = `demoex-${randomUUID().slice(0, 12)}`;
    await sql`INSERT INTO aygent_whatsapp_messages (id, company_id, agent_id, lead_id, chat_jid, message_id, from_me, sender_name, sender_phone, content, status, timestamp)
              VALUES (${randomUUID()}, ${companyId}, ${m.agentId}, ${m.leadId}, ${m.chatJid}, ${msgId}, ${m.fromMe}, ${m.senderName}, ${m.senderPhone}, ${m.content}, 'read', ${ts(m.timestamp)})`;
  }
  console.log(`✓ ${waMessages.length} WhatsApp messages across 3 threads`);

  // =====================================================================
  // b) 5 CEO Chat conversations (separate issues)
  // =====================================================================
  const ceoChatIssues: Array<{
    title: string;
    comments: Array<{
      agentId: string | null;
      userId: string | null;
      body: string;
      toolCalls: unknown;
      time: Date;
    }>;
  }> = [];

  // 1. Campaign
  ceoChatIssues.push({
    title: "CEO Chat — 8 Apr",
    comments: [
      {
        agentId: null, userId: userId ?? "demo-owner",
        body: "Launch a Facebook campaign targeting cash buyers in JVC. AED 200/day for 2 weeks.",
        toolCalls: null, time: daysAgo(1),
      },
      {
        agentId: ceoId, userId: null,
        body: "Got it. I'm passing this to Aisha with all the details — JVC cash buyers, AED 200/day, 14 days. She'll have the creative and targeting ready for your approval in a few minutes.",
        toolCalls: null, time: new Date(daysAgo(1).getTime() + 30 * 1000),
      },
      {
        agentId: ceoId, userId: null,
        body: `Here's the campaign for your approval:

\`\`\`json
${JSON.stringify({
  type: "approval_required",
  action: "launch_fb_campaign",
  campaign_name: "JVC Cash Buyers — Off-Plan",
  objective: "Lead Generation",
  budget: "AED 200/day for 14 days (AED 2,800 total)",
  audience: "UAE residents, age 28-55, interests: real estate investment, Dubai property, cash buyers",
  placements: "Facebook + Instagram (automatic)",
  creative_type: "Carousel — 4 project images",
  headline: "JVC Off-Plan from AED 850K | Cash Buyer Exclusive",
  lead_form_fields: ["Full Name", "Phone", "Email", "Budget Range"],
  estimated_results: "20-50 leads over 14 days",
}, null, 2)}
\`\`\``,
        toolCalls: null, time: new Date(daysAgo(1).getTime() + 5 * 60 * 1000),
      },
    ],
  });

  // 2. Leads
  ceoChatIssues.push({
    title: "CEO Chat — 9 Apr",
    comments: [
      {
        agentId: ceoId, userId: null,
        body: `Good morning. 3 new leads came in overnight:

1. **Ahmed Al Hashimi** (Score 8) — Cash buyer, interested in JVC 2BR corner units. Budget AED 1.2-1.5M.
2. **Dmitri Volkov** (Score 7) — Russian investor, looking at Business Bay 1BR for rental yield.
3. **Maria Santos** (Score 6) — Family rental, JVC/Sports City 2BR.

I've prepared WhatsApp follow-up messages for Ahmed and Dmitri. Please review and approve.`,
        toolCalls: null, time: ago(8),
      },
      {
        agentId: ceoId, userId: null,
        body: `\`\`\`json
${JSON.stringify({
  type: "approval_required",
  action: "send_whatsapp",
  to: "Ahmed Al Hashimi",
  phone: "+971501234567",
  message: "Mr. Al Hashimi, good morning. Following your interest in JVC corner units — I have a new 2BR corner on the 18th floor at Binghatti Hills. AED 1.35M, 60/40 payment plan, handover Q2 2027. Would you like to view it Thursday?",
  lead_score: 8,
  context: "Hot lead, cash buyer. Previously asked about corner units and service charges.",
}, null, 2)}
\`\`\``,
        toolCalls: null, time: new Date(ago(8).getTime() + 60 * 1000),
      },
      {
        agentId: ceoId, userId: null,
        body: `\`\`\`json
${JSON.stringify({
  type: "approval_required",
  action: "send_whatsapp",
  to: "Dmitri Volkov",
  phone: "+971559876543",
  message: "Дмитрий, добрый день. Paramount Tower 1BR — AED 1.1M, текущая аренда AED 75K/год (6.8% доходность). Срок аренды до сентября. Готов обсудить условия.",
  lead_score: 7,
  context: "Russian investor. Interested in Business Bay 1BR for yield. Requested Paramount details.",
}, null, 2)}
\`\`\``,
        toolCalls: null, time: new Date(ago(8).getTime() + 2 * 60 * 1000),
      },
    ],
  });

  // 3. WhatsApp summary
  ceoChatIssues.push({
    title: "CEO Chat — 10 Apr",
    comments: [
      {
        agentId: ceoId, userId: null,
        body: `Layla handled 6 WhatsApp conversations overnight. Here's the summary:

✅ **Ahmed** — Viewing confirmed for Thursday 3PM. Very engaged.
✅ **Dmitri** — Interested in Paramount Tower 1BR. Sent details.
⏳ **Maria** — Discussing with husband. Will follow up in 2 days.
⏳ **Hassan** — No response yet to second message.
❌ **Tom** — Not interested, moved to cold.
✅ **Priya** — Asked about JVC studios, sent 3 options.`,
        toolCalls: null, time: ago(4),
      },
      {
        agentId: null, userId: userId ?? "demo-owner",
        body: "What did Ahmed say about the payment plan?",
        toolCalls: null, time: ago(3.5),
      },
      {
        agentId: ceoId, userId: null,
        body: `Searching WhatsApp history...

Ahmed asked about the corner unit in Binghatti Hills. He's specifically interested in the 60/40 payment plan and asked about service charges. Layla quoted AED 14/sqft. He confirmed a viewing for Thursday at 3PM.`,
        toolCalls: [{ id: "tc_wa_1", name: "search_whatsapp", startedAt: ts(ago(3.4)), completedAt: ts(new Date(ago(3.4).getTime() + 2000)) }],
        time: ago(3.3),
      },
      {
        agentId: null, userId: userId ?? "demo-owner",
        body: "Find anyone who mentioned Damac Lagoons",
        toolCalls: null, time: ago(3),
      },
      {
        agentId: ceoId, userId: null,
        body: `Found 2 mentions:

1. **Dmitri Volkov** (9 Apr) — Asked about Business Bay but we could redirect to Damac Lagoons as an alternative.
2. **Priya Sharma** (8 Apr) — Mentioned she visited the Damac Lagoons show villa last weekend and is comparing it with JVC options.`,
        toolCalls: [{ id: "tc_wa_2", name: "search_whatsapp", startedAt: ts(ago(2.9)), completedAt: ts(new Date(ago(2.9).getTime() + 2500)) }],
        time: ago(2.8),
      },
    ],
  });

  // 4. Research
  ceoChatIssues.push({
    title: "CEO Chat — 7 Apr",
    comments: [
      {
        agentId: null, userId: userId ?? "demo-owner",
        body: "What's the average price per sqft in JVC for 2-beds this quarter?",
        toolCalls: null, time: daysAgo(2),
      },
      {
        agentId: ceoId, userId: null,
        body: `Based on Q1 2026 DLD data:

| Metric | Value |
|--------|-------|
| Avg price/sqft | AED 1,180 |
| Median price | AED 1.25M |
| Transactions (Q1) | 847 |
| QoQ change | +4.2% |

JVC 2-bedrooms are holding strong. The sweet spot is AED 1.1M–1.4M for units between 1,000–1,200 sqft.`,
        toolCalls: [{ id: "tc_dld_1", name: "search_dld_transactions", startedAt: ts(new Date(daysAgo(2).getTime() + 5000)), completedAt: ts(new Date(daysAgo(2).getTime() + 8000)) }],
        time: new Date(daysAgo(2).getTime() + 30 * 1000),
      },
      {
        agentId: null, userId: userId ?? "demo-owner",
        body: "What about inventory under 1.2M?",
        toolCalls: null, time: new Date(daysAgo(2).getTime() + 5 * 60 * 1000),
      },
      {
        agentId: ceoId, userId: null,
        body: `I found 3 properties in your portfolio under AED 1.2M:

1. **Binghatti Hills 1BR+Study** — 820 sqft, AED 980K, handover Q4 2026
2. **JVC District 12 2BR** — 1,050 sqft, AED 1.15M, ready to move in
3. **Sports City 2BR** — 1,100 sqft, AED 1.18M, good for families`,
        toolCalls: [{ id: "tc_inv_1", name: "search_properties", startedAt: ts(new Date(daysAgo(2).getTime() + 5 * 60 * 1000 + 3000)), completedAt: ts(new Date(daysAgo(2).getTime() + 5 * 60 * 1000 + 6000)) }],
        time: new Date(daysAgo(2).getTime() + 6 * 60 * 1000),
      },
    ],
  });

  // 5. Morning brief
  ceoChatIssues.push({
    title: "CEO Chat — 6 Apr",
    comments: [
      {
        agentId: ceoId, userId: null,
        body: `Good morning! Here's your daily brief.

**Pipeline:** 15 active leads | 3 hot (score 8+) | 2 viewings today
**Budget:** AED 847 spent this month | 63% under your AED 2,500 cap
**Content:** 2 Instagram posts scheduled | 1 pending your approval
**WhatsApp:** 6 conversations handled overnight | 2 need your attention

**Top priority today:** Ahmed Al Hashimi (score 8, cash buyer) has a viewing Thursday. Confirm the time and prepare the unit details.

**Action items:**
- Approve the WhatsApp follow-ups I've drafted
- Review Aisha's Instagram carousel for JVC
- Dmitri wants Paramount Tower details — verify pricing is current`,
        toolCalls: null, time: daysAgo(3),
      },
    ],
  });

  for (const issue of ceoChatIssues) {
    const issueId = randomUUID();
    await sql`INSERT INTO issues (id, company_id, title, status, priority, assignee_agent_id, created_at, updated_at)
              VALUES (${issueId}, ${companyId}, ${issue.title}, 'in_progress', 'high', ${ceoId}, ${ts(issue.comments[0]!.time)}, ${ts(issue.comments[issue.comments.length - 1]!.time)})`;
    for (const c of issue.comments) {
      const commentTs = ts(c.time);
      await sql`INSERT INTO issue_comments (id, company_id, issue_id, body, author_agent_id, author_user_id, tool_calls, created_at, updated_at)
                VALUES (${randomUUID()}, ${companyId}, ${issueId}, ${c.body}, ${c.agentId}, ${c.userId}, ${c.toolCalls ? JSON.stringify(c.toolCalls) : null}, ${commentTs}, ${commentTs})`;
    }
  }
  console.log(`✓ 5 CEO Chat conversations with ${ceoChatIssues.reduce((s, i) => s + i.comments.length, 0)} comments`);

  // =====================================================================
  // c) 4 pending approvals (in addition to base seed's 4)
  // =====================================================================
  const extraApprovals = [
    {
      type: "post_instagram",
      agentId: contentId,
      payload: {
        type: "approval_required",
        action: "post_to_instagram",
        caption: "JVC Market Update Q1 2026\n\nAverage prices up 4.2% this quarter. 2BR sweet spot: AED 1.1M-1.4M.\n847 transactions in Q1 alone.\n\nJVC remains the #1 investment area for mid-range buyers.\n\n#JVC #DubaiRealEstate #MarketUpdate #Q12026 #DubaiOffPlan",
        imageUrl: "https://placehold.co/1080x1080/0d9488/white?text=JVC+Market+Update",
        mediaType: "feed",
      },
    },
    {
      type: "send_whatsapp",
      agentId: salesId,
      payload: {
        type: "approval_required",
        action: "send_whatsapp",
        to: "Ali Hassan",
        phone: "+971507890123",
        message: "Mr. Hassan, good afternoon. We have new studios available in JVC starting from AED 520K with a 50/50 payment plan. Given your interest in the area, I thought you might like to explore these options. Shall I send you the brochure?",
        lead_score: 4,
        context: "Warm lead from Facebook ad. Budget AED 500-800K. Last contact 8 days ago.",
      },
    },
    {
      type: "send_email",
      agentId: salesId,
      payload: {
        type: "approval_required",
        action: "send_email",
        to: "Maria Santos",
        email: "maria.santos@email.com",
        subject: "JVC 2BR Viewing — Availability This Week",
        body: "Dear Maria,\n\nThank you for your interest in the JVC 2BR apartment (1,200 sqft, AED 82K/year). The unit is still available and I'd love to arrange a viewing for you.\n\nWould Tuesday or Wednesday afternoon work for you? The building is near Circle Mall with easy access to Al Khail Road.\n\nBest regards,\nLayla\nDubai Prestige Properties",
        context: "Rental lead. Interested in JVC 2BR. Discussing with husband.",
      },
    },
    {
      type: "approve_plan",
      agentId: contentId,
      payload: {
        type: "approval_required",
        action: "approve_plan",
        plan: "Increase JVC campaign budget",
        description: "The JVC Cash Buyers campaign is performing well — CPL AED 18 (target was AED 35). Recommend increasing daily budget from AED 200 to AED 300 for the remaining 10 days to capitalize on the momentum.",
        current_budget: "AED 200/day",
        proposed_budget: "AED 300/day",
        justification: "CPL 49% below target. Estimated additional 15-20 leads at current conversion rate.",
      },
    },
  ];

  for (const a of extraApprovals) {
    await sql`INSERT INTO approvals (id, company_id, type, requested_by_agent_id, status, payload, created_at, updated_at)
              VALUES (${randomUUID()}, ${companyId}, ${a.type}, ${a.agentId}, 'pending', ${JSON.stringify(a.payload)}, ${ts(ago(2))}, ${ts(ago(2))})`;
  }
  console.log("✓ 4 extra pending approvals");

  // =====================================================================
  // d) 3 resolved approvals
  // =====================================================================
  const resolvedApprovals = [
    {
      type: "send_whatsapp",
      agentId: salesId,
      payload: {
        type: "approval_required",
        action: "send_whatsapp",
        to: "Anna Ivanova",
        phone: "+971558901234",
        message: "Анна, добрый день. Цены на 1BR в JVC обновлены — от AED 740K. ROI до 8.1%. Актуально для вас?",
        lead_score: 7,
      },
    },
    {
      type: "post_instagram",
      agentId: contentId,
      payload: {
        type: "approval_required",
        action: "post_to_instagram",
        caption: "Binghatti Hills JVC — 1BR from AED 850K | 60/40 payment plan | Q3 2026 handover.\n\nCorner units available. DM for floor plans.\n\n#BinghattiHills #JVC #DubaiOffPlan",
      },
    },
    {
      type: "send_whatsapp",
      agentId: salesId,
      payload: {
        type: "approval_required",
        action: "send_whatsapp",
        to: "Michael Brown",
        phone: "+971509012345",
        message: "Michael, good morning. Creek Rise 2BR (1,100 sqft) — AED 2.2M with full creek view from floor 15+. Handover Q4 2027. Would you like to schedule a viewing this week?",
        lead_score: 6,
      },
    },
  ];

  for (const a of resolvedApprovals) {
    const resolvedAt = ts(daysAgo(1));
    await sql`INSERT INTO approvals (id, company_id, type, requested_by_agent_id, status, payload, decided_by_user_id, decided_at, created_at, updated_at)
              VALUES (${randomUUID()}, ${companyId}, ${a.type}, ${a.agentId}, 'approved', ${JSON.stringify(a.payload)}, ${userId ?? 'demo-owner'}, ${resolvedAt}, ${ts(daysAgo(2))}, ${resolvedAt})`;
  }
  console.log("✓ 3 resolved approvals");

  // =====================================================================
  // e) 3 assigned tasks
  // =====================================================================
  const tasks = [
    {
      title: "Follow up with hot leads — Ahmed, Dmitri, Hassan",
      status: "in_progress",
      assigneeAgentId: salesId,
      priority: "high",
    },
    {
      title: "Generate Instagram carousel — JVC Q1 Market Update",
      status: "in_progress",
      assigneeAgentId: contentId,
      priority: "medium",
    },
    {
      title: "Q1 DLD Transaction Analysis — JVC, Business Bay, Marina",
      status: "done",
      assigneeAgentId: marketId,
      priority: "medium",
    },
  ];

  for (const t of tasks) {
    await sql`INSERT INTO issues (id, company_id, title, status, priority, assignee_agent_id, created_at, updated_at)
              VALUES (${randomUUID()}, ${companyId}, ${t.title}, ${t.status}, ${t.priority}, ${t.assigneeAgentId}, ${ts(daysAgo(2))}, ${ts(ago(4))})`;
  }
  console.log("✓ 3 assigned tasks");

  // =====================================================================
  // f) Activity events
  // =====================================================================
  const activities = [
    { actorType: "agent", actorId: salesId, action: "send_whatsapp", entityType: "lead", entityId: ahmed?.id ?? "unknown", agentId: salesId, details: { to: "Ahmed Al Hashimi", status: "sent" }, time: ago(1) },
    { actorType: "agent", actorId: salesId, action: "send_whatsapp", entityType: "lead", entityId: dmitri?.id ?? "unknown", agentId: salesId, details: { to: "Dmitri Volkov", status: "sent" }, time: ago(2) },
    { actorType: "agent", actorId: contentId, action: "generate_content", entityType: "content", entityId: randomUUID(), agentId: contentId, details: { type: "instagram_carousel", topic: "JVC Q1 Market Update" }, time: ago(3) },
    { actorType: "agent", actorId: marketId, action: "complete_analysis", entityType: "report", entityId: randomUUID(), agentId: marketId, details: { type: "DLD Q1 analysis", areas: ["JVC", "Business Bay", "Marina"] }, time: ago(5) },
    { actorType: "agent", actorId: ceoId, action: "morning_brief", entityType: "brief", entityId: randomUUID(), agentId: ceoId, details: { leads: 15, hot: 3, viewings: 2 }, time: ago(6) },
    { actorType: "system", actorId: "webhook-receiver", action: "process_leads", entityType: "leads", entityId: randomUUID(), agentId: null, details: { source: "Property Finder", count: 3 }, time: ago(7) },
    { actorType: "agent", actorId: salesId, action: "schedule_viewing", entityType: "viewing", entityId: randomUUID(), agentId: salesId, details: { lead: "Ahmed Al Hashimi", time: "Thursday 3PM", property: "Binghatti Hills" }, time: ago(8) },
    { actorType: "agent", actorId: contentId, action: "draft_campaign", entityType: "campaign", entityId: randomUUID(), agentId: contentId, details: { name: "JVC Cash Buyers", budget: "AED 200/day" }, time: ago(10) },
  ];

  for (const a of activities) {
    await sql`INSERT INTO activity_log (id, company_id, actor_type, actor_id, action, entity_type, entity_id, agent_id, details, created_at)
              VALUES (${randomUUID()}, ${companyId}, ${a.actorType}, ${a.actorId}, ${a.action}, ${a.entityType}, ${a.entityId}, ${a.agentId}, ${JSON.stringify(a.details)}, ${ts(a.time)})`;
  }
  console.log("✓ 8 activity events");

  // =====================================================================
  // Done
  // =====================================================================
  console.log("\n✅ Demo extras seeded successfully!");
  console.log(`   WhatsApp threads: 3 (${waMessages.length} messages)`);
  console.log(`   CEO Chat conversations: 5`);
  console.log(`   Extra pending approvals: 4`);
  console.log(`   Resolved approvals: 3`);
  console.log(`   Assigned tasks: 3`);
  console.log(`   Activity events: 8\n`);

  await sql.end();
}

seed().catch((err) => {
  console.error("Demo extras seed failed:", err);
  process.exit(1);
});
