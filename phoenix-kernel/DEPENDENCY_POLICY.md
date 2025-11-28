# Dependency Policy

This document outlines the Phoenix AGI Kernel's approach to dependency management, emphasizing security, stability, and reproducibility.

## Philosophy

The Phoenix kernel adopts a **security-first, stability-focused** dependency strategy. We prefer controlled internal implementations over external dependencies when security, maintainability, or build stability are concerns.

### Core Principles

1. **Minimize Attack Surface**: Every external dependency increases the potential attack surface and supply chain risk
2. **Build Reproducibility**: The kernel must build reliably across environments and over time
3. **Pure-Rust Profile**: Avoid native dependencies (C/C++ libraries) when possible to simplify deployment
4. **Explicit Trust**: All code in the dependency tree should be reviewed and understood
5. **Graceful Degradation**: Stubs allow the system to compile and operate even without full functionality

## Internal vs External Dependencies

### When to Use Internal Crates (crates/)

Use an internal stub or implementation when:

- [x] The external crate has native dependencies (libtorch, OpenCV, CUDA, etc.)
- [x] The external crate is unmaintained (no commits in 12+ months)
- [x] The external crate has known security vulnerabilities
- [x] The external crate has been yanked or deprecated
- [x] The functionality is simple enough to implement internally
- [x] The external crate's API is unstable or changes frequently
- [x] We need only a subset of the crate's functionality
- [x] The crate is critical to security or safety operations

### When to Use External Dependencies

Use external crates when:

- [x] The crate is well-maintained and actively developed
- [x] The crate has a strong security track record
- [x] The crate is widely used in the Rust ecosystem
- [x] The functionality is complex and well-tested externally
- [x] The crate follows semantic versioning strictly
- [x] The crate has no native dependencies (or they're acceptable)
- [x] The crate is maintained by a trusted organization or individual

### Current Internal Crates

See [`../crates/README.md`](../crates/README.md) for the complete list. Key examples:

| Crate | Reason for Internal Implementation |
|-------|-----------------------------------|
| `lora-rs` | External crate doesn't exist or was yanked; provides controlled LoRA API |
| `tch` | Eliminates libtorch dependency; pure-Rust tensor operations for resurrection phase |

## Dependency Vetting Process

### Adding a New External Dependency

Before adding any external crate to `[workspace.dependencies]`:

1. **Security Audit**:
   - Check for known vulnerabilities using `cargo audit`
   - Review the crate's dependencies transitively
   - Verify the crate hasn't been yanked
   - Check for security advisories

2. **Maintenance Review**:
   - Verify recent commits (within last 6 months for active development)
   - Check issue response time and resolution rate
   - Review the maintainer's track record
   - Verify the project has active community support

3. **Code Quality Assessment**:
   - Review test coverage and CI configuration
   - Check for use of `unsafe` code (and its justification)
   - Verify the crate follows Rust best practices
   - Assess documentation quality

4. **License Compatibility**:
   - Ensure the license is compatible with Phoenix's MIT license
   - Check all transitive dependencies for license compatibility

5. **API Stability**:
   - Review semver compliance history
   - Check for breaking changes in recent releases
   - Verify the crate has reached 1.0 or has a stable API

6. **Build Compatibility**:
   - Test that the crate builds on all target platforms
   - Verify no native dependencies are required (unless acceptable)
   - Check compile time impact

### Upgrading Dependencies

When upgrading existing dependencies:

1. Review the CHANGELOG for breaking changes
2. Check for new security advisories
3. Test the upgrade in a separate branch
4. Update any affected code or configurations
5. Run full test suite before merging

### Removing Dependencies

When considering removing a dependency:

1. Assess the impact on functionality
2. Consider creating an internal stub if needed
3. Update documentation to reflect changes
4. Verify all users of the dependency are updated

## CI Enforcement

### Automated Checks

The CI pipeline enforces the following policies using tools like `cargo-deny`:

1. **No Yanked Crates**:
   - Fails the build if any dependency has been yanked
   - Prevents builds from breaking due to upstream removals

2. **No Known Vulnerabilities**:
   - Uses RustSec advisory database via `cargo audit`
   - Fails on HIGH or CRITICAL vulnerabilities
   - Warns on MEDIUM vulnerabilities

3. **No Unsound Code** (where detectable):
   - Checks for known unsound patterns in dependencies
   - Reviews crates flagged by the Rust community

4. **License Compliance**:
   - Verifies all dependencies have approved licenses
   - Rejects copyleft licenses unless explicitly approved

### Configuration

The workspace metadata in [`Cargo.toml`](Cargo.toml) defines the policy:

```toml
[workspace.metadata]
# Forward-looking dependency policy for CI (e.g. cargo-deny)
# CI is expected to enforce:
# - No yanked dependencies
# - No known-vulnerable crates
# - No unsound or unmaintained critical dependencies
deny = ["yanked", "unsound", "vulnerable-code"]
```

### Future CI Setup

To fully implement this policy, add to `.github/workflows/ci.yml` (or equivalent):

```yaml
- name: Check dependencies
  run: |
    cargo install cargo-deny
    cargo deny check
    
- name: Security audit
  run: |
    cargo install cargo-audit
    cargo audit --deny warnings
```

## Migration Path for External Dependencies

### Phase 1: Resurrection (Current)

- **Goal**: Get the kernel building and running with minimal external dependencies
- **Approach**: Use internal stubs for all complex or native-dependent crates
- **Status**: `tch`, `lora-rs` are stubbed; perception crates use pure-Rust mocks

### Phase 2: Stabilization

- **Goal**: Replace stubs with working implementations where needed
- **Approach**: 
  - Gradually implement full functionality in internal crates
  - Consider external crates that meet our security criteria
  - Maintain backwards compatibility with stub APIs

### Phase 3: Production Hardening

- **Goal**: Optimize for production deployment
- **Approach**:
  - Evaluate performance of internal vs external implementations
  - Make informed decisions about which dependencies to keep internal
  - Publish stable internal crates that may benefit others

### Phase 4: Long-term Maintenance

- **Goal**: Maintain a secure, stable dependency tree
- **Approach**:
  - Regularly audit dependencies
  - Update to patched versions quickly
  - Contribute to external crates where possible
  - Keep internal implementations as fallbacks

## Replacing Internal Crates with External Ones

Before replacing an internal crate with an external dependency:

1. **Verify the External Crate Meets Criteria**:
   - Follow the "Adding a New External Dependency" process above
   - Ensure it meets all security and maintenance requirements
   - Verify performance is acceptable

2. **Update Configuration**:
   - Remove the `[patch.crates-io]` entry in `Cargo.toml`
   - Update version requirements in `[workspace.dependencies]`
   - Remove the internal crate from `crates/` if no longer needed

3. **Update Documentation**:
   - Update `crates/README.md` to remove the crate
   - Update this document with the rationale for switching
   - Document any API changes required

4. **Test Thoroughly**:
   - Run full test suite
   - Verify functionality matches previous implementation
   - Test on all target platforms
   - Performance benchmarking if relevant

5. **Monitor Post-Migration**:
   - Watch for issues in the first few releases
   - Monitor the external crate for changes
   - Keep the internal implementation as a reference

## Decision Matrix

Use this matrix to decide between internal vs external dependencies:

| Factor | Internal | External |
|--------|----------|----------|
| Native dependencies required | ✅ Prefer | ❌ Avoid |
| Complex, well-tested logic | ❌ Avoid | ✅ Prefer |
| Security-critical functionality | ✅ Prefer | ⚠️ Careful |
| Frequently changing APIs | ✅ Prefer | ❌ Avoid |
| Simple, stable functionality | ⚠️ Either | ✅ Prefer |
| Widely-used ecosystem crate | ❌ Avoid | ✅ Prefer |
| Unmaintained upstream | ✅ Prefer | ❌ Avoid |

## Exceptions

Exceptions to this policy must be:
1. Documented in this file with clear rationale
2. Approved by project maintainers
3. Time-limited with a review date

### Current Exceptions

None at this time.

## Resources

- RustSec Advisory Database: https://rustsec.org/
- cargo-deny: https://github.com/EmbarkStudios/cargo-deny
- cargo-audit: https://github.com/RustSec/rustsec/tree/main/cargo-audit
- Rust Security Response WG: https://www.rust-lang.org/governance/wgs/wg-security-response

## Updates

This policy is a living document. Updates should be:
- Committed with clear rationale
- Reviewed by project maintainers
- Announced to the team

---

**Last Updated**: 2025-11-28  
**Policy Version**: 1.0.0  
**Contact**: Phoenix Project Team