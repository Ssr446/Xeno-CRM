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
CRITICAL RULE: DO NOT USE JOINs. DO NOT reference any tables other than Customer. If you cannot fulfill the prompt perfectly with the available columns, do your best using totalSpent or lastVisit.
Ensure the JSON is strictly valid without markdown blocks.`;

    let data;
    for (let attempts = 0; attempts < 3; attempts++) {
      const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        })
      });
      
      data = await response.json();
      if (!data.error || !data.error.message.includes("high demand")) {
        break; // Success or a different non-retryable error
      }
      console.log(`High demand hit. Retrying attempt ${attempts + 1}...`);
      await new Promise(res => setTimeout(res, 1500)); // wait 1.5 seconds before retrying
    }

    if (data.error) throw new Error(data.error.message);

    const resultText = data.choices[0].message.content;
    const result = JSON.parse(resultText);

    // Run the generated SQL query safely
    let audience;
    try {
      const rawQuery = `SELECT id FROM Customer WHERE ${result.sqlCondition || '1=1'} LIMIT 1000;`;
      audience = await prisma.$queryRawUnsafe<{id: string}[]>(rawQuery);
    } catch (sqlErr) {
      console.warn("AI generated invalid SQL, falling back to all customers", sqlErr);
      audience = await prisma.$queryRawUnsafe<{id: string}[]>(`SELECT id FROM Customer LIMIT 1000;`);
    }

    return res.json({
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

// --- CAMPAIGN EXECUTION ---
app.post('/api/campaign/execute', async (req, res) => {
  const { name, messageContent, channel, audienceIds } = req.body;
  if (!messageContent || !audienceIds || !Array.isArray(audienceIds)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Create the Campaign
    const campaign = await prisma.campaign.create({
      data: {
        name: name || `Campaign ${new Date().toISOString()}`,
        messageContent,
        channel: channel || 'EMAIL',
        audienceSize: audienceIds.length,
        status: 'SENDING'
      }
    });

    // 2. Create CommunicationLogs (PENDING)
    const logsData = audienceIds.map(customerId => ({
      campaignId: campaign.id,
      customerId,
      status: 'PENDING'
    }));
    await prisma.communicationLog.createMany({ data: logsData });

    // 3. Fetch created logs to send to Channel Service
    const logs = await prisma.communicationLog.findMany({
      where: { campaignId: campaign.id }
    });

    const communications = logs.map(l => ({
      id: l.id,
      customerId: l.customerId,
      message: messageContent
    }));

    // 4. Send to Stubbed Channel Service
    const channelServiceUrl = process.env.CHANNEL_SERVICE_URL || 'http://localhost:3002';
    fetch(`${channelServiceUrl}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaign.id,
        communications
      })
    }).catch(err => console.error("Failed to notify channel service", err));

    res.json({ success: true, campaignId: campaign.id });

  } catch (err: any) {
    console.error("Execute Error:", err);
    res.status(500).json({ error: 'Failed to execute campaign' });
  }
});

// --- WEBHOOK RECEIVER ---
app.post('/api/webhooks/channel', async (req, res) => {
  const { communicationId, status } = req.body;
  if (!communicationId || !status) return res.status(400).json({ error: 'Invalid webhook payload' });

  try {
    await prisma.communicationLog.update({
      where: { id: communicationId },
      data: { status, timestamp: new Date() }
    });
    
    // Check if campaign is completed (all not PENDING)
    // For a real app, this might be a cron job. Here we ignore for brevity.
    
    res.json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// --- CAMPAIGN INSIGHTS ---
app.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        communications: true
      }
    });

    const formatted = campaigns.map(c => {
      const stats = c.communications.reduce((acc, log) => {
        acc[log.status] = (acc[log.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        audienceSize: c.audienceSize,
        channel: c.channel,
        stats
      };
    });

    res.json({ success: true, campaigns: formatted });
  } catch (err) {
    console.error("Campaign fetch error:", err);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

app.listen(PORT, () => {
  console.log(`CRM Backend API listening on port ${PORT}`);
});
