# Task Completion Checklist for Pixelated Empathy

1. Format code (JS/TS: `pnpm format`, Python: `black .`)
2. Lint code (JS/TS: `pnpm lint`, Python: `ruff .`)
3. Run unit/integration/E2E tests (`pnpm test`, `pnpm e2e`, `python -m pytest`)
4. Check type safety (`pnpm typecheck`, `pyright .`, `mypy .`)
5. Validate security (`pnpm security:scan`, `pnpm security:check`)
6. Update documentation
7. Ensure compliance (HIPAA, privacy)
8. Push changes to develop/master branch
9. Monitor CI/CD pipeline (Gitlab, Github Actions)

## References
- See `README.md`, `package.json`, `pyproject.toml`, `.gitlab-ci.yml` for more details.
