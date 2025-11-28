# Phoenix Internal Libraries

This directory contains internal library crates used by the Phoenix AGI Kernel. These crates provide pure-Rust implementations or stubs for various functionalities, serving as controlled alternatives to external dependencies during the resurrection phase and beyond.

## Purpose

The `crates/` directory serves multiple critical functions:

1. **Dependency Control**: Provides internal implementations to avoid external crates that may be yanked, unmaintained, or introduce security vulnerabilities
2. **Build Stability**: Ensures the Phoenix kernel can always be built without relying on external crate availability
3. **Pure-Rust Profile**: Eliminates native dependencies (libtorch, OpenCV, etc.) for easier deployment and compilation
4. **API Stability**: Maintains consistent APIs even if external crate interfaces change
5. **Security Hardening**: Reduces attack surface by controlling all code in the dependency tree

## Current Crates

### lora-rs
- Version: 0.2.0
- Purpose: Stub implementation of LoRA (Low-Rank Adaptation) functionality
- Used by: incremental-learner
- Status: Minimal implementation providing type-safe no-op operations

### tch (stub)
- Version: 0.13.0
- Purpose: Pure-Rust stub for PyTorch functionality
- Used by: Multiple components
- Status: Provides basic tensor operations without libtorch dependency

## Structure and Organization

All internal crates follow this pattern:
- Located in `crates/<crate-name>/`
- Versioned to match any external crate being stubbed (if applicable)
- Patched in `phoenix-kernel/Cargo.toml` via `[patch.crates-io]`
- Pure Rust implementations (no native dependencies)
- Documented with clear limitations and purpose

## Adding New Internal Crates

When adding new internal crates to this directory:

1. **Create Directory Structure**:
   ```
   crates/<crate-name>/
   ├── Cargo.toml
   ├── README.md (optional but recommended)
   └── src/
       └── lib.rs
   ```

2. **Version Appropriately**:
   - If replacing an external crate, match its version number
   - If creating a new internal crate, start at 0.1.0

3. **Document Purpose and Limitations**:
   - Add a README.md explaining what the crate does
   - Document any differences from the crate being replaced
   - Note any limitations or stub behaviors

4. **Add to Workspace**:
   - If the crate should be a workspace member, add it to `phoenix-kernel/Cargo.toml` under `[workspace.members]`
   - This is typically only needed for crates that are directly built or tested

5. **Configure Patching**:
   - Add a `[patch.crates-io]` entry in `phoenix-kernel/Cargo.toml`:
     ```toml
     [patch.crates-io]
     crate-name = { path = "../crates/crate-name" }
     ```

6. **Add Tests**:
   - Include unit tests to verify stub behavior
   - Ensure tests pass in the pure-Rust environment

7. **Update This README**:
   - Add the new crate to the "Current Crates" section above
   - Document its purpose and which components use it

## Development Guidelines

### Code Quality
- All crates must be pure Rust implementations (no FFI or native dependencies)
- Follow Rust best practices and idioms
- Include proper error types and handling (use `thiserror` or similar)
- Add comprehensive documentation comments
- Maintain API compatibility with replaced external crates where possible

### Testing
- Include unit tests for all public APIs
- Test stub behavior matches expected semantics
- Verify error paths and edge cases
- Run tests with `cargo test --all` from the phoenix-kernel directory

### Documentation
- Document limitations during resurrection phase
- Explain differences from external crates being replaced
- Include examples in doc comments where helpful
- Update this README when adding new crates

### Security
- Review all code for security implications
- Avoid panics in production code (use `Result` types)
- Validate all inputs
- Follow the dependency policy documented in `DEPENDENCY_POLICY.md`

## Migration and Future Plans

As the Phoenix kernel matures, internal crates may evolve:

### Potential Evolution Paths
1. **Full Implementation**: Stub crates may gain full functionality over time
2. **External Publication**: Stable internal crates may be published to crates.io
3. **External Replacement**: Once external crates meet our security/stability criteria, we may switch back
4. **Permanent Internal**: Some crates may remain internal for security/control reasons

### Decision Criteria for External Dependencies
Before replacing an internal crate with an external one, verify:
- [ ] The external crate is actively maintained (commits within last 6 months)
- [ ] The crate has no known security vulnerabilities
- [ ] The crate follows semver and has a stable API
- [ ] The crate is not yanked or deprecated
- [ ] The crate has adequate test coverage
- [ ] The crate meets our dependency policy (see `DEPENDENCY_POLICY.md`)

### Current Status
During the resurrection phase, these internal crates serve as controlled dependencies to ensure:
- Build stability and reproducibility
- Freedom from native dependencies
- Clear understanding of all code paths
- Rapid iteration without external blockers

Refer to [`phoenix-kernel/DEPENDENCY_POLICY.md`](../phoenix-kernel/DEPENDENCY_POLICY.md) for the complete dependency management strategy.