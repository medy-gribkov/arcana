# Cloud Provider Cost Optimization Examples

## Spot Instances (AWS)

Use spot for stateless, fault-tolerant workloads. Never for databases or single-instance services.

**BAD:** Running production database on spot. Termination = downtime.

**GOOD:** Batch processing on spot with auto-replacement.

```yaml
# AWS Auto Scaling Group
MixedInstancesPolicy:
  InstancesDistribution:
    OnDemandPercentageAboveBaseCapacity: 0
    SpotAllocationStrategy: capacity-optimized
  LaunchTemplate:
    LaunchTemplateSpecification:
      LaunchTemplateId: lt-abc123
      Version: $Latest
    Overrides:
      - InstanceType: m5.large
      - InstanceType: m5a.large
      - InstanceType: m5n.large
```

Diversify across instance types and AZs. Spot pricing varies by type and zone.

### Graceful Shutdown

Handle 2-minute termination notice.

```bash
# User data script
while true; do
  TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
  if curl -H "X-aws-ec2-metadata-token: $TOKEN" -s http://169.254.169.254/latest/meta-data/spot/termination-time | grep -q 'T'; then
    echo "Spot termination notice received. Draining..."
    kubectl drain $(hostname) --ignore-daemonsets --delete-emptydir-data
    break
  fi
  sleep 5
done
```

### Cost Impact

Spot instances are 70-90% cheaper than on-demand.

- On-demand m5.large: $0.096/hr x 720hr/month = $69.12/month
- Spot m5.large: $0.029/hr x 720hr/month = $20.88/month

**Savings: 70% ($48.24/month per instance)**

## Reserved Instances

Commit to 1-year or 3-year terms for steady-state workloads.

**Example:** 10 m5.large instances running 24/7.

- On-demand: $0.096/hr x 10 x 8760hr/year = $8,409.60/year
- 1-year RI (all upfront): $0.058/hr x 10 x 8760hr/year = $5,080.80/year

**Savings: 40% ($3,328.80/year)**

### Reserved Capacity Strategy

1. Analyze 3 months of usage. Identify consistent baseline.
2. Purchase RIs for 80% of baseline. Use on-demand for peaks.
3. Start with 1-year commitments. Only 3-year if workload is certain.
4. Use convertible RIs if instance type may change.

### Track Utilization

Unused reservations are pure waste. Monitor monthly.

```bash
aws ce get-reservation-utilization \
  --time-period Start=2026-01-01,End=2026-01-31 \
  --granularity MONTHLY
```

Target 95%+ utilization. Below 90% means over-commitment.

## Cost Monitoring (AWS)

Set billing alerts at 50%, 80%, 100% of budget.

```bash
aws budgets create-budget --account-id 123456789012 --budget file://budget.json
```

**budget.json:**

```json
{
  "BudgetName": "Monthly Infrastructure Budget",
  "BudgetLimit": { "Amount": "1000", "Unit": "USD" },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
```

### Tag All Resources

Untagged resources are invisible costs.

```yaml
tags:
  team: backend
  environment: production
  service: api
```

Query spend by tag.

```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-01-01,End=2026-01-31 \
  --granularity MONTHLY \
  --group-by Type=TAG,Key=team
```

### Automate Non-Production Shutdown

Dev and staging environments running 24/7 waste 65% of their cost.

**AWS Lambda to stop instances outside business hours:**

```python
import boto3

ec2 = boto3.client('ec2')

def lambda_handler(event, context):
    instances = ec2.describe_instances(
        Filters=[{'Name': 'tag:environment', 'Values': ['dev', 'staging']}]
    )

    instance_ids = [i['InstanceId'] for r in instances['Reservations'] for i in r['Instances']]

    if instance_ids:
        ec2.stop_instances(InstanceIds=instance_ids)
```

Run on cron: stop at 6 PM, start at 8 AM.

**Savings:** 14 hours/day x 7 days = 68% reduction for non-production.
