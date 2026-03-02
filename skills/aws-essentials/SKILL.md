---
name: aws-essentials
description: AWS core services guide covering Lambda, S3, RDS, IAM, SQS/SNS, DynamoDB, CloudFront with security and cost optimization patterns
user-invokable: true
argument-hint: "[service-name or topic]"
---

# AWS Essentials

Production-ready patterns for AWS core services: Lambda handlers, S3 operations, RDS connection management, IAM policies, async messaging, DynamoDB design, CloudFront caching, and cost optimization.

## Lambda Handler Patterns

**BAD: Unoptimized cold starts, no reuse**
```typescript
// TypeScript - AWS SDK v3
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

export const handler = async (event: any) => {
  const client = new DynamoDBClient({ region: 'us-east-1' }); // ❌ Created every invocation
  const apiKey = 'hardcoded-key-abc123'; // ❌ Hardcoded credentials

  await client.send(new PutItemCommand({
    TableName: 'users',
    Item: { id: { S: event.id }, data: { S: JSON.stringify(event) } }
  }));
};
```

**GOOD: Warm reuse, environment config, structured logging**
```typescript
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// ✅ Instantiate outside handler for reuse across warm invocations
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

let cachedSecret: string | null = null;

async function getSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;

  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: process.env.SECRET_ARN })
  );
  cachedSecret = response.SecretString!;
  return cachedSecret;
}

export const handler = async (event: { id: string; data: Record<string, any> }) => {
  const startTime = Date.now();

  try {
    const secret = await getSecret();

    await dynamoClient.send(new PutItemCommand({
      TableName: process.env.TABLE_NAME!,
      Item: {
        id: { S: event.id },
        data: { S: JSON.stringify(event.data) },
        timestamp: { N: Date.now().toString() }
      }
    }));

    console.log(JSON.stringify({
      level: 'info',
      message: 'Item stored',
      id: event.id,
      duration: Date.now() - startTime
    }));

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Failed to store item',
      error: error instanceof Error ? error.message : String(error),
      id: event.id
    }));
    throw error;
  }
};
```

**Go handler with proper error handling**
```go
package main

import (
	"context"
	"encoding/json"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var dynamoClient *dynamodb.Client

func init() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix

	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load AWS config")
	}
	dynamoClient = dynamodb.NewFromConfig(cfg)
}

type Event struct {
	ID   string                 `json:"id"`
	Data map[string]interface{} `json:"data"`
}

func handleRequest(ctx context.Context, event Event) (map[string]interface{}, error) {
	start := time.Now()

	dataJSON, err := json.Marshal(event.Data)
	if err != nil {
		return nil, err
	}

	_, err = dynamoClient.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: &os.Getenv("TABLE_NAME"),
		Item: map[string]types.AttributeValue{
			"id":        &types.AttributeValueMemberS{Value: event.ID},
			"data":      &types.AttributeValueMemberS{Value: string(dataJSON)},
			"timestamp": &types.AttributeValueMemberN{Value: string(time.Now().Unix())},
		},
	})

	if err != nil {
		log.Error().Err(err).Str("id", event.ID).Msg("Failed to store item")
		return nil, err
	}

	log.Info().Str("id", event.ID).Dur("duration", time.Since(start)).Msg("Item stored")
	return map[string]interface{}{"success": true}, nil
}

func main() {
	lambda.Start(handleRequest)
}
```

## S3 Operations

**BAD: Public bucket, direct uploads**
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'us-east-1' });

// ❌ Public ACL, no encryption
await s3.send(new PutObjectCommand({
  Bucket: 'my-bucket',
  Key: 'uploads/file.pdf',
  Body: fileBuffer,
  ACL: 'public-read' // ❌ Never use public ACLs
}));
```

**GOOD: Presigned URLs, encryption, lifecycle policies**
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({ region: process.env.AWS_REGION });

// ✅ Generate presigned URL for client-side uploads
export async function generateUploadUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.UPLOAD_BUCKET!,
    Key: `uploads/${Date.now()}-${key}`,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
    Metadata: {
      uploadedBy: 'user-service',
      uploadDate: new Date().toISOString()
    }
  });

  // URL expires in 15 minutes
  return getSignedUrl(s3, command, { expiresIn: 900 });
}

// ✅ Lifecycle policy (apply via IaC or AWS CLI)
const lifecyclePolicy = {
  Rules: [
    {
      Id: 'TransitionOldUploads',
      Status: 'Enabled',
      Transitions: [
        { Days: 30, StorageClass: 'INTELLIGENT_TIERING' },
        { Days: 90, StorageClass: 'GLACIER_IR' }
      ],
      NoncurrentVersionExpiration: { NoncurrentDays: 30 },
      AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 }
    }
  ]
};
```

## RDS Connection Pooling

**BAD: Direct Lambda connections to RDS**
```typescript
import { Client } from 'pg';

// ❌ Creates new connection every invocation, exhausts RDS connections
export const handler = async () => {
  const client = new Client({
    host: 'mydb.abc123.us-east-1.rds.amazonaws.com',
    user: 'admin',
    password: 'hardcoded-password', // ❌ Never hardcode
    database: 'prod'
  });

  await client.connect();
  const result = await client.query('SELECT * FROM users');
  await client.end();

  return result.rows;
};
```

**GOOD: RDS Proxy with IAM authentication**
```typescript
import { Pool } from 'pg';
import { Signer } from '@aws-sdk/rds-signer';

const signer = new Signer({
  region: process.env.AWS_REGION!,
  hostname: process.env.RDS_PROXY_ENDPOINT!,
  port: 5432,
  username: process.env.DB_USER!
});

// ✅ Connection pool reused across warm invocations
const pool = new Pool({
  host: process.env.RDS_PROXY_ENDPOINT,
  port: 5432,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: async () => {
    return await signer.getAuthToken(); // ✅ IAM-based auth token
  },
  max: 2, // ✅ Low pool size for Lambda (RDS Proxy handles pooling)
  ssl: { rejectUnauthorized: true }
});

export const handler = async (event: { userId: string }) => {
  const client = await pool.connect();

  try {
    const result = await client.query('SELECT * FROM users WHERE id = $1', [event.userId]);
    return result.rows[0];
  } finally {
    client.release(); // ✅ Return to pool, don't close
  }
};
```

## IAM Least Privilege Policies

**BAD: Wildcard permissions**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:*",
      "Resource": "*"
    }
  ]
}
```

**GOOD: Scoped permissions with conditions**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowUploadToBucket",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:PutObjectAcl"],
      "Resource": "arn:aws:s3:::my-upload-bucket/uploads/*",
      "Condition": {
        "StringEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    },
    {
      "Sid": "AllowListBucket",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::my-upload-bucket",
      "Condition": {
        "StringLike": {
          "s3:prefix": ["uploads/*"]
        }
      }
    }
  ]
}
```

**Use roles for EC2/Lambda, not IAM users**
```typescript
// ✅ Lambda function role (attach via SAM/CDK/Terraform)
const lambdaExecutionRole = {
  AssumeRolePolicyDocument: {
    Version: '2012-10-17',
    Statement: [{
      Effect: 'Allow',
      Principal: { Service: 'lambda.amazonaws.com' },
      Action: 'sts:AssumeRole'
    }]
  },
  ManagedPolicyArns: ['arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
  Policies: [{
    PolicyName: 'DynamoDBAccess',
    PolicyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Action: ['dynamodb:PutItem', 'dynamodb:GetItem'],
        Resource: 'arn:aws:dynamodb:us-east-1:123456789012:table/users'
      }]
    }
  }]
};
```

## SQS/SNS Async Processing

**BAD: Synchronous processing, no error handling**
```typescript
// ❌ Blocks Lambda execution waiting for email send
export const handler = async (event: { email: string; content: string }) => {
  await sendEmail(event.email, event.content); // Slow, blocks return
  return { statusCode: 200 };
};
```

**GOOD: Decouple with SQS/SNS**
```typescript
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const sqsClient = new SQSClient({ region: process.env.AWS_REGION });
const snsClient = new SNSClient({ region: process.env.AWS_REGION });

// ✅ API handler: queue task and return immediately
export const apiHandler = async (event: { email: string; content: string }) => {
  await sqsClient.send(new SendMessageCommand({
    QueueUrl: process.env.EMAIL_QUEUE_URL,
    MessageBody: JSON.stringify(event),
    MessageAttributes: {
      priority: { DataType: 'String', StringValue: 'high' }
    }
  }));

  return { statusCode: 202, body: JSON.stringify({ message: 'Queued' }) };
};

// ✅ Worker handler: process queue messages
export const workerHandler = async (event: { Records: any[] }) => {
  for (const record of event.Records) {
    const { email, content } = JSON.parse(record.body);

    try {
      await sendEmail(email, content);

      // ✅ Publish success event to SNS topic for analytics
      await snsClient.send(new PublishCommand({
        TopicArn: process.env.EVENTS_TOPIC_ARN,
        Message: JSON.stringify({ event: 'email_sent', email }),
        MessageAttributes: {
          eventType: { DataType: 'String', StringValue: 'email_sent' }
        }
      }));
    } catch (error) {
      console.error('Email send failed', { email, error });
      throw error; // ✅ SQS will retry based on redrive policy
    }
  }
};
```

## DynamoDB Single-Table Design

**BAD: Multiple tables, no GSIs**
```typescript
// ❌ Separate tables require multiple queries
await dynamoClient.send(new GetItemCommand({
  TableName: 'Users',
  Key: { userId: { S: '123' } }
}));

await dynamoClient.send(new QueryCommand({
  TableName: 'Orders',
  KeyConditionExpression: 'userId = :userId',
  ExpressionAttributeValues: { ':userId': { S: '123' } }
}));
```

**GOOD: Single table with composite keys**
```typescript
import { DynamoDBClient, QueryCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

// ✅ Single table structure: PK = USER#123, SK = PROFILE / ORDER#2024-01-15
async function putUser(userId: string, name: string, email: string) {
  await dynamoClient.send(new PutItemCommand({
    TableName: process.env.TABLE_NAME!,
    Item: {
      PK: { S: `USER#${userId}` },
      SK: { S: 'PROFILE' },
      GSI1PK: { S: `EMAIL#${email}` }, // ✅ GSI for email lookups
      GSI1SK: { S: `USER#${userId}` },
      name: { S: name },
      email: { S: email },
      type: { S: 'user' }
    }
  }));
}

async function putOrder(userId: string, orderId: string, amount: number) {
  await dynamoClient.send(new PutItemCommand({
    TableName: process.env.TABLE_NAME!,
    Item: {
      PK: { S: `USER#${userId}` },
      SK: { S: `ORDER#${orderId}` },
      amount: { N: amount.toString() },
      type: { S: 'order' }
    }
  }));
}

// ✅ Single query gets user and all orders
async function getUserWithOrders(userId: string) {
  const result = await dynamoClient.send(new QueryCommand({
    TableName: process.env.TABLE_NAME!,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': { S: `USER#${userId}` } }
  }));

  return result.Items;
}
```

## CloudFront Caching

**BAD: No cache control, frequent invalidations**
```typescript
// ❌ Every request hits origin
const response = {
  statusCode: 200,
  headers: {
    'Cache-Control': 'no-cache' // ❌ Defeats CloudFront purpose
  },
  body: JSON.stringify(data)
};
```

**GOOD: Strategic caching with versioned assets**
```typescript
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';

const cfClient = new CloudFrontClient({ region: 'us-east-1' });

// ✅ Lambda@Edge origin response for dynamic cache headers
export const handler = async (event: any) => {
  const request = event.Records[0].cf.request;
  const response = event.Records[0].cf.response;

  // Static assets: cache for 1 year (use versioned filenames)
  if (request.uri.match(/\.(js|css|png|jpg|woff2)$/)) {
    response.headers['cache-control'] = [{
      key: 'Cache-Control',
      value: 'public, max-age=31536000, immutable'
    }];
  }

  // API responses: cache for 5 minutes
  else if (request.uri.startsWith('/api/')) {
    response.headers['cache-control'] = [{
      key: 'Cache-Control',
      value: 'public, max-age=300, s-maxage=300'
    }];
  }

  // HTML: cache for 1 hour, revalidate
  else {
    response.headers['cache-control'] = [{
      key: 'Cache-Control',
      value: 'public, max-age=3600, must-revalidate'
    }];
  }

  return response;
};

// ✅ Targeted invalidation (use sparingly, costs $0.005 per path)
async function invalidateCache(paths: string[]) {
  await cfClient.send(new CreateInvalidationCommand({
    DistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: Date.now().toString(),
      Paths: {
        Quantity: paths.length,
        Items: paths // e.g., ['/index.html', '/api/*']
      }
    }
  }));
}
```

## Cost Optimization

**Key strategies**
```typescript
// 1. Use Lambda reserved concurrency to prevent runaway costs
const lambdaConfig = {
  ReservedConcurrentExecutions: 10, // ✅ Cap max concurrent invocations
  Timeout: 30, // ✅ Don't use default 3s or max 900s, tune to actual need
  MemorySize: 512 // ✅ Test optimal memory (higher = faster = cheaper sometimes)
};

// 2. S3 Intelligent-Tiering for unpredictable access patterns
const s3LifecycleRule = {
  Transitions: [
    { Days: 0, StorageClass: 'INTELLIGENT_TIERING' } // ✅ Auto-optimize
  ]
};

// 3. DynamoDB on-demand for variable traffic, provisioned for steady
const dynamoConfig = {
  BillingMode: 'PAY_PER_REQUEST' // ✅ On-demand for dev/staging
  // BillingMode: 'PROVISIONED', // ✅ Provisioned + auto-scaling for prod
};

// 4. Use AWS Cost Anomaly Detection
// Set up via AWS Console > Cost Management > Cost Anomaly Detection
// Alerts when spend deviates from historical patterns

// 5. Tag everything for cost allocation
const resourceTags = {
  Environment: 'production',
  Project: 'user-service',
  CostCenter: 'engineering',
  Owner: 'platform-team'
};
```

## Configuration with SSM Parameter Store

**BAD: Hardcoded or environment variables for secrets**
```typescript
const apiKey = process.env.API_KEY; // ❌ Visible in Lambda console
```

**GOOD: SSM Parameter Store with encryption**
```typescript
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: process.env.AWS_REGION });
const cache = new Map<string, { value: string; expires: number }>();

async function getParameter(name: string, ttl = 300000): Promise<string> {
  const cached = cache.get(name);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  const response = await ssmClient.send(new GetParameterCommand({
    Name: name,
    WithDecryption: true // ✅ Decrypt SecureString parameters
  }));

  const value = response.Parameter!.Value!;
  cache.set(name, { value, expires: Date.now() + ttl });

  return value;
}

// ✅ Usage in handler
export const handler = async () => {
  const dbPassword = await getParameter('/prod/db/password');
  const apiKey = await getParameter('/prod/external-api/key');

  // Use credentials...
};
```

## Quick Reference

**Lambda cold start mitigation**
- Keep deployment packages small (< 50MB unzipped)
- Use Lambda layers for shared dependencies
- Provisioned concurrency for latency-sensitive endpoints (costs more)
- Minimize SDK imports: import specific clients, not entire SDK

**S3 performance**
- Use multipart upload for files > 100MB
- CloudFront in front of S3 for public assets
- S3 Transfer Acceleration for global uploads (costs extra)
- Request rate: > 3,500 PUT/COPY/POST/DELETE or 5,500 GET/HEAD per prefix per second

**RDS best practices**
- Use RDS Proxy for Lambda (connection pooling, IAM auth, failover)
- Enable Performance Insights for query analysis
- Multi-AZ for production (auto-failover)
- Read replicas for read-heavy workloads

**DynamoDB performance**
- Partition key must have high cardinality (avoid hot partitions)
- Use sparse indexes for GSIs (only items with index attributes)
- DynamoDB Streams for change data capture
- Point-in-time recovery (PITR) for production tables

**Monitoring**
- CloudWatch Logs Insights for log queries
- X-Ray for distributed tracing (add AWS X-Ray SDK)
- Set CloudWatch alarms for Lambda errors, throttles, duration
- Use CloudWatch Contributor Insights for top-N analysis
