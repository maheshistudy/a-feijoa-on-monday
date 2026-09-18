<#
  verify.ps1 — headless verification of the book (Windows, Edge).

  1. index.html?selftest=1  → prints the in-page report; the title must be TEST PASS
  2. a screenshot of the cover and every page → tools/out/shots/*.png + one contact sheet
  3. index.html?rotatecheck=1 in a portrait window → the rotate prompt must show

  Usage:  .\tools\verify.ps1                 # the working tree, from file://
          .\tools\verify.ps1 -Url https://maheshistudy.github.io/a-feijoa-on-monday/
          .\tools\verify.ps1 -Bundle         # dist/a-feijoa-on-monday.html from file://
          .\tools\verify.ps1 -NoShots        # self-test only
#>
param([string]$Url, [switch]$Bundle, [switch]$NoShots)

$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$OUT = "$PSScriptRoot\out"; $SHOTS = "$OUT\shots"
New-Item -ItemType Directory -Force $SHOTS | Out-Null
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe" }
if (-not $Url) {
  $file = if ($Bundle) { "$repo\dist\a-feijoa-on-monday.html" } else { "$repo\index.html" }
  $Url = 'file:///' + ($file -replace '\\', '/')
}
$sep = if ($Url -match '\?') { '&' } else { '?' }
$profile = "$env:TEMP\edge-feijoa-verify"

function Run-Edge($edgeArgs, $outFile, $timeoutMs = 240000) {
  $p = Start-Process $edge -PassThru -NoNewWindow -RedirectStandardOutput $outFile -ArgumentList (@('--headless=new','--disable-gpu','--no-first-run','--hide-scrollbars',"--user-data-dir=`"$profile`"") + $edgeArgs)
  if (-not $p.WaitForExit($timeoutMs)) { $p.Kill(); throw "Edge timed out: $edgeArgs" }
}

# ---- 1. self-test ----
Run-Edge @('--window-size=1400,1000','--virtual-time-budget=120000','--dump-dom',"`"$Url${sep}selftest=1`"") "$OUT\selftest-dom.txt"
$dom = Get-Content "$OUT\selftest-dom.txt" -Raw
$title = [regex]::Match($dom, '<title>([^<]*)</title>').Groups[1].Value
$rep = [regex]::Match($dom, '<pre id="test-report"[^>]*>([\s\S]*?)</pre>').Groups[1].Value
$rep = [System.Net.WebUtility]::HtmlDecode($rep)
"== self-test ($Url) =="
$rep
"title: $title"
$pass = $title -eq 'TEST PASS'

# ---- 2. screenshots ----
if (-not $NoShots) {
  Get-ChildItem $SHOTS -File | Remove-Item -Force
  Run-Edge @('--window-size=1400,990','--virtual-time-budget=2500',"--screenshot=`"$SHOTS\cover.png`"","`"$Url`"") "$OUT\shot.txt" 60000
  for ($i = 0; $i -lt 12; $i++) {
    Run-Edge @('--window-size=1400,990','--virtual-time-budget=6000',"--screenshot=`"$SHOTS\page-$('{0:D2}' -f ($i+1)).png`"","`"$Url${sep}page=$i&fast=1`"") "$OUT\shot.txt" 60000
  }
  Add-Type -AssemblyName System.Drawing
  $files = Get-ChildItem $SHOTS -Filter *.png | Sort-Object Name
  $cw = 466; $ch = 330; $cols = 4; $rows = [math]::Ceiling($files.Count / $cols)
  $sheet = New-Object System.Drawing.Bitmap ($cw * $cols), ($ch * $rows)
  $g = [System.Drawing.Graphics]::FromImage($sheet); $g.Clear([System.Drawing.Color]::Black); $g.InterpolationMode = 'HighQualityBicubic'
  $font = New-Object System.Drawing.Font 'Arial', 12
  $k = 0
  foreach ($f in $files) {
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    $x = ($k % $cols) * $cw; $y = [math]::Floor($k / $cols) * $ch
    $g.DrawImage($img, $x, $y, $cw, $ch)
    $g.DrawString($f.BaseName, $font, [System.Drawing.Brushes]::Yellow, $x + 4, $y + 4)
    $img.Dispose(); $k++
  }
  $g.Dispose()
  $sheet.Save("$OUT\contact-sheet.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg); $sheet.Dispose()
  "screenshots: $($files.Count) in tools/out/shots, contact sheet tools/out/contact-sheet.jpg"
}

# ---- 3. portrait phone → rotate prompt ----
Run-Edge @('--window-size=420,860','--virtual-time-budget=3000','--dump-dom',"`"$Url${sep}rotatecheck=1`"") "$OUT\rotate-dom.txt" 60000
$rt = [regex]::Match((Get-Content "$OUT\rotate-dom.txt" -Raw), '<title>([^<]*)</title>').Groups[1].Value
"rotate prompt in a 420x860 window: $rt"
if ($rt -ne 'ROTATE SHOWN') { $pass = $false }

if ($pass) { "VERIFY: PASS" } else { "VERIFY: FAIL"; exit 1 }
