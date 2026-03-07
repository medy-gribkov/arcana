# Terraform IAC - Advanced Patterns

## Data Sources

```hcl
# Fetch existing resources instead of hardcoding IDs
data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "app" {
  ami           = data.aws_ami.amazon_linux_2023.id
  instance_type = var.instance_type

  tags = {
    Name    = "${var.environment}-app"
    Account = data.aws_caller_identity.current.account_id
    Region  = data.aws_region.current.name
  }
}
```

## Lifecycle Rules

BAD - No protection on critical resources:
```hcl
resource "aws_db_instance" "main" {
  identifier        = "prod-db"
  allocated_storage = 100
  # Can be accidentally destroyed
}
```

GOOD - Lifecycle rules for safety:
```hcl
resource "aws_db_instance" "main" {
  identifier        = "prod-db"
  allocated_storage = 100

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [
      password,  # Managed externally
    ]
  }
}

resource "aws_lb_target_group" "blue" {
  name     = "app-blue"
  port     = 80
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "app" {
  name   = "app-sg"
  vpc_id = var.vpc_id

  lifecycle {
    create_before_destroy = true
  }
}
```

## Import Existing Resources

Workflow for importing manually created resources:

```bash
# 1. Write resource configuration
cat > imported.tf <<'EOF'
resource "aws_instance" "legacy" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.medium"

  tags = {
    Name = "legacy-server"
  }
}
EOF

# 2. Import resource into state
terraform import aws_instance.legacy i-1234567890abcdef0

# 3. Verify with plan (should show no changes)
terraform plan

# 4. If changes shown, update config to match reality
terraform show -json | jq '.values.root_module.resources[] | select(.address=="aws_instance.legacy")'
```

Using import blocks (Terraform 1.5+):
```hcl
import {
  to = aws_instance.legacy
  id = "i-1234567890abcdef0"
}

resource "aws_instance" "legacy" {
  # Configuration will be generated
}
```

```bash
terraform plan -generate-config-out=generated.tf
```

## CI/CD with Plan Artifacts

BAD - Apply directly in CI without review:
```yaml
# .github/workflows/terraform.yml (BAD)
- name: Terraform Apply
  run: terraform apply -auto-approve
```

GOOD - Plan artifact with manual approval:
```yaml
# .github/workflows/terraform-plan.yml
name: Terraform Plan

on:
  pull_request:
    paths:
      - 'terraform/**'

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.5.0

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-east-1

      - name: Terraform Init
        working-directory: terraform/environments/prod
        run: terraform init

      - name: Terraform Validate
        working-directory: terraform/environments/prod
        run: terraform validate

      - name: Terraform Plan
        working-directory: terraform/environments/prod
        run: |
          terraform plan -out=tfplan
          terraform show -no-color tfplan > tfplan.txt

      - name: Upload Plan
        uses: actions/upload-artifact@v4
        with:
          name: tfplan
          path: terraform/environments/prod/tfplan

      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const plan = fs.readFileSync('terraform/environments/prod/tfplan.txt', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Terraform Plan\n\`\`\`\n${plan}\n\`\`\``
            });

# .github/workflows/terraform-apply.yml
name: Terraform Apply

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy'
        required: true
        type: choice
        options:
          - dev
          - staging
          - prod

jobs:
  apply:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3

      - name: Download Plan
        uses: actions/download-artifact@v4
        with:
          name: tfplan

      - name: Terraform Apply
        working-directory: terraform/environments/${{ github.event.inputs.environment }}
        run: terraform apply tfplan
```

## Drift Detection

```bash
#!/bin/bash
# scripts/detect-drift.sh

set -e

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
  echo "Usage: $0 <environment>"
  exit 1
fi

cd "terraform/environments/$ENVIRONMENT"

terraform init -backend=true

# Run plan and capture exit code
set +e
terraform plan -detailed-exitcode -out=drift.tfplan
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 0 ]; then
  echo "No drift detected"
  exit 0
elif [ $EXIT_CODE -eq 1 ]; then
  echo "Error running terraform plan"
  exit 1
elif [ $EXIT_CODE -eq 2 ]; then
  echo "Drift detected!"
  terraform show -no-color drift.tfplan

  # Send alert
  curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"Terraform drift detected in $ENVIRONMENT\"}"

  exit 2
fi
```

Scheduled drift detection:
```yaml
# .github/workflows/drift-detection.yml
name: Drift Detection

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours

jobs:
  detect:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [dev, staging, prod]
    steps:
      - uses: actions/checkout@v4
      - name: Detect Drift
        run: ./scripts/detect-drift.sh ${{ matrix.environment }}
```

## Common Patterns

VPC with public/private subnets:
```hcl
# modules/networking/main.tf
locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 3)
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
}

resource "aws_subnet" "public" {
  count                   = length(local.azs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.environment}-public-${local.azs[count.index]}"
    Type = "public"
  }
}

resource "aws_subnet" "private" {
  count             = length(local.azs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = local.azs[count.index]

  tags = {
    Name = "${var.environment}-private-${local.azs[count.index]}"
    Type = "private"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}

resource "aws_eip" "nat" {
  count  = length(local.azs)
  domain = "vpc"
}

resource "aws_nat_gateway" "main" {
  count         = length(local.azs)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  depends_on = [aws_internet_gateway.main]
}
```

RDS with replicas and backups:
```hcl
# modules/database/main.tf
resource "aws_db_subnet_group" "main" {
  name       = "${var.environment}-db-subnet"
  subnet_ids = var.private_subnets
}

resource "aws_db_instance" "primary" {
  identifier     = "${var.environment}-db-primary"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  storage_encrypted     = true
  storage_type          = "gp3"

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]

  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "mon:04:00-mon:05:00"

  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.environment}-db-final-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_db_instance" "replica" {
  count              = var.environment == "prod" ? 2 : 0
  identifier         = "${var.environment}-db-replica-${count.index + 1}"
  replicate_source_db = aws_db_instance.primary.identifier
  instance_class     = var.instance_class

  skip_final_snapshot = true

  lifecycle {
    create_before_destroy = true
  }
}
```

## Refactoring with Moved Blocks

When restructuring code without recreating resources:

```hcl
# Old structure
resource "aws_instance" "app" {
  ami = "ami-123"
}

# New modular structure with moved block
moved {
  from = aws_instance.app
  to   = module.compute.aws_instance.app
}

module "compute" {
  source = "./modules/compute"
}
```

Renaming resources:
```hcl
moved {
  from = aws_s3_bucket.data
  to   = aws_s3_bucket.application_data
}

resource "aws_s3_bucket" "application_data" {
  bucket = "my-app-data"
}
```

## Execution Workflow

When user invokes with operation argument:

1. **init**: Initialize backend, download providers
   ```bash
   terraform init -upgrade
   terraform validate
   ```

2. **plan**: Generate execution plan
   ```bash
   terraform plan -out=tfplan
   terraform show -no-color tfplan > plan.txt
   ```

3. **apply**: Execute changes
   ```bash
   terraform apply tfplan
   ```

4. **import**: Import existing resource
   ```bash
   # Ask user for resource type and ID
   terraform import <resource_type>.<name> <id>
   terraform show <resource_type>.<name>
   ```

5. **workspace**: Manage workspaces
   ```bash
   terraform workspace list
   terraform workspace select <name>
   ```

Always run `terraform validate` before plan/apply. Use `-var-file` for environment-specific variables. Store sensitive values in AWS Secrets Manager or HashiCorp Vault, reference with data sources.
