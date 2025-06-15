# Contributing to XLS Converter

Thank you for considering contributing to the XLS Converter project! Your help is essential for making this tool better for everyone.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue with the following information:

1. A clear, descriptive title
2. Steps to reproduce the issue
3. Expected behavior
4. Actual behavior
5. Screenshots (if applicable)
6. Environment details (OS, browser, Node.js version, etc.)
7. Any additional context

### Suggesting Features

We welcome feature suggestions! To suggest a feature:

1. Check existing issues to see if your feature has been requested
2. Create a new issue with a clear title and detailed description
3. Explain why this feature would be useful to users
4. Describe how the feature might work

### Pull Requests

We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure your code passes all tests (`npm test`)
5. Make sure your code lints (`npm run lint`)
6. Submit your pull request!

### Development Process

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Run tests: `npm test`
6. Commit with a descriptive message
7. Push to your fork
8. Submit a pull request

## Testing

We value testing and aim for high code coverage. Please ensure your contributions include appropriate tests. We use Vitest as our testing framework:

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Development Workflow

For development, you'll need to start the services in this order:

```bash
# Start everything (Python service and Node.js wrapper) at once
npm start

# Or start each service separately:

# 1. Start the Python conversion service
npm run start:python

# 2. Start the Node.js wrapper service (in another terminal)
npm run start:node

# 3. Start the client (in another terminal)
npm run start:client
```

For Docker-based development:

```bash
# Build the Docker container
npm run docker:build

# Start the services using Docker
npm run docker:up

# Stop the Docker services
npm run docker:down
```

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests after the first line

## Documentation

Documentation is crucial for this project. If you change functionality, please update:

1. README.md for general usage
2. API documentation if endpoints change
3. JSDoc comments for functions
4. Example code if applicable

## Security

Security is a priority for XLS/XLSX conversion. Please ensure your code:

1. Guards against formula injection
2. Handles file uploads securely
3. Implements proper validation
4. Does not introduce vulnerabilities

If you find a security vulnerability, please email security@example.com rather than opening a GitHub issue.

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).

## Questions?

Don't hesitate to create an issue or contact the maintainers if you have any questions about contributing.

Thank you for your interest in improving the XLS Converter!
