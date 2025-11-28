# Pull Request

## Description

<!-- Provide a brief description of the changes in this PR -->

## Type of Change

<!-- Mark with 'x' all that apply -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Performance improvement
- [ ] Refactoring (no functional changes)
- [ ] Documentation update
- [ ] Dependency update
- [ ] CI/CD improvement
- [ ] Test coverage improvement

## Related Issues

<!-- Link related issues here, e.g., "Fixes #123" or "Related to #456" -->

- 

## Changes Made

<!-- Detailed list of changes -->

- 
- 
- 

## Testing

<!-- Describe the tests you ran to verify your changes -->

### Test Configuration

- OS: 
- Rust version: 
- Hardware (if relevant): 

### Tests Performed

- [ ] Unit tests pass (`cargo test`)
- [ ] Integration tests pass
- [ ] Manual testing performed
- [ ] Benchmarks run (if performance-related)
- [ ] Tested on multiple platforms (if applicable)

## Checklist

### Code Quality

- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

### Security & Dependencies

- [ ] I have reviewed the [DEPENDENCY_POLICY.md](../phoenix-kernel/DEPENDENCY_POLICY.md)
- [ ] No new unsafe code added (or justified if necessary)
- [ ] New dependencies are necessary and vetted
- [ ] Dependencies have compatible licenses (MIT, Apache-2.0, BSD, etc.)
- [ ] No GPL/AGPL dependencies introduced
- [ ] `cargo audit` passes with no warnings
- [ ] `cargo clippy` passes with no warnings
- [ ] `cargo fmt` has been run

### Documentation

- [ ] Code is properly documented with doc comments
- [ ] README updated (if applicable)
- [ ] CHANGELOG.md updated (if applicable)
- [ ] API documentation generated successfully
- [ ] Examples updated (if applicable)

### Performance & Quality

- [ ] No significant performance regressions
- [ ] Memory usage is acceptable
- [ ] Error handling is comprehensive
- [ ] Logging is appropriate and not excessive
- [ ] No obvious security vulnerabilities

## Performance Impact

<!-- If this PR affects performance, provide details -->

- [ ] No performance impact
- [ ] Performance improved
- [ ] Performance impact acceptable (explain why)

**Benchmark Results:** (if applicable)

```
<!-- Paste benchmark results here -->
```

## Breaking Changes

<!-- If this PR includes breaking changes, list them here with migration instructions -->

- [ ] No breaking changes
- [ ] Breaking changes documented below

**Breaking Changes:**

- 

**Migration Guide:**

```
<!-- Provide migration instructions for users -->
```

## Screenshots (if applicable)

<!-- Add screenshots to help explain your changes -->

## Additional Context

<!-- Add any other context about the PR here -->

## Deployment Notes

<!-- Notes on deploying this PR, if applicable -->

- [ ] Requires configuration changes
- [ ] Requires data migration
- [ ] Requires infrastructure changes
- [ ] Can be deployed independently

---

## Reviewer Checklist

<!-- For reviewers -->

- [ ] Code follows project conventions and style
- [ ] Changes are well-tested
- [ ] Documentation is complete and accurate
- [ ] Security implications considered
- [ ] Performance impact acceptable
- [ ] Breaking changes properly documented
- [ ] CI/CD checks passing