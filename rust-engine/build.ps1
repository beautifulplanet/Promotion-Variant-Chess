# Build script for Chess Engine WASM
# Run: .\build.ps1

Write-Host "🦀 Building Chess Engine..." -ForegroundColor Cyan

# Check if wasm-pack is installed
if (!(Get-Command wasm-pack -ErrorAction SilentlyContinue)) {
    Write-Host "❌ wasm-pack not found. Installing..." -ForegroundColor Yellow
    cargo install wasm-pack
}

# Build for web target
Write-Host "📦 Compiling to WebAssembly..." -ForegroundColor Yellow
wasm-pack build --target web --out-dir ../public/wasm

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build successful!" -ForegroundColor Green
    Write-Host "📁 Output: public/wasm/" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To use in TypeScript:" -ForegroundColor Cyan
    Write-Host "  import init, { ping, new_game } from './wasm/chess_engine.js';" -ForegroundColor White
    Write-Host "  await init();" -ForegroundColor White
    Write-Host "  console.log(ping());" -ForegroundColor White
} else {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}
