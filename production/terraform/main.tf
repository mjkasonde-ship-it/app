# ---------------------------------------------------------------------------
# Cove Legal Tech – AWS Infrastructure (af-south-1 / Zambia-optimized)
# Terraform configuration for production deployment
# ---------------------------------------------------------------------------

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket = "cove-terraform-state"
    key    = "production/terraform.tfstate"
    region = "af-south-1"
    encrypt = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project       = "cove-legal-tech"
      Environment   = var.environment
      ManagedBy     = "terraform"
      DataResidency = "zambia-compliant"
      Owner         = "mjkasonde"
    }
  }
}

# ── Data Sources ───────────────────────────────────────────────────────────
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ── VPC ────────────────────────────────────────────────────────────────────
resource "aws_vpc" "cove" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "cove-${var.environment}-vpc"
  }
}

# ── Subnets ────────────────────────────────────────────────────────────────
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.cove.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "cove-${var.environment}-public-${count.index + 1}"
    Type = "public"
  }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.cove.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "cove-${var.environment}-private-${count.index + 1}"
    Type = "private"
  }
}

resource "aws_subnet" "database" {
  count             = 2
  vpc_id            = aws_vpc.cove.id
  cidr_block        = "10.0.${count.index + 20}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "cove-${var.environment}-database-${count.index + 1}"
    Type = "database"
  }
}

# ── Internet Gateway ──────────────────────────────────────────────────────
resource "aws_internet_gateway" "cove" {
  vpc_id = aws_vpc.cove.id

  tags = {
    Name = "cove-${var.environment}-igw"
  }
}

# ── NAT Gateway ────────────────────────────────────────────────────────────
resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name = "cove-${var.environment}-nat-eip"
  }
}

resource "aws_nat_gateway" "cove" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name = "cove-${var.environment}-nat"
  }
}

# ── Route Tables ───────────────────────────────────────────────────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.cove.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.cove.id
  }

  tags = {
    Name = "cove-${var.environment}-public-rt"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.cove.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.cove.id
  }

  tags = {
    Name = "cove-${var.environment}-private-rt"
  }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ── Security Groups ────────────────────────────────────────────────────────
resource "aws_security_group" "alb" {
  name_prefix = "cove-alb-"
  vpc_id      = aws_vpc.cove.id
  description = "Security group for Application Load Balancer"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "cove-${var.environment}-alb-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "backend" {
  name_prefix = "cove-backend-"
  vpc_id      = aws_vpc.cove.id
  description = "Security group for backend ECS tasks"

  ingress {
    from_port       = 8001
    to_port         = 8001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "From ALB"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "cove-${var.environment}-backend-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "mongodb" {
  name_prefix = "cove-mongodb-"
  vpc_id      = aws_vpc.cove.id
  description = "Security group for DocumentDB"

  ingress {
    from_port       = 27017
    to_port         = 27017
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
    description     = "From backend"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "cove-${var.environment}-mongodb-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ── Application Load Balancer ──────────────────────────────────────────────
resource "aws_lb" "cove" {
  name               = "cove-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = var.environment == "production"
  enable_http2               = true
  idle_timeout               = 60

  access_logs {
    bucket  = aws_s3_bucket.logs.id
    prefix  = "alb-logs"
    enabled = true
  }

  tags = {
    Name = "cove-${var.environment}-alb"
  }
}

resource "aws_lb_target_group" "backend" {
  name     = "cove-${var.environment}-backend-tg"
  port     = 8001
  protocol = "HTTP"
  vpc_id   = aws_vpc.cove.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/api/v1/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  tags = {
    Name = "cove-${var.environment}-backend-tg"
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.cove.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.cove.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.cove.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ── ACM Certificate ──────────────────────────────────────────────────────────
resource "aws_acm_certificate" "cove" {
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  tags = {
    Name = "cove-${var.environment}-cert"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ── ECS Cluster ────────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "cove" {
  name = "cove-${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"

      log_configuration {
        cloud_watch_encryption_enabled = true
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs_exec.name
      }
    }
  }
}

resource "aws_ecs_cluster_capacity_providers" "cove" {
  cluster_name = aws_ecs_cluster.cove.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 1
    capacity_provider = "FARGATE"
  }
}

# ── ECS Task Definition ────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "backend" {
  family                   = "cove-${var.environment}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.backend_cpu
  memory                   = var.backend_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "backend"
      image = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true

      portMappings = [
        {
          containerPort = 8001
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "ENVIRONMENT", value = var.environment },
        { name = "MONGO_URL", value = "mongodb://${aws_docdb_cluster.cove.endpoint}:27017" },
        { name = "DB_NAME", value = "cove_db" },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "S3_BUCKET_NAME", value = aws_s3_bucket.vdr.id },
      ]

      secrets = [
        { name = "JWT_SECRET_KEY", valueFrom = aws_secretsmanager_secret.jwt.arn },
        { name = "EMERGENT_LLM_KEY", valueFrom = aws_secretsmanager_secret.llm.arn },
        { name = "SENTRY_DSN", valueFrom = aws_secretsmanager_secret.sentry.arn },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.backend.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8001/api/v1/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      ulimits = [
        {
          name      = "nofile"
          softLimit = 65536
          hardLimit = 65536
        }
      ]
    }
  ])

  tags = {
    Name = "cove-${var.environment}-backend-task"
  }
}

# ── ECS Service ────────────────────────────────────────────────────────────
resource "aws_ecs_service" "backend" {
  name            = "cove-${var.environment}-backend"
  cluster         = aws_ecs_cluster.cove.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.backend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.backend.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8001
  }

  deployment_configuration {
    deployment_circuit_breaker {
      enable   = true
      rollback = true
    }

    maximum_percent         = 200
    minimum_healthy_percent = 100
  }

  service_registries {
    registry_arn = aws_service_discovery_service.backend.arn
  }

  depends_on = [aws_lb_listener.https]

  tags = {
    Name = "cove-${var.environment}-backend-service"
  }
}

# ── DocumentDB ─────────────────────────────────────────────────────────────
resource "aws_docdb_subnet_group" "cove" {
  name       = "cove-${var.environment}-docdb-subnet"
  subnet_ids = aws_subnet.database[*].id

  tags = {
    Name = "cove-${var.environment}-docdb-subnet"
  }
}

resource "aws_docdb_cluster" "cove" {
  cluster_identifier     = "cove-${var.environment}-docdb"
  engine                 = "docdb"
  master_username        = var.docdb_username
  master_password        = var.docdb_password
  db_subnet_group_name   = aws_docdb_subnet_group.cove.name
  vpc_security_group_ids = [aws_security_group.mongodb.id]
  skip_final_snapshot    = var.environment != "production"
  deletion_protection    = var.environment == "production"

  backup_retention_period = var.environment == "production" ? 35 : 7
  preferred_backup_window = "03:00-04:00"

  enabled_cloudwatch_logs_exports = ["audit", "profiler"]

  tags = {
    Name = "cove-${var.environment}-docdb"
  }
}

resource "aws_docdb_cluster_instance" "cove" {
  count              = var.environment == "production" ? 2 : 1
  identifier         = "cove-${var.environment}-docdb-${count.index + 1}"
  cluster_identifier = aws_docdb_cluster.cove.id
  instance_class     = var.docdb_instance_class

  auto_minor_version_upgrade = true

  tags = {
    Name = "cove-${var.environment}-docdb-${count.index + 1}"
  }
}

# ── S3 Buckets ───────────────────────────────────────────────────────────────
resource "aws_s3_bucket" "vdr" {
  bucket = "cove-${var.environment}-vdr-documents-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "vdr" {
  bucket = aws_s3_bucket.vdr.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "vdr" {
  bucket = aws_s3_bucket.vdr.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "vdr" {
  bucket = aws_s3_bucket.vdr.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "vdr" {
  bucket = aws_s3_bucket.vdr.id

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }
  }
}

resource "aws_s3_bucket" "logs" {
  bucket = "cove-${var.environment}-logs-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket = aws_s3_bucket.logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── ECR Repository ───────────────────────────────────────────────────────────
resource "aws_ecr_repository" "backend" {
  name                 = "cove-${var.environment}-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
  }

  force_delete = var.environment != "production"

  tags = {
    Name = "cove-${var.environment}-backend"
  }
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 30 images"
        selection = {
          tagStatus     = "any"
          countType     = "imageCountMoreThan"
          countNumber   = 30
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ── Secrets Manager ──────────────────────────────────────────────────────────
resource "aws_secretsmanager_secret" "jwt" {
  name                    = "cove/${var.environment}/jwt-secret"
  description             = "JWT secret key for Cove API"
  recovery_window_in_days = var.environment == "production" ? 30 : 7

  tags = {
    Name = "cove-${var.environment}-jwt-secret"
  }
}

resource "aws_secretsmanager_secret" "llm" {
  name                    = "cove/${var.environment}/llm-key"
  description             = "Emergent LLM API key"
  recovery_window_in_days = var.environment == "production" ? 30 : 7

  tags = {
    Name = "cove-${var.environment}-llm-key"
  }
}

resource "aws_secretsmanager_secret" "sentry" {
  name                    = "cove/${var.environment}/sentry-dsn"
  description             = "Sentry DSN for error tracking"
  recovery_window_in_days = var.environment == "production" ? 30 : 7

  tags = {
    Name = "cove-${var.environment}-sentry-dsn"
  }
}

# ── CloudWatch ───────────────────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/cove-${var.environment}/backend"
  retention_in_days = var.environment == "production" ? 90 : 30

  kms_key_id = aws_kms_key.cloudwatch.arn

  tags = {
    Name = "cove-${var.environment}-backend-logs"
  }
}

resource "aws_cloudwatch_log_group" "ecs_exec" {
  name              = "/ecs/cove-${var.environment}/exec"
  retention_in_days = 7

  tags = {
    Name = "cove-${var.environment}-ecs-exec-logs"
  }
}

# ── KMS ──────────────────────────────────────────────────────────────────────
resource "aws_kms_key" "cloudwatch" {
  description             = "KMS key for CloudWatch logs encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "cove-${var.environment}-cloudwatch-kms"
  }
}

resource "aws_kms_alias" "cloudwatch" {
  name          = "alias/cove-${var.environment}-cloudwatch"
  target_key_id = aws_kms_key.cloudwatch.key_id
}

# ── IAM Roles ────────────────────────────────────────────────────────────────
resource "aws_iam_role" "ecs_execution" {
  name = "cove-${var.environment}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "cove-${var.environment}-ecs-execution"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "cove-${var.environment}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "cove-${var.environment}-ecs-task"
  }
}

resource "aws_iam_role_policy" "ecs_task" {
  name = "cove-${var.environment}-ecs-task-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
        ]
        Resource = "${aws_s3_bucket.vdr.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
        ]
        Resource = [
          aws_secretsmanager_secret.jwt.arn,
          aws_secretsmanager_secret.llm.arn,
          aws_secretsmanager_secret.sentry.arn,
        ]
      }
    ]
  })
}

# ── Service Discovery ────────────────────────────────────────────────────────
resource "aws_service_discovery_private_dns_namespace" "cove" {
  name        = "cove-${var.environment}.local"
  description = "Service discovery for Cove microservices"
  vpc         = aws_vpc.cove.id

  tags = {
    Name = "cove-${var.environment}-sd-namespace"
  }
}

resource "aws_service_discovery_service" "backend" {
  name = "backend"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.cove.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}
