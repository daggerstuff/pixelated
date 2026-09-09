# Pixelated Empathy AWS EKS migration

Replacement for the failed Civo K3s deployment. Target is a managed EKS
cluster with the existing Traefik ingress policy preserved and the same
Docker Hub image pipeline.

## Target shape

- EKS managed node group: 2 x `t3.medium`, gp3 volumes
- Traefik v3 ingress controller, internet-facing NLB
- Cloudflare Origin CA certificate terminates TLS at Traefik
- App blue/green deployments plus session/qa/pipeline agents
- Umami analytics on `analytics.pixelatedempathy.com`

## GitHub secrets

The `aws` environment secrets were configured with `gh-axi secret set`:

- `AWS_REGION` — currently `us-west-2`
- `EKS_CLUSTER_NAME`

The remaining values are already available as repository secrets:

- `AWS_DEPLOY_ROLE_ARN` — OIDC role with EKS, EC2, VPC, IAM, and CloudFormation permissions
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `JWT_SECRET`
- `MONGODB_URI`
- `DATABASE_URL`
- `REDIS_URL`
- `REDIS_PASSWORD`
- `UMAMI_DATABASE_URL`
- `UMAMI_APP_SECRET`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_AI_API_KEY`
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `LINEAR_AGENT_ACCESS_TOKEN`
- `LINEAR_WEBHOOK_SECRET`
- `EVE_AUTH_USERNAME`
- `EVE_AUTH_PASSWORD`

Traefik uses its default self-signed certificate for the origin TLS link.
Cloudflare SSL mode must be **Full**, not **Full (strict)**.

## First run

1. Configure GitHub OIDC trust between the repo and the AWS role.
2. Run `Provision AWS EKS` from the Actions tab.
3. Run `Deploy to AWS EKS` after provisioning finishes.
4. Copy the NLB hostname from the final `Show DNS target` step.
5. In Cloudflare, update these DNS-only CNAME records:
   - `pixelatedempathy.com` -> NLB hostname
   - `www.pixelatedempathy.com` -> NLB hostname
   - `analytics.pixelatedempathy.com` -> NLB hostname
6. Set Cloudflare SSL/TLS mode to **Full**. Traefik terminates TLS with its
   default self-signed certificate.
7. Smoke test `https://pixelatedempathy.com/health` and the public homepage.

The provision workflow is one-time. Do not rerun it unless the cluster was
deleted. The deploy workflow is idempotent.

## Post-cutover

- After DNS is confirmed stable, disable the Civo deploy workflow:
  `.github/workflows/deploy-civo.yml`.
- Re-point any external Postgres, Redis, or MongoDB clients to allowlist the
  EKS node egress IPs. The deploy workflow already carries `DATABASE_URL`,
  `REDIS_URL`, and `MONGODB_URI` through, so no database move is required on
  day one.
- Upgrade origin TLS later by adding a Cloudflare Origin CA certificate or a
  Let's Encrypt resolver, then switch Cloudflare to **Full (strict)**.
