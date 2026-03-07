---
name: terraform-iac
description: Terraform infrastructure as code with state management, modules, workspaces, lifecycle rules, and CI/CD patterns
user-invokable: true
argument-hint: "[init|plan|apply|import|workspace] - Terraform operation to perform"
---

# Terraform Infrastructure as Code

You are an expert in Terraform infrastructure as code, state management, module composition, and production deployment patterns.

## Project Structure

BAD - Monolithic configuration:
```hcl
# main.tf (2000+ lines)
provider "aws" {
  region = "us-east-1"
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "public_1" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
}
# ... 100+ more resources
```

GOOD - Modular structure:
```
terraform/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── terraform.tfvars
│   │   └── backend.tf
│   ├── staging/
│   └── prod/
├── modules/
│   ├── networking/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── versions.tf
│   ├── compute/
│   └── database/
└── shared/
    └── variables.tf
```

```hcl
# environments/prod/main.tf
module "networking" {
  source = "../../modules/networking"

  environment    = var.environment
  vpc_cidr       = var.vpc_cidr
  azs            = var.availability_zones
  public_subnets = var.public_subnet_cidrs
}

module "database" {
  source = "../../modules/database"

  environment       = var.environment
  vpc_id            = module.networking.vpc_id
  private_subnets   = module.networking.private_subnet_ids
  instance_class    = var.db_instance_class
}
```

## State Management

BAD - Local state with no locking:
```hcl
# No backend configuration, uses local terraform.tfstate
terraform {
  required_version = ">= 1.0"
}
```

GOOD - Remote backend with state locking:
```hcl
# environments/prod/backend.tf
terraform {
  backend "s3" {
    bucket         = "mycompany-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"

    # Prevent accidental deletion
    lifecycle {
      prevent_destroy = true
    }
  }

  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
```

Setup state backend resources:
```hcl
# bootstrap/state-backend.tf
resource "aws_s3_bucket" "terraform_state" {
  bucket = "mycompany-terraform-state"
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = "terraform-state-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}
```

## Module Composition

BAD - Hardcoded values, no versioning:
```hcl
module "vpc" {
  source = "../../modules/vpc"

  cidr_block = "10.0.0.0/16"
  name       = "my-vpc"
}
```

GOOD - Parameterized with version pinning:
```hcl
# modules/networking/variables.tf
variable "environment" {
  type        = string
  description = "Environment name"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "Must be valid IPv4 CIDR."
  }
}

variable "azs" {
  type        = list(string)
  description = "Availability zones"
}

# modules/networking/main.tf
locals {
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    Module      = "networking"
  }
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    Name = "${var.environment}-vpc"
  })
}

# modules/networking/outputs.tf
output "vpc_id" {
  value       = aws_vpc.main.id
  description = "VPC ID"
}

output "private_subnet_ids" {
  value       = aws_subnet.private[*].id
  description = "Private subnet IDs"
}

# environments/prod/main.tf
module "networking" {
  source = "git::https://github.com/company/terraform-modules.git//networking?ref=v2.1.0"

  environment = "prod"
  vpc_cidr    = "10.0.0.0/16"
  azs         = ["us-east-1a", "us-east-1b", "us-east-1c"]
}
```

## Environment Management

BAD - Workspaces for different environments:
```bash
terraform workspace new dev
terraform workspace new prod
terraform apply  # Which environment? State is confusing
```

GOOD - Directory-based environments with tfvars:
```hcl
# environments/prod/terraform.tfvars
environment = "prod"
vpc_cidr    = "10.0.0.0/16"

availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

db_instance_class = "db.r6g.xlarge"
db_allocated_storage = 100

ecs_task_cpu    = 2048
ecs_task_memory = 4096
```

```bash
# Deployment script
cd environments/prod
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

Use workspaces only for feature branches:
```bash
terraform workspace new feature-new-service
terraform apply -var="environment=dev"
terraform workspace select default
```

<!-- See references/advanced.md for extended examples -->
