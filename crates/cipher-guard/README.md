# Cipher Guard Module

Cipher Guard provides defensive security capabilities for the Phoenix ORCH system, including disk encryption, knowledge base management, and file operations.

## Features

### Full Disk Encryption

Secure encryption for local and network drives using industry-standard encryption algorithms:

- Enable full disk encryption on drives
- Check encryption status
- List encrypted drives
- Mount and unmount encrypted drives

### Knowledge Base

Search and retrieve information from structured knowledge repositories:

- Search knowledge bases with natural language queries
- Support for exact phrase matching
- Context-aware search results

### Desktop File Operations

Securely write files to the user's Desktop using natural language commands:

- Write files to the Desktop using simple commands
- Cross-platform compatibility (Windows, macOS, Linux)
- Path traversal prevention and security validation
- Integration with ethical framework for operation validation

## Usage Examples

### Disk Encryption

```
"Enable full disk encryption on Z:"
"Check encryption status of D:"
"List all encrypted drives"
"Mount encrypted drive E: with password my_secure_password"
"Unmount encrypted drive E:"
```

### Knowledge Base

```
"Search my security KB for vulnerability management"
"Find OWASP Top 10 in my application security KB"
"Lookup AES encryption in my crypto KB"
```

### Desktop File Operations

```
"Write a file called notes.txt to my Desktop"
"Create a file test.json on my Desktop with content {\"key\": \"value\"}"
"Save a file report.md to my Desktop with content # Report Heading"
"Write Hello World to a file called hello.txt on my Desktop"
```

## Implementation Details

### Desktop Path Resolver

The `DesktopPathResolver` provides cross-platform resolution of the user's Desktop directory:

- Uses standard directory APIs when available
- Falls back to platform-specific methods when needed
- Validates paths to prevent traversal attacks
- Ensures write permissions before operations

### File System Service

Handles file operations with security and ethical constraints:

- Validates filenames for security
- Prevents path traversal attempts
- Checks operations against ethical framework
- Handles platform-specific file system differences
- Provides detailed error information

### Ethical Validation

All file operations are validated through the ethical framework:

- Evaluates impact on data, system, privacy, and operations
- Applies safeguards appropriate to the operation
- Enforces desktop-only scope for file operations
- Tracks user attribution for audit purposes

## Security Considerations

- All file operations are limited to the Desktop directory
- Path canonicalization prevents directory traversal
- Filenames are validated to prevent security issues
- Operations are tracked and attributable to users
- Write permissions are verified before file creation