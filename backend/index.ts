import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import PQueue from 'p-queue';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const queue = new PQueue({ concurrency: 5 });

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

// 5. Multi-Agent AI Workflow
app.post('/api/chat', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    // --- AGENT 1: Data Analyst (Strict SQL Generation) ---
    const analystPrompt = `You are an AI Data Analyst for a retail CRM. The marketer will give you a goal: "${prompt}"
You must return a JSON object with:
1. "audienceFilter": A simplified explanation of who this targets (e.g., "Customers who spent > $500").
2. "channel": "SMS" or "Email".
3. "sqlCondition": A raw SQLite WHERE clause to filter the "Customer" table.
Available Customer columns: id, name, email, phone, totalSpent, lastVisit, createdAt.
Example sqlCondition: "totalSpent > 500 AND lastVisit < date('now', '-6 months')"
CRITICAL RULE: DO NOT USE JOINs. ONLY return JSON.`;

    let analystData;
    for (let attempts = 0; attempts < 3; attempts++) {
      const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "system", content: analystPrompt }],
          response_format: { type: "json_object" }
        })
      });
      analystData = await response.json();
      if (!analystData.error) break;
      await new Promise(res => setTimeout(res, 1000));
    }
    if (analystData.error) throw new Error(analystData.error.message);

    const analystResult = JSON.parse(analystData.choices[0].message.content);

    // --- EXECUTE SQL ---
    let audience;
    try {
      const rawQuery = `SELECT id FROM Customer WHERE ${analystResult.sqlCondition || '1=1'} LIMIT 1000;`;
      audience = await prisma.$queryRawUnsafe<{id: string}[]>(rawQuery);
    } catch (sqlErr) {
      console.warn("Agent 1 generated invalid SQL, falling back to all customers", sqlErr);
      audience = await prisma.$queryRawUnsafe<{id: string}[]>(`SELECT id FROM Customer LIMIT 1000;`);
    }

    // --- AGENT 2: Brand Copywriter (Generates Message) ---
    const copywriterPrompt = `You are an expert Brand Copywriter. You need to write a personalized message for a retail campaign.
The marketer's goal: "${prompt}"
The target audience: ${analystResult.audienceFilter}
The channel: ${analystResult.channel}
Return a JSON object with ONLY:
1. "messageDraft": The drafted message text. Keep it concise, engaging, and suitable for the channel.`;

    let copywriterData;
    for (let attempts = 0; attempts < 3; attempts++) {
      const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "system", content: copywriterPrompt }],
          response_format: { type: "json_object" }
        })
      });
      copywriterData = await response.json();
      if (!copywriterData.error) break;
      await new Promise(res => setTimeout(res, 1000));
    }
    if (copywriterData.error) throw new Error(copywriterData.error.message);

    const copywriterResult = JSON.parse(copywriterData.choices[0].message.content);

    return res.json({
      success: true,
      preview: {
        audienceFilter: analystResult.audienceFilter,
        messageDraft: copywriterResult.messageDraft,
        channel: analystResult.channel,
        audienceSize: audience.length,
        audienceIds: audience.map(a => a.id)
      }
    });

  } catch (err: any) {
    console.error("AI Pipeline Error:", err);
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

    // 4. Queue the dispatch job using p-queue instead of direct unthrottled fetch
    queue.add(async () => {
      const channelServiceUrl = process.env.CHANNEL_SERVICE_URL || 'http://localhost:3002';
      try {
        await fetch(`${channelServiceUrl}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: campaign.id,
            communications
          })
        });
        console.log(`Dispatched batch to channel service for campaign ${campaign.id}`);
      } catch (err) {
        console.error("Failed to notify channel service", err);
      }
    });

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
    
    // Emit real-time WebSocket event
    io.emit('campaign_update', { communicationId, status });
    
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

server.listen(PORT, () => {
  console.log(`CRM Backend API & WebSocket listening on port ${PORT}`);
});
