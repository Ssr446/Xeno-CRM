import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3002;
const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL || 'http://localhost:3001/api/webhooks/channel';

// Receive send requests from the CRM
app.post('/send', (req, res) => {
  const { campaignId, communications } = req.body;
  
  if (!campaignId || !communications) {
    return res.status(400).json({ error: 'campaignId and communications are required' });
  }

  // Acknowledge receipt immediately
  res.status(202).json({ message: `Queued ${communications.length} messages for sending.` });

  // Simulate asynchronous delivery process
  communications.forEach((comm: any, index: number) => {
    // Stagger delivery to simulate reality
    setTimeout(() => {
      // 90% chance of DELIVERED, 10% FAILED
      const isDelivered = Math.random() > 0.1;
      const initialStatus = isDelivered ? 'DELIVERED' : 'FAILED';
      
      sendStatusWebhook(comm.id, campaignId, comm.customerId, initialStatus);

      // If delivered, simulate later opens and clicks
      if (isDelivered) {
        // 40% chance of being OPENED after another 1-5 seconds
        if (Math.random() > 0.6) {
          setTimeout(() => {
            sendStatusWebhook(comm.id, campaignId, comm.customerId, 'OPENED');
            
            // If opened, 20% chance of being CLICKED
            if (Math.random() > 0.8) {
              setTimeout(() => {
                sendStatusWebhook(comm.id, campaignId, comm.customerId, 'CLICKED');
              }, Math.random() * 3000 + 1000);
            }
          }, Math.random() * 4000 + 1000);
        }
      }
    }, Math.random() * 2000 + 500 * index);
  });
});

async function sendStatusWebhook(communicationId: string, campaignId: string, customerId: string, status: string) {
  try {
    await fetch(CRM_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        communicationId,
        campaignId,
        customerId,
        status,
        timestamp: new Date().toISOString()
      })
    });
    console.log(`[Webhook] Sent ${status} for comm ${communicationId}`);
  } catch (err) {
    console.error(`[Webhook] Failed to send webhook for comm ${communicationId}:`, err);
  }
}

app.listen(PORT, () => {
  console.log(`Channel Mock Service listening on port ${PORT}`);
});
