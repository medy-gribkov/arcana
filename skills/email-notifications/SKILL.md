---
name: email-notifications
description: Design reliable email systems. Transactional and marketing emails, deliverability, bounce handling, templates, queue processing, testing strategies.
user-invokable: true
---

# Email Notifications

Build production-ready email systems with proper deliverability, bounce handling, and template management.

## Core Integration Patterns

### SendGrid Setup

```typescript
// BAD: API key in code, no error handling
import sgMail from '@sendgrid/mail';
sgMail.setApiKey('SG.abc123...');
await sgMail.send({
  to: user.email,
  from: 'noreply@example.com',
  subject: 'Welcome',
  html: '<h1>Welcome!</h1>'
});
```

```typescript
// GOOD: Environment-based config, typed responses
import sgMail from '@sendgrid/mail';
import { z } from 'zod';

const EmailConfig = z.object({
  apiKey: z.string().min(1),
  fromEmail: z.string().email(),
  fromName: z.string(),
  replyTo: z.string().email().optional(),
});

class SendGridClient {
  constructor(private config: z.infer<typeof EmailConfig>) {
    sgMail.setApiKey(config.apiKey);
  }

  async send(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    category?: string;
  }): Promise<{ messageId: string }> {
    const msg = {
      to: params.to,
      from: {
        email: this.config.fromEmail,
        name: this.config.fromName,
      },
      replyTo: this.config.replyTo,
      subject: params.subject,
      html: params.html,
      text: params.text || this.stripHtml(params.html),
      categories: params.category ? [params.category] : undefined,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
      },
    };

    const [response] = await sgMail.send(msg);
    return { messageId: response.headers['x-message-id'] };
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }
}
```

### AWS SES Setup

```typescript
// BAD: No credential management, missing deliverability headers
import { SES } from '@aws-sdk/client-ses';
const ses = new SES({});
await ses.sendEmail({
  Source: 'noreply@example.com',
  Destination: { ToAddresses: [email] },
  Message: {
    Subject: { Data: subject },
    Body: { Html: { Data: html } }
  }
});
```

```typescript
// GOOD: Proper AWS SDK setup, configuration sets, message tags
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { SendEmailCommandInput } from '@aws-sdk/client-ses';

class SESEmailClient {
  private client: SESClient;

  constructor(
    private config: {
      region: string;
      configurationSetName: string;
      fromEmail: string;
      fromName: string;
    }
  ) {
    this.client = new SESClient({ region: config.region });
  }

  async send(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
    tags?: Record<string, string>;
  }): Promise<{ messageId: string }> {
    const input: SendEmailCommandInput = {
      Source: `${this.config.fromName} <${this.config.fromEmail}>`,
      Destination: { ToAddresses: [params.to] },
      Message: {
        Subject: { Data: params.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: params.html, Charset: 'UTF-8' },
          Text: { Data: params.text, Charset: 'UTF-8' },
        },
      },
      ConfigurationSetName: this.config.configurationSetName,
      Tags: params.tags
        ? Object.entries(params.tags).map(([Name, Value]) => ({ Name, Value }))
        : undefined,
    };

    const command = new SendEmailCommand(input);
    const response = await this.client.send(command);
    return { messageId: response.MessageId! };
  }
}
```

## Email Templates

### React Email (Recommended)

```typescript
// BAD: String concatenation, no preview, hard to maintain
const html = `
  <html>
    <body>
      <h1>Welcome ${user.name}!</h1>
      <p>Click here: <a href="${verifyUrl}">Verify</a></p>
    </body>
  </html>
`;
```

```typescript
// GOOD: React Email components, type-safe, previewable
// emails/WelcomeEmail.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface WelcomeEmailProps {
  userName: string;
  verifyUrl: string;
}

export function WelcomeEmail({ userName, verifyUrl }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to our platform, {userName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome, {userName}!</Heading>
          <Text style={text}>
            We're excited to have you on board. Click the button below to verify
            your email address and get started.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={verifyUrl}>
              Verify Email
            </Button>
          </Section>
          <Text style={footer}>
            If you didn't create this account, you can safely ignore this email.
          </Text>
          <Text style={footer}>
            <Link href="https://example.com/unsubscribe" style={link}>
              Unsubscribe
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: '#f6f9fc', fontFamily: 'sans-serif' };
const container = { margin: '0 auto', padding: '20px', maxWidth: '600px' };
const h1 = { color: '#333', fontSize: '24px', fontWeight: 'bold' };
const text = { color: '#555', fontSize: '16px', lineHeight: '24px' };
const buttonContainer = { textAlign: 'center' as const, margin: '32px 0' };
const button = {
  backgroundColor: '#5469d4',
  color: '#fff',
  padding: '12px 24px',
  borderRadius: '4px',
  textDecoration: 'none',
};
const footer = { color: '#999', fontSize: '12px', marginTop: '16px' };
const link = { color: '#5469d4', textDecoration: 'underline' };

// Render for sending
import { render } from '@react-email/render';

const html = render(<WelcomeEmail userName="Alice" verifyUrl="https://..." />);
const text = render(<WelcomeEmail userName="Alice" verifyUrl="https://..." />, {
  plainText: true,
});
```

## Deliverability Configuration

### DNS Records (SPF, DKIM, DMARC)

```typescript
// BAD: Sending without DNS verification
// No SPF/DKIM/DMARC setup leads to spam folder delivery
```

```typescript
// GOOD: DNS verification helper and validation
interface DomainConfig {
  domain: string;
  spfRecord: string; // "v=spf1 include:sendgrid.net ~all"
  dkimSelector: string; // "s1._domainkey"
  dkimValue: string; // CNAME value from provider
  dmarcPolicy: string; // "v=DMARC1; p=quarantine; pct=100; rua=mailto:..."
}

async function verifyDomainSetup(domain: string): Promise<{
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
  errors: string[];
}> {
  const dns = await import('dns').then(m => m.promises);
  const errors: string[] = [];
  let spf = false, dkim = false, dmarc = false;

  try {
    const txtRecords = await dns.resolveTxt(domain);
    spf = txtRecords.some(record =>
      record.join('').startsWith('v=spf1')
    );
    if (!spf) errors.push('SPF record not found');
  } catch (e) {
    errors.push(`SPF check failed: ${e}`);
  }

  try {
    const dmarcRecords = await dns.resolveTxt(`_dmarc.${domain}`);
    dmarc = dmarcRecords.some(record =>
      record.join('').startsWith('v=DMARC1')
    );
    if (!dmarc) errors.push('DMARC record not found');
  } catch (e) {
    errors.push(`DMARC check failed: ${e}`);
  }

  return { spf, dkim, dmarc, errors };
}
```

### List-Unsubscribe Header

```typescript
// BAD: No unsubscribe mechanism (violates CAN-SPAM)
await sendEmail({
  to: user.email,
  subject: 'Newsletter',
  html: content,
});
```

```typescript
// GOOD: List-Unsubscribe header with both HTTP and mailto
interface UnsubscribeConfig {
  httpUrl: string; // POST endpoint
  mailto: string;  // mailto:unsubscribe@example.com?subject=...
}

function buildEmailHeaders(unsubscribe: UnsubscribeConfig) {
  return {
    'List-Unsubscribe': `<${unsubscribe.httpUrl}>, <${unsubscribe.mailto}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

// SendGrid example
await sgMail.send({
  to: user.email,
  from: config.fromEmail,
  subject: 'Newsletter',
  html: content,
  headers: buildEmailHeaders({
    httpUrl: `https://example.com/unsubscribe/${user.unsubToken}`,
    mailto: `mailto:unsub@example.com?subject=unsubscribe-${user.id}`,
  }),
});
```

## Queue-Based Email Processing

### Immediate Send Anti-Pattern

```typescript
// BAD: Synchronous email in request handler
app.post('/register', async (req, res) => {
  const user = await createUser(req.body);
  await sendWelcomeEmail(user.email); // Blocks response
  res.json({ success: true });
});
```

### BullMQ Queue Pattern

```typescript
// GOOD: Queue-based processing with retry logic
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis({ maxRetriesPerRequest: null });

interface EmailJob {
  to: string;
  template: 'welcome' | 'reset-password' | 'notification';
  data: Record<string, unknown>;
}

const emailQueue = new Queue<EmailJob>('emails', { connection });

// Producer
app.post('/register', async (req, res) => {
  const user = await createUser(req.body);

  await emailQueue.add('send-email', {
    to: user.email,
    template: 'welcome',
    data: { userName: user.name, verifyUrl: user.verifyUrl },
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  });

  res.json({ success: true });
});

// Consumer
const emailWorker = new Worker<EmailJob>(
  'emails',
  async job => {
    const { to, template, data } = job.data;

    const emailClient = new SendGridClient(config);
    const { html, text, subject } = renderTemplate(template, data);

    await emailClient.send({ to, subject, html, text });
  },
  {
    connection,
    concurrency: 10,
    limiter: { max: 100, duration: 1000 }, // 100 emails/sec
  }
);

emailWorker.on('failed', (job, err) => {
  console.error(`Email job ${job?.id} failed:`, err);
  // Send to dead letter queue or alerting system
});
```

## Bounce and Complaint Handling

### Webhook Processing

```typescript
// BAD: Ignoring bounces and complaints
// Results in poor sender reputation and deliverability
```

```typescript
// GOOD: Process bounces, complaints, and unsubscribes
import { createHmac } from 'crypto';

interface SendGridEvent {
  email: string;
  event: 'bounce' | 'dropped' | 'spamreport' | 'unsubscribe';
  reason?: string;
  type?: 'hard' | 'soft';
  timestamp: number;
}

function verifyWebhookSignature(
  payload: string,
  signature: string,
  publicKey: string
): boolean {
  const hash = createHmac('sha256', publicKey)
    .update(payload)
    .digest('base64');
  return hash === signature;
}

app.post('/webhooks/sendgrid', async (req, res) => {
  const signature = req.headers['x-twilio-email-event-webhook-signature'];
  const isValid = verifyWebhookSignature(
    JSON.stringify(req.body),
    signature as string,
    process.env.SENDGRID_WEBHOOK_KEY!
  );

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const events: SendGridEvent[] = req.body;

  for (const event of events) {
    switch (event.event) {
      case 'bounce':
        if (event.type === 'hard') {
          await db.users.update(
            { email: event.email },
            { emailBounced: true, bouncedAt: new Date() }
          );
        }
        break;

      case 'spamreport':
        await db.users.update(
          { email: event.email },
          { spamComplaint: true, unsubscribed: true }
        );
        break;

      case 'unsubscribe':
        await db.users.update(
          { email: event.email },
          { unsubscribed: true, unsubscribedAt: new Date() }
        );
        break;
    }
  }

  res.status(200).send('OK');
});
```

### Pre-Send Validation

```typescript
// GOOD: Check bounce status before sending
async function shouldSendEmail(email: string): Promise<boolean> {
  const user = await db.users.findOne({ email });

  if (!user) return false;
  if (user.unsubscribed) return false;
  if (user.emailBounced) return false;
  if (user.spamComplaint) return false;

  return true;
}

emailWorker.on('active', async job => {
  const canSend = await shouldSendEmail(job.data.to);
  if (!canSend) {
    await job.moveToFailed(new Error('Recipient opted out or bounced'), true);
  }
});
```

## Rate Limiting and Throttling

```typescript
// BAD: Sending bulk emails without rate limiting
for (const user of users) {
  await sendEmail(user.email, 'Newsletter', content);
}
```

```typescript
// GOOD: Batched sending with rate limits
import pLimit from 'p-limit';

async function sendBulkEmails(
  users: Array<{ email: string; name: string }>,
  template: string,
  data: Record<string, unknown>
) {
  const limit = pLimit(10); // 10 concurrent sends
  const batchSize = 1000;
  const delayBetweenBatches = 60000; // 1 minute

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);

    await Promise.all(
      batch.map(user =>
        limit(() =>
          emailQueue.add('send-email', {
            to: user.email,
            template,
            data: { ...data, userName: user.name },
          })
        )
      )
    );

    if (i + batchSize < users.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
}
```

## Testing Email Systems

### Development Testing with Ethereal

```typescript
// GOOD: Use Ethereal for development testing
import nodemailer from 'nodemailer';

async function createTestEmailClient() {
  const testAccount = await nodemailer.createTestAccount();

  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  return {
    async send(params: { to: string; subject: string; html: string }) {
      const info = await transporter.sendMail({
        from: '"Test Sender" <test@example.com>',
        to: params.to,
        subject: params.subject,
        html: params.html,
      });

      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
      return info;
    },
  };
}
```

### Integration Tests

```typescript
// GOOD: Test email rendering and queue processing
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@react-email/render';

describe('Email System', () => {
  it('renders welcome email with all required elements', () => {
    const html = render(
      <WelcomeEmail userName="Test User" verifyUrl="https://test.com/verify" />
    );

    expect(html).toContain('Welcome, Test User!');
    expect(html).toContain('https://test.com/verify');
    expect(html).toContain('Unsubscribe');
  });

  it('queues email job with retry configuration', async () => {
    const job = await emailQueue.add('send-email', {
      to: 'test@example.com',
      template: 'welcome',
      data: { userName: 'Test' },
    });

    expect(job.opts.attempts).toBe(3);
    expect(job.opts.backoff).toBeDefined();
  });

  it('blocks sending to bounced emails', async () => {
    await db.users.create({
      email: 'bounced@example.com',
      emailBounced: true,
    });

    const canSend = await shouldSendEmail('bounced@example.com');
    expect(canSend).toBe(false);
  });
});
```

## Checklist for Production Email Systems

1. DNS configuration verified (SPF, DKIM, DMARC)
2. List-Unsubscribe header on all marketing emails
3. Queue-based processing for all sends
4. Bounce and complaint webhooks configured
5. Pre-send validation checks bounce/unsubscribe status
6. Rate limiting configured per provider limits
7. Email templates tested across clients (Litmus/Email on Acid)
8. Monitoring for deliverability metrics (open rate, bounce rate)
9. Suppression list management (bounces, complaints, unsubscribes)
10. Text fallback for all HTML emails
