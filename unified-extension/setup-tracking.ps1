# setup-tracking.ps1
# Re-downloads MediaPipe Tasks Vision files if needed.
# Run from the unified-extension directory:
#   powershell -ExecutionPolicy Bypass -File setup-tracking.ps1
#
# NOTE: These files are already included in the extension.
# Only run this if files are missing or you want to update to a newer version.

$ErrorActionPreference = "Stop"
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$wasmDir = Join-Path $base "lib\mediapipe\wasm"
$modelsDir = Join-Path $base "lib\mediapipe\models"

New-Item -ItemType Directory -Force -Path $wasmDir | Out-Null
New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null

$version = "0.10.18"
$cdnBase = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@$version"
$modelBase = "https://storage.googleapis.com/mediapipe-models"

$files = @(
    @{ url = "$cdnBase/vision_bundle.mjs";                     dest = "$wasmDir\vision_bundle.mjs" },
    @{ url = "$cdnBase/wasm/vision_wasm_internal.js";          dest = "$wasmDir\vision_wasm_internal.js" },
    @{ url = "$cdnBase/wasm/vision_wasm_internal.wasm";        dest = "$wasmDir\vision_wasm_internal.wasm" },
    @{ url = "$cdnBase/wasm/vision_wasm_nosimd_internal.js";   dest = "$wasmDir\vision_wasm_nosimd_internal.js" },
    @{ url = "$cdnBase/wasm/vision_wasm_nosimd_internal.wasm"; dest = "$wasmDir\vision_wasm_nosimd_internal.wasm" },
    @{ url = "$modelBase/face_landmarker/face_landmarker/float16/1/face_landmarker.task"; dest = "$modelsDir\face_landmarker.task" },
    @{ url = "$modelBase/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"; dest = "$modelsDir\hand_landmarker.task" }
)

Write-Host "`n=== MediaPipe Tracking Setup ===" -ForegroundColor Cyan

$ProgressPreference = 'SilentlyContinue'
foreach ($f in $files) {
    $name = Split-Path -Leaf $f.dest
    if (Test-Path $f.dest) {
        Write-Host "  [SKIP] $name (already exists)" -ForegroundColor DarkGray
        continue
    }
    Write-Host "  [DOWN] $name ..." -NoNewline
    try {
        Invoke-WebRequest -Uri $f.url -OutFile $f.dest -UseBasicParsing
        $size = [math]::Round((Get-Item $f.dest).Length / 1KB, 1)
        Write-Host " OK (${size} KB)" -ForegroundColor Green
    } catch {
        Write-Host " FAILED: $_" -ForegroundColor Red
    }
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host "Reload the extension in chrome://extensions`n"
