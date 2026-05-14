# trivy-azure-pipelines-task

Custom Azure DevOps pipeline task that wraps Trivy container and IaC security scanning. Published as a private ADO Marketplace extension for use across all InfoTrack pipelines.

## Repository Structure

- `ui/` — Task UI configuration (task.json, inputs definition)
- `scripts/` — PowerShell/Bash scripts that the task executes
- `vss-extension.json` — ADO extension manifest
- `Makefile` — Build, package, and publish targets

## Key Conventions

- Task version follows semantic versioning (`major.minor.patch`) in `task.json`
- Breaking changes to task inputs require a new major version — old tasks in pipelines must continue to work
- Trivy configuration is passed through as task parameters; defaults are set conservatively (fail on HIGH+CRITICAL)
- The task must work on both Linux and Windows ADO agents

## Common Tasks

```bash
make build      # Compile/lint scripts and UI
make package    # Create .vsix extension package
make publish    # Publish to ADO Marketplace (requires PAT)
make test       # Run unit tests for the task scripts
```

## Notes

- Default branch: `main`
- The task is referenced by `azure.devops.templates/trivy/` — coordinate version bumps across both repos
- Extension publisher ID is in `vss-extension.json`; do not change without updating all pipeline references
