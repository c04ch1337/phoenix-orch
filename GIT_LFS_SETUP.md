# Git LFS Setup for Large Files

This repository uses **Git LFS (Large File Storage)** to handle files larger than GitHub's 50MB limit.

## What is Git LFS?

Git LFS stores large files on a separate server and replaces them with text pointers in your Git repository. This keeps your repository size manageable while still version-controlling large files.

## Current Configuration

The `.gitattributes` file is configured to automatically track:

- **Database files**: `.db`, `.snap`, `.conf` files in data directories
- **ML/AI Models**: `.onnx`, `.pt`, `.pth`, `.pkl`, `.h5`, `.pb`, `.tflite`, `.bin`, `.safetensors`, `.gguf`, `.ggml`
- **Archives**: `.zip`, `.tar.gz`, `.tar`, `.7z`, `.rar`
- **Media files**: `.mp4`, `.avi`, `.mov`, `.wav`, `.mp3`, `.flac`
- **Data files**: `.csv`, `.parquet`, `.feather`, `.arrow`

## Usage

### Initial Setup (Already Done)

```bash
git lfs install
```

### Adding Large Files

1. **Automatic tracking**: Files matching patterns in `.gitattributes` are automatically tracked
2. **Manual tracking**: For specific files or patterns not covered:

```bash
git lfs track "*.your-extension"
git add .gitattributes
```

### Committing Large Files

```bash
# Add files normally - Git LFS handles them automatically
git add large-file.bin
git commit -m "Add large file"
git push
```

### Migrating Existing Large Files

If you have large files already committed to Git history:

```bash
# 1. Track the file type
git lfs track "*.your-extension"

# 2. Migrate existing files in history
git lfs migrate import --include="*.your-extension" --everything

# 3. Force push (coordinate with team first!)
git push --force --all
```

### Checking LFS Status

```bash
# List files tracked by LFS
git lfs ls-files

# Check LFS status
git lfs status
```

### Downloading LFS Files

When cloning or pulling, LFS files are automatically downloaded. If needed manually:

```bash
git lfs pull
```

## GitHub Limits

- **Free accounts**: 1 GB storage, 1 GB bandwidth/month
- **Pro accounts**: 50 GB storage, 50 GB bandwidth/month
- **Team accounts**: 50 GB storage, 50 GB bandwidth/month

## Best Practices

1. **Don't commit build artifacts**: Keep `target/`, `node_modules/`, etc. in `.gitignore`
2. **Use LFS for models**: All ML model files should use LFS
3. **Monitor storage**: Check GitHub repository settings for LFS usage
4. **Coordinate migrations**: If migrating existing files, coordinate with your team

## Troubleshooting

### File still too large after LFS setup

```bash
# Check if file is tracked
git lfs ls-files | grep your-file

# If not, track it explicitly
git lfs track "your-file"
git add your-file .gitattributes
```

### LFS files not downloading

```bash
# Pull LFS files explicitly
git lfs pull

# Or clone with LFS
git lfs clone <repository-url>
```

### Remove file from LFS tracking

```bash
# Remove from .gitattributes
# Then remove from LFS cache
git lfs untrack "*.extension"
```

## Resources

- [Git LFS Documentation](https://git-lfs.github.com/)
- [GitHub LFS Documentation](https://docs.github.com/en/repositories/working-with-files/managing-large-files)
- [Git LFS Tutorial](https://github.com/git-lfs/git-lfs/wiki/Tutorial)

