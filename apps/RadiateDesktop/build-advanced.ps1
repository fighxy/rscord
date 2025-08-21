# Advanced Build Script for RSCord Desktop
# Run this script as Administrator for best results

param(
    [switch]$Clean,
    [switch]$Release,
    [switch]$SkipTests,
    [string]$Target = "all"
)

Write-Host "🚀 RSCord Desktop Advanced Build Script" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Function to check if command exists
function Test-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# Check prerequisites
Write-Host "`n📋 Checking prerequisites..." -ForegroundColor Yellow

$prerequisites = @{
    "Node.js" = Test-Command "node"
    "npm" = Test-Command "npm"
    "Rust" = Test-Command "rustc"
    "Cargo" = Test-Command "cargo"
}

$missing = @()
foreach ($prereq in $prerequisites.GetEnumerator()) {
    if ($prereq.Value) {
        Write-Host "✅ $($prereq.Key)" -ForegroundColor Green
    } else {
        Write-Host "❌ $($prereq.Key)" -ForegroundColor Red
        $missing += $prereq.Key
    }
}

if ($missing.Count -gt 0) {
    Write-Host "`n❌ Missing prerequisites: $($missing -join ', ')" -ForegroundColor Red
    Write-Host "Please install the missing tools and try again." -ForegroundColor Red
    exit 1
}

# Check Tauri CLI
Write-Host "`n🔧 Checking Tauri CLI..." -ForegroundColor Yellow
if (-not (Test-Command "tauri")) {
    Write-Host "Installing Tauri CLI globally..." -ForegroundColor Yellow
    npm install -g @tauri-apps/cli
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install Tauri CLI" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Tauri CLI already installed" -ForegroundColor Green
}

# Clean build if requested
if ($Clean) {
    Write-Host "`n🧹 Cleaning previous builds..." -ForegroundColor Yellow
    if (Test-Path "node_modules") {
        Remove-Item -Recurse -Force "node_modules"
    }
    if (Test-Path "dist") {
        Remove-Item -Recurse -Force "dist"
    }
    if (Test-Path "src-tauri/target") {
        Remove-Item -Recurse -Force "src-tauri/target"
    }
}

# Install dependencies
Write-Host "`n📦 Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Build frontend
Write-Host "`n🏗️ Building frontend..." -ForegroundColor Yellow
if ($Release) {
    npm run build
} else {
    npm run build
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend build failed" -ForegroundColor Red
    exit 1
}

# Build Tauri application
Write-Host "`n⚙️ Building Tauri application..." -ForegroundColor Yellow
$buildArgs = @("build")
if ($Release) {
    $buildArgs += "--release"
}

tauri $buildArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Tauri build failed" -ForegroundColor Red
    exit 1
}

# Show results
Write-Host "`n🎉 Build completed successfully!" -ForegroundColor Green
Write-Host "`n📁 Installers can be found in:" -ForegroundColor Cyan

$bundlePath = "src-tauri/target/release/bundle"
if (Test-Path $bundlePath) {
    Get-ChildItem -Path $bundlePath -Recurse -Include "*.msi", "*.exe", "*.deb", "*.AppImage", "*.dmg" | ForEach-Object {
        $size = [math]::Round($_.Length / 1MB, 2)
        Write-Host "  📦 $($_.Name) ($size MB)" -ForegroundColor White
    }
} else {
    Write-Host "  ❌ No bundle directory found" -ForegroundColor Red
}

Write-Host "`n✨ Build process completed!" -ForegroundColor Green
