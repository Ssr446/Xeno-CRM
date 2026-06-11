import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const CHANNEL_SERVICE_URL = process.env.CHANNEL_SERVICE_URL || 'http://localhost:3002';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 1. Fetch Customers with optional filtering
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      take: 100, // Limit for UI performance
      orderBy: { createdAt: 'desc' }
    });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// 2. Fetch Campaigns
app.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { communications: true }
        }
      }
    });
    
    // Aggregate stats
    const enhancedCampaigns = await Promise.all(campaigns.map(async (camp) => {
      const stats = await prisma.communicationLog.groupBy({
        by: ['status'],
        where: { campaignId: camp.id },
        _count: true
      });
      
      const statsMap = stats.reduce((acc, curr) => {
        acc[curr.status] = curr._count;
        return acc;
      }, {} as Record<string, number>);
      
      return { ...camp, stats: statsMap };
    }));
    
    res.json(enhancedCampaigns);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// 3. Create Campaign and Dispatch
app.post('/api/campaigns/send', async (req, res) => {
  const { name, messageContent, channel, audienceIds } = req.body;
  
  if (!name || !messageContent || !audienceIds || !audienceIds.length) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Create Campaign
    const campaign = await prisma.campaign.create({
      data: {
        name,
        messageContent,
        channel,
        audienceSize: audienceIds.length,
        status: 'SENDING'
      }
    });

    // Create pending communication logs
    const commsData = audienceIds.map((customerId: string) => ({
      campaignId: campaign.id,
      customerId,
      status: 'PENDING'
    }));
    
    // We need to create them and get their IDs to send to the channel service.
    // SQLite doesn't support createManyAndReturn, so we insert one by one or createMany then fetch.
    // Since it's a mock, we'll insert individually inside a transaction to get the IDs back.
    const createdComms = await prisma.$transaction(
      commsData.map((data: any) => prisma.communicationLog.create({ data }))
    );

    // Call Mock Channel Service
    fetch(`${CHANNEL_SERVICE_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaign.id,
        communications: createdComms.map((c: any) => ({ id: c.id, customerId: c.customerId }))
      })
    }).catch(err => console.error("Failed to call channel service:", err));

    res.json({ success: true, campaign });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to launch campaign' });
  }
});

// 4. Webhook to receive delivery receipts
app.post('/api/webhooks/channel', async (req, res) => {
  const { communicationId, status } = req.body;
  
  if (!communicationId || !status) {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  try {
    await prisma.communicationLog.update({
      where: { id: communicationId },
      data: { status }
    });
    
    // Check if campaign is completely done (no PENDING/SENT left)
    // Optional logic to mark campaign as COMPLETED
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Webhook processing failed:", err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// 5. AI Chat Assistant
app.post('/api/chat', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    const systemPrompt = `You are an AI assistant for a retail CRM. The marketer will give you a goal.
You need to return a JSON object with:
1. "audienceFilter": A simplified explanation of who this targets (e.g., "Customers who spent > $500").
2. "messageDraft": A drafted message based on the marketer's request.
3. "channel": "SMS" or "Email".
4. "sqlCondition": A raw SQLite WHERE clause to filter the "Customer" table.
Available Customer columns: id, name, email, phone, totalSpent, lastVisit, createdAt.
Example sqlCondition: "totalSpent > 500 AND lastVisit < date('now', '-6 months')"
Ensure the JSON is strictly valid without markdown blocks.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const resultText = data.candidates[0].content.parts[0].text;
    const result = JSON.parse(resultText);

    // Run the generated SQL query safely (it's a mock, so we accept the injection risk for the assignment, 
    // but in reality we would use an LLM-to-Prisma structured output or read-only replica).
    const rawQuery = `SELECT id FROM Customer WHERE ${result.sqlCondition || '1=1'} LIMIT 1000;`;
    const audience = await prisma.$queryRawUnsafe<{id: string}[]>(rawQuery);

    res.json({
      success: true,
      preview: {
        audienceFilter: result.audienceFilter,
        messageDraft: result.messageDraft,
        channel: result.channel,
        audienceSize: audience.length,
        audienceIds: audience.map(a => a.id)
      }
    });

  } catch (err: any) {
    console.error("AI Error:", err);
    res.status(500).json({ error: 'AI processing failed: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`CRM Backend API listening on port ${PORT}`);
});
