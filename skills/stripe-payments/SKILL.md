---
name: stripe-payments
description: Stripe integration covering Checkout, Payment Intents, subscriptions, webhook verification, idempotency, and SCA
user-invokable: true
argument-hint: checkout | subscription | webhook | refund | portal
---

# Stripe Payments Integration

Secure payment flows with webhook handling, idempotency, and SCA support.

## Checkout Sessions

**BAD: Client-side price, no idempotency**
```typescript
// ❌ Trusting client data, XSS risk
app.post('/checkout', async (req, res) => {
  const { priceId, amount } = req.body; // Never trust client
  const session = await stripe.checkout.sessions.create({
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: req.body.successUrl, // XSS risk
  });
  res.json({ url: session.url });
});
```

**GOOD: Server-side price lookup, idempotency, metadata**
```typescript
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

app.post('/checkout', async (req, res) => {
  const { productId, userId } = req.body;

  const prices = await stripe.prices.list({ product: productId, active: true });
  if (!prices.data.length) return res.status(400).json({ error: 'Invalid product' });

  const session = await stripe.checkout.sessions.create({
    line_items: [{ price: prices.data[0].id, quantity: 1 }],
    mode: 'payment',
    success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BASE_URL}/cancel`,
    metadata: { userId, productId },
  }, {
    idempotencyKey: `checkout_${userId}_${productId}_${Date.now()}`,
  });

  res.json({ url: session.url });
});
```

## Payment Intents with SCA

**BAD: Deprecated Charges API, no 3D Secure**
```typescript
// ❌ Deprecated, no SCA support
app.post('/charge', async (req, res) => {
  await stripe.charges.create({
    amount: req.body.amount,
    source: req.body.token, // Deprecated
  });
});
```

**GOOD: Payment Intent with automatic SCA, React Elements**
```typescript
// Server-side
app.post('/payment-intent', async (req, res) => {
  const order = await db.orders.findUnique({ where: { id: req.body.orderId } });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const paymentIntent = await stripe.paymentIntents.create({
    amount: order.totalCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: { orderId: order.id },
  }, { idempotencyKey: `pi_${order.id}` });

  res.json({ clientSecret: paymentIntent.client_secret });
});

// Client-side React
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      if (!stripe || !elements) return;
      await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: `${window.location.origin}/complete` },
      });
    }}>
      <PaymentElement />
      <button disabled={!stripe}>Pay</button>
    </form>
  );
}
```

## Subscriptions

**BAD: Duplicate customers, no proration**
```typescript
// ❌ Creates duplicate customers
app.post('/subscribe', async (req, res) => {
  const customer = await stripe.customers.create({ email: req.body.email });
  const sub = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: req.body.priceId }] });
  res.json(sub);
});
```

**GOOD: Idempotent customer, trials, proration**
```typescript
async function subscribe(userId: string, priceId: string, trialDays?: number) {
  const user = await db.users.findUnique({ where: { id: userId } });

  const customer = user.stripeCustomerId
    ? await stripe.customers.retrieve(user.stripeCustomerId) as Stripe.Customer
    : await stripe.customers.create(
        { email: user.email, metadata: { userId } },
        { idempotencyKey: `customer_${userId}` }
      );

  if (!user.stripeCustomerId) {
    await db.users.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  }

  return await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    trial_period_days: trialDays,
    payment_settings: { save_default_payment_method: 'on_subscription' },
    metadata: { userId },
  }, { idempotencyKey: `sub_${userId}_${priceId}` });
}

// Upgrade/downgrade with proration
async function changePlan(subId: string, newPriceId: string) {
  const sub = await stripe.subscriptions.retrieve(subId);
  return await stripe.subscriptions.update(subId, {
    items: [{ id: sub.items.data[0].id, price: newPriceId }],
    proration_behavior: 'create_prorations',
  });
}
```

## Webhook Verification (Critical)

**BAD: No signature verification**
```typescript
// ❌ CRITICAL SECURITY FLAW
app.post('/webhook', async (req, res) => {
  const event = req.body;
  await fulfillOrder(event.data.object.metadata.orderId); // Attacker-controlled!
});
```

**GOOD: Signature verification, idempotent processing**
```typescript
import { buffer } from 'micro';

export const config = { api: { bodyParser: false } }; // Next.js

export default async function webhook(req, res) {
  const buf = await buffer(req);
  const sig = req.headers['stripe-signature']!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency check
  const existing = await db.webhookEvents.findUnique({ where: { stripeEventId: event.id } });
  if (existing) return res.json({ received: true, duplicate: true });

  await db.webhookEvents.create({ data: { stripeEventId: event.id, type: event.type } });

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePayment(event.data.object as Stripe.PaymentIntent);
      break;
    case 'customer.subscription.updated':
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
  }

  res.json({ received: true });
}
```

## Customer Portal and Refunds

```typescript
// Self-service billing portal
app.post('/portal', async (req, res) => {
  const user = await db.users.findUnique({ where: { id: req.body.userId } });
  if (!user?.stripeCustomerId) return res.status(400).json({ error: 'No customer' });

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.BASE_URL}/account`,
  });
  res.json({ url: session.url });
});

// Refunds with idempotency
async function refund(paymentIntentId: string) {
  return await stripe.refunds.create({
    payment_intent: paymentIntentId,
  }, { idempotencyKey: `refund_${paymentIntentId}` });
}

// Cancel subscription
async function cancelSub(subId: string, immediately = false) {
  return immediately
    ? await stripe.subscriptions.cancel(subId)
    : await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
}
```

## Error Handling

**BAD: Generic errors, no retry**
```typescript
// ❌ No error specificity
try {
  await stripe.paymentIntents.create({ /* ... */ });
} catch (err) {
  res.status(500).json({ error: 'Something went wrong' });
}
```

**GOOD: Type-specific errors with retry logic**
```typescript
async function createPayment(params: Stripe.PaymentIntentCreateParams, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await stripe.paymentIntents.create(params, {
        idempotencyKey: params.metadata?.orderId,
      });
    } catch (err) {
      if (err instanceof Stripe.errors.StripeCardError) {
        throw new Error(`Card declined: ${err.message}`); // Don't retry
      } else if (err instanceof Stripe.errors.StripeRateLimitError) {
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, 1000 * (i + 1)));
          continue;
        }
      } else if (err instanceof Stripe.errors.StripeAuthenticationError) {
        throw new Error('Invalid API key'); // Don't retry
      }
      throw err;
    }
  }
  throw new Error('Payment failed after retries');
}
```

## Testing

```typescript
// Test cards
const TEST_CARDS = {
  success: '4242424242424242',
  declined: '4000000000000002',
  requiresAuth: '4000002500003155', // 3D Secure
  insufficientFunds: '4000000000009995',
};

// Test clocks for subscription testing
async function createTestClock(customerId: string) {
  const clock = await stripe.testHelpers.testClocks.create({
    frozen_time: Math.floor(Date.now() / 1000),
  });
  await stripe.customers.update(customerId, { test_clock: clock.id });
  return clock;
}

// Advance time
async function advanceTime(clockId: string, days: number) {
  const clock = await stripe.testHelpers.testClocks.retrieve(clockId);
  return await stripe.testHelpers.testClocks.advance(clockId, {
    frozen_time: clock.frozen_time + (days * 86400),
  });
}
```

## Configuration

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

```typescript
// Validate on startup
if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY required');
if (!process.env.STRIPE_WEBHOOK_SECRET) console.warn('Webhooks will fail without STRIPE_WEBHOOK_SECRET');

const isTestMode = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_');
console.log(`Stripe: ${isTestMode ? 'TEST' : 'LIVE'} mode`);
```
