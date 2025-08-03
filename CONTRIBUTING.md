# Contributing to Decentralized Video App

## Development Workflow

### Prerequisites
- Node.js v16.x or higher
- npm 8.x or higher
- Git
- Modern web browser with WebRTC support

### Setup
1. Fork the repository
2. Clone your forked repository
3. Install dependencies: `npm install`
4. Copy `.env.example` to `.env`
5. Start development servers:
   - Frontend: `npm run dev`
   - Signaling Server: `node signaling-server.js`

### Contribution Steps
1. Create a new branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Run linting: `npm run lint`
4. Commit with a descriptive message
5. Push to your fork
6. Open a pull request

### Code Quality Guidelines
- Follow existing code style
- Add comprehensive error handling
- Write meaningful comments
- Use React hooks and functional components
- Implement proper prop type validation
- Ensure cross-browser compatibility

### Testing
- Add unit tests for new components
- Ensure 100% test coverage for critical paths
- Use React Testing Library
- Test WebRTC connection scenarios

### Performance Considerations
- Optimize rendering with React.memo
- Minimize unnecessary re-renders
- Use performance profiling tools
- Test with multiple participant scenarios

### Security Best Practices
- Sanitize all user inputs
- Use environment variables for sensitive config
- Implement proper error boundaries
- Follow WebRTC security recommendations

### Review Process
- All PRs require review from two maintainers
- CI checks must pass
- Provide detailed description of changes
- Include screenshots for UI modifications

### Reporting Issues
1. Check existing issues
2. Provide detailed description
3. Include reproduction steps
4. Share browser/system details
5. Attach console logs or error messages

### Code of Conduct
- Be respectful and inclusive
- Constructive feedback only
- Collaborate and support each other