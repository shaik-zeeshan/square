# Contributing to SReal

Thank you for your interest in contributing to SReal! This document provides guidelines for contributing to the project.

## 🚀 Quick Start

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Commit using conventional commits (see below)
5. Push to your fork: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📝 Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/) to automatically generate changelogs and version releases.

### Format
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to our CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Examples

```bash
# New feature
git commit -m "feat: add video player controls"

# Bug fix
git commit -m "fix: resolve MPV library loading issue"

# Breaking change
git commit -m "feat!: redesign video player API

BREAKING CHANGE: The video player API has been completely redesigned.
Old methods are no longer available."

# With scope
git commit -m "feat(video): add subtitle support"

# Multiple types
git commit -m "feat: add new feature

- Add video controls
- Add subtitle support
- Add keyboard shortcuts

Closes #123"
```

## 🏷️ Release Process

### Automatic Releases

Releases are automatically triggered when you commit with "release" in the message:

```bash
git commit -m "feat: add new video player - release"
git push origin main
```

This will:
1. Build the application for macOS
2. Generate a changelog from your commits
3. Create a GitHub release with the changelog
4. Upload DMG and app bundle artifacts

### Manual Changelog Generation

To generate a changelog locally:

```bash
# Generate changelog from all commits
bun run changelog

# Generate changelog for version bump
bun run version
```

## 🧪 Testing

Before submitting a PR, please ensure:

- [ ] Your code compiles without errors
- [ ] All tests pass
- [ ] You've tested on your target platform
- [ ] Your commit messages follow conventional commits format

## 📋 Pull Request Guidelines

1. **Title**: Use conventional commit format
2. **Description**: Explain what changes you made and why
3. **Screenshots**: Include screenshots for UI changes
4. **Testing**: Describe how you tested your changes
5. **Breaking Changes**: Clearly mark any breaking changes

### PR Title Examples
- `feat: add video player controls`
- `fix: resolve MPV library loading issue`
- `docs: update installation instructions`

## 🎯 Development Workflow

### Local Development

```bash
# Install dependencies
bun install

# Setup MPV libraries
make download-dylibs

# Start development server
make dev

# Build for testing
make build-app
```

### Code Style

We use:
- **Biome** for linting and formatting
- **Conventional Commits** for commit messages
- **TypeScript** for type safety
- **Tailwind CSS** for styling

### Git Hooks

Husky is configured to run:
- Pre-commit: Biome linting and formatting
- Pre-push: Type checking and tests

## 🐛 Bug Reports

When reporting bugs, please include:

1. **OS and Version**: macOS 14.0, Windows 11, etc.
2. **App Version**: The version you're running
3. **Steps to Reproduce**: Clear, numbered steps
4. **Expected Behavior**: What should happen
5. **Actual Behavior**: What actually happens
6. **Screenshots**: If applicable
7. **Logs**: Any error messages or logs

## 💡 Feature Requests

When requesting features, please include:

1. **Use Case**: Why do you need this feature?
2. **Proposed Solution**: How should it work?
3. **Alternatives**: Other solutions you've considered
4. **Additional Context**: Any other relevant information

## 📄 License

By contributing to SReal, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You

Thank you for contributing to SReal! Your contributions help make this project better for everyone.
