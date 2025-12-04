#!/bin/bash
# Cross-platform end-to-end tests for Phoenix AV Capture
# This script runs automated tests across Windows, macOS, and Ubuntu
# to ensure the AV capture functionality works correctly on all platforms.

set -eo pipefail

# Detect platform
detect_platform() {
  case "$(uname -s)" in
    Linux*)     PLATFORM="linux";;
    Darwin*)    PLATFORM="macos";;
    MINGW*|MSYS*|CYGWIN*) PLATFORM="windows";;
    *)          PLATFORM="unknown";;
  esac
  echo "Detected platform: $PLATFORM"
  
  if [[ "$PLATFORM" == "linux" ]]; then
    DISTRO=$(. /etc/os-release && echo $NAME)
    echo "Linux distribution: $DISTRO"
  fi
}

# Print test header
print_header() {
  echo "======================================================================"
  echo "= Phoenix AV Capture E2E Tests - $PLATFORM                           ="
  echo "======================================================================"
  echo "Time: $(date)"
  echo "----------------------------------------------------------------------"
}

# Run platform tests
run_platform_tests() {
  echo "Running platform-specific tests for $PLATFORM..."
  
  # Common tests
  run_common_tests
  
  # Platform-specific tests
  case "$PLATFORM" in
    windows)
      run_windows_tests
      ;;
    macos)
      run_macos_tests
      ;;
    linux)
      run_linux_tests
      ;;
    *)
      echo "⚠️ Unknown platform: $PLATFORM"
      echo "Only basic tests will be run"
      ;;
  esac
}

# Common tests that run on all platforms
run_common_tests() {
  echo "Running common tests..."
  
  echo "1. Testing basic audio capture..."
  cargo test --package phoenix-orch --test av_capture_test test_audio_recording_works_across_platforms -- --nocapture
  
  echo "2. Testing database encryption..."
  cargo test --package phoenix-orch --test av_capture_test test_encryption_and_database_security -- --nocapture
  
  echo "3. Testing conscience gate redaction..."
  cargo test --package phoenix-orch --test av_capture_test test_conscience_redaction_for_child_faces -- --nocapture
  
  echo "4. Testing transcription accuracy..."
  verify_transcription_accuracy
}

# Windows-specific tests
run_windows_tests() {
  echo "Running Windows-specific tests..."
  
  echo "1. Testing DirectShow integration..."
  cargo test --package phoenix-orch --features "windows-tests" --test av_capture_test test_windows_specific_audio_capture -- --nocapture
  
  echo "2. Testing Windows Media Foundation video capture..."
  cargo test --package phoenix-orch --features "windows-tests" --test av_capture_test test_windows_video_capture_with_mf -- --nocapture
  
  echo "3. Testing hardware acceleration with NVIDIA/AMD/Intel..."
  cargo test --package phoenix-orch --features "windows-tests" --test av_capture_test test_windows_hardware_acceleration -- --nocapture
}

# macOS-specific tests
run_macos_tests() {
  echo "Running macOS-specific tests..."
  
  echo "1. Testing CoreAudio integration..."
  cargo test --package phoenix-orch --features "macos-tests" --test av_capture_test test_macos_specific_audio_capture -- --nocapture
  
  echo "2. Testing AVFoundation video capture..."
  cargo test --package phoenix-orch --features "macos-tests" --test av_capture_test test_macos_avfoundation_video_capture -- --nocapture
  
  echo "3. Testing Metal hardware acceleration..."
  cargo test --package phoenix-orch --features "macos-tests" --test av_capture_test test_macos_metal_acceleration -- --nocapture
}

# Linux-specific tests
run_linux_tests() {
  echo "Running Linux-specific tests..."
  
  echo "1. Testing ALSA/PulseAudio/PipeWire integration..."
  cargo test --package phoenix-orch --features "linux-tests" --test av_capture_test test_linux_specific_audio_capture -- --nocapture
  
  echo "2. Testing V4L2/GStreamer video capture..."
  cargo test --package phoenix-orch --features "linux-tests" --test av_capture_test test_linux_v4l2_video_capture -- --nocapture
  the
  echo "3. Testing VAAPI/NVENC hardware acceleration..."
  cargo test --package phoenix-orch --features "linux-tests" --test av_capture_test test_linux_hardware_acceleration -- --nocapture
}

# Transcription accuracy verification
verify_transcription_accuracy() {
  echo "Testing transcription accuracy..."
  
  # Run the transcription test with sample audio files
  cargo test --package phoenix-orch --test av_capture_test transcription_accuracy_test -- --nocapture
  
  # Check the reported accuracy
  local accuracy=$(grep "Transcription accuracy:" test_results.log | awk '{print $3}')
  # Remove the percent sign if present
  accuracy=${accuracy/\%/}
  
  echo "Measured transcription accuracy: $accuracy%"
  
  # Verify it's above 98%
  if (( $(echo "$accuracy >= 98.0" | bc -l) )); then
    echo "✅ Transcription accuracy is above 98% threshold"
  else
    echo "❌ Transcription accuracy is below 98% threshold"
    echo "FAIL: Transcription accuracy test failed"
    return 1
  fi
}

# Run frontend integration tests
run_frontend_tests() {
  echo "Running frontend integration tests..."
  
  cd frontend
  npm test tests/av_capture_integration.test.tsx
  cd ..
}

# Generate comprehensive test report
generate_report() {
  echo "Generating test report..."
  
  cat > test-report.md << EOL
# Phoenix AV Capture E2E Test Report

- **Platform:** $PLATFORM
- **Date:** $(date)
- **Version:** $(cat VERSION || echo "Unknown")

## Test Results

### Common Tests
- Audio Capture: ${COMMON_TEST_RESULTS[0]}
- Encryption: ${COMMON_TEST_RESULTS[1]}
- Conscience Redaction: ${COMMON_TEST_RESULTS[2]}
- Transcription Accuracy: ${COMMON_TEST_RESULTS[3]}

### Platform-Specific Tests
- Test 1: ${PLATFORM_TEST_RESULTS[0]}
- Test 2: ${PLATFORM_TEST_RESULTS[1]}
- Test 3: ${PLATFORM_TEST_RESULTS[2]}

### Frontend Tests
- MemoryTheater Component: ${FRONTEND_TEST_RESULTS[0]}
- Timeline View: ${FRONTEND_TEST_RESULTS[1]}
- Vector Search: ${FRONTEND_TEST_RESULTS[2]}
- Playback Features: ${FRONTEND_TEST_RESULTS[3]}
- Tauri Integration: ${FRONTEND_TEST_RESULTS[4]}

## Cross-Platform Compatibility

- Windows 11: ${WINDOWS_COMPAT}
- macOS Sequoia: ${MACOS_COMPAT}
- Ubuntu 24.04: ${UBUNTU_COMPAT}

## Issues and Recommendations

${ISSUES}
EOL

  echo "Report generated: test-report.md"
}

# Main execution flow
main() {
  detect_platform
  print_header
  
  # Initialize results arrays
  COMMON_TEST_RESULTS=("Pending" "Pending" "Pending" "Pending")
  PLATFORM_TEST_RESULTS=("Pending" "Pending" "Pending")
  FRONTEND_TEST_RESULTS=("Pending" "Pending" "Pending" "Pending" "Pending")
  
  # Run the tests
  run_platform_tests
  run_frontend_tests
  
  # Generate the report
  generate_report
  
  echo "All tests completed."
}

# Execute the script
main "$@"