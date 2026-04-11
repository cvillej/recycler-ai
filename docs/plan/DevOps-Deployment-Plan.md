# DevOps — Taskfile, Docker, Deployment

**Reference:** [Master-Implementation-Plan.md](../master-plan.md)

## Purpose

DevOps provides the automations, tooling, and environment standards needed to build, run, test, and deploy the agent system repeatably and securely—locally and in production.  
This layer removes “works on my machine” bottlenecks, enables full reproducibility, and ensures secrets/config are always managed securely.

---

## Scope

- All build, lint, test, dev, deploy, up/down/load, and CI tasks are automated by Taskfile.yml
- Docker Compose manages ephemeral local services like LangSmith and any future backend dependencies
- All secrets/config are ENV-driven; nothing secret or environment-specific is hardcoded or checked in

---

## Explicit Implementation Requirements

### 1. Taskfile Setup

**🟦 AGENT:**
- Create `Taskfile.yml` at the root.
- Each task is atomic, well-documented, and environment-agnostic (e.g., build, dev, lint, typecheck, test, up:all, down:all).
- Predefine common workflows:
    - `task dev` - Start project for local dev (Next.js + Docker Compose for LangSmith)
    - `task test` - Run all tests in CI-mode
    - `task lint` - Lint and typecheck code
    - `task up:langsmith` - Start LangSmith locally via Docker Compose
    - `task down:langsmith` - Stop LangSmith instance
    - `task deploy` - (future) Deploy to staging/prod via CI/CD or Vercel

#### Example:

```yaml
version: '3'

tasks:
  dev:
    cmds:
      - pnpm install
      - task up:langsmith
      - pnpm next dev
    desc: Start local development mode

  test:
    cmds:
      - pnpm test
    desc: Run all code/tests

  lint:
    cmds:
      - pnpm lint
      - pnpm tsc --noEmit
    desc: Lint and typecheck

  up:langsmith:
    cmds:
      - docker-compose up -d langsmith
    desc: Start LangSmith locally

  down:langsmith:
    cmds:
      - docker-compose down langsmith
    desc: Stop LangSmith service
```

**🟨 HUMAN:**
- Taskfile tasks must be documented and fully portable; no dev should need additional shell scripts for common jobs.

---

### 2. Docker & Compose

**🟦 AGENT:**
- Provide a `docker-compose.yml` for local stack development, with:
    - LangSmith service (env file for config, mapped volumes for persistence/config)
    - Optional future services (e.g., test DB, API mocks)
- Always use versioned images (never `:latest`).
- For prod Dockerfiles, build multi-stage, minimize secrets/context in built images, and trigger failure if ENV requirements are not met.

#### Example excerpt:

```yaml
version: "3.8"
services:
  langsmith:
    image: langchain/langsmith:0.2.45
    ports:
      - "1984:1984"
    environment:
      - LANGSMITH_API_KEY=${LANGSMITH_API_KEY}
      - LANGSMITH_DB_PATH=/data/db
    volumes:
      - ./data/langsmith:/data
```

**🟨 HUMAN:**
- Review and commit to a clean Docker/compose update workflow: version pinning, security scanning, regular upgrades.

---

### 3. Environment Variables and .env

**🟦 AGENT:**
- All secrets/config must be documented and templatized in `.env.example`, `.env.local` for dev, and never `.env` or any real secret in source control.
- All agents and services must pull config via environment reads.
- Add `.env` and any other secret/config files to `.gitignore`.

**🟨 HUMAN:**
- Security review of ENV usage is mandatory before prod deployments or CI/CD integration.

---

### 4. Production/CI Deployment

**🟦 AGENT:**
- Support all stages: local, preview/test, and prod (e.g., via Vercel, GH Actions, or another CI/CD)
- Future: automate most common deploy steps (static analysis, canary/promote flows, ENV pulling, etc.)
- Production images/services must never expose dev endpoints, debug logs, etc.

---

### 5. Testing DevOps Pipeline

**🟦 AGENT:**
- Add tests/CI checks for:
    - Environment completeness/override
    - LangSmith and other service startup/teardown (with logs)
    - All Taskfile, compose, and workflow recipes used in “smoke tests”

**🟨 HUMAN:**
- For each new major integration, do a full “clean machine” build and test run before merging or release.

---

### 6. Good / Bad Practice Callouts

**Good:**  
    - Agent/devs never have to guess ENV or setup steps—everything is in Taskfile/compose/docs.
    - LangSmith and any required local services are trivial to spin up or down.
    - No “works on my machine” failures.
    - All secrets are safe by automation and principle, not social practice.
**Bad:**  
    - People handwrite shell scripts or rely on README for manual setup.
    - Docker/compose is “half-setup”, or skips critical upgrade/test steps.
    - Real secrets or prod keys are ever exposed in source control or logs.

---

### 7. Links/References

- [Master-Implementation-Plan.md](../master-plan.md)
- [Agent-State-Implementation-Plan.md](Agent-State-Implementation-Plan.md)
- [Prompt-Registry-Contracts-Plan.md](Prompt-Registry-Contracts-Plan.md)
- [LangGraph-Orchestration-Plan.md](LangGraph-Orchestration-Plan.md)
- [Tool-Layer-Plan.md](Tool-Layer-Plan.md)

---

## ✅ Section 10 Complete: DevOps — Taskfile, Docker, Deployment
