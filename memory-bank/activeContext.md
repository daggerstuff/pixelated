# Active Context

## Current Focus
Memory Bank system fully operational. Now providing perfect documentation foundation for all development activities. Establishing comprehensive custom commands and workflows for the Pixelated project.

## Recent Changes
- ✅ **Memory Bank System Complete**: All 6 core memory bank files created and configured
- ✅ **Custom Commands Framework**: Established command storage and workflow documentation
- ✅ **File-based Memory System**: Implemented comprehensive documentation system for session continuity
- ✅ **Documentation Standards**: Implemented comprehensive documentation system for session continuity

## Active Commands & Custom Workflows

### Custom Commands
You can create custom commands and workflows here in the Memory Bank. Here are some examples:

#### Quick Builds
- `npm run build:prod` - Production build with optimizations
- `npm run build:dev` - Development build with hot reload
- `npm run docker:build` - Build all docker containers

#### Development Workflows
- `git commit` - Always write descriptive commit messages
- `npm run lint:fix` - Auto-fix linting issues
- `npm run test:coverage` - Run tests with coverage report

#### Deployment Commands
- `kubectl apply -f k8s/` - Deploy to Kubernetes cluster
- `docker-compose up -d` - Start all services in detached mode
- `helm upgrade pixelated ./helm` - Deploy via Helm chart

#### Custom Aliases (Add your own here)
- `mb:update` - Update Memory Bank after significant changes
- `bias:check` - Run bias detection analysis on current code
- `security:audit` - Run security audit on the codebase

## Next Steps
1. Complete Memory Bank file setup
2. Test the context system
3. Customize commands based on project needs
4. Integrate with existing development workflows

## Important Reminders
- **Always read ALL Memory Bank files** at the start of tasks
- **Update activeContext.md** when discovering new patterns or creating custom commands
- **Document everything** to maintain perfect context across sessions
- **Test custom commands** thoroughly before relying on them

## Custom Context
This section is for project-specific context and custom instructions:

### Project Conventions
- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Run tests before committing
- Update documentation for significant changes

### Environment Notes
- Primary development happens in `/src` directory
- Python services are in `src/lib/ai/bias-detection/python-service/`
- Docker services are configured in `docker-compose.yml`
- Production deployments use Helm charts in `helm/` directory

### Common Workflows
1. Make changes to code
2. Run tests: `npm test`
3. Build: `npm run build`
4. Deploy: Check deployment guides in docs/

Add your custom commands and context here as needed for your specific workflow.
