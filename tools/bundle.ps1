<#
  bundle.ps1 — package the book for people who just want to open it.

  Writes   dist/a-feijoa-on-monday.html   the whole book in one file: art, audio and code inlined.
                                          Double-click it. Works offline, from file://, on any device.
           dist/a-feijoa-on-monday.zip    the site as a folder (unzip, open index.html). Loads faster.

  Runs on Windows PowerShell 5.1 and on PowerShell 7 (pwsh) on the Linux CI runner — text and
  base64 only, no image libraries. Run tools/build-assets.ps1 first if the artwork changed.
#>
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$dist = Join-Path $repo 'dist'
$stageDir = Join-Path $dist 'a-feijoa-on-monday'
if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
New-Item -ItemType Directory -Force $stageDir | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
$read = { param($rel) [IO.File]::ReadAllText((Join-Path $repo $rel), [Text.Encoding]::UTF8) }

# ---------- the single file ----------
$html = & $read 'index.html'
$css  = & $read 'css/style.css'
$mime = @{ '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.mp3' = 'audio/mpeg'; '.webp' = 'image/webp' }
$map = New-Object System.Text.StringBuilder
[void]$map.Append('window.BUNDLE_ASSETS={')
$first = $true; $count = 0; $bytes = 0
foreach ($sub in @('assets/img', 'assets/audio')) {
  foreach ($f in Get-ChildItem (Join-Path $repo $sub) -File | Sort-Object Name) {
    $ext = $f.Extension.ToLowerInvariant()
    if (-not $mime.ContainsKey($ext)) { continue }
    $rel = "$sub/$($f.Name)"
    $data = [IO.File]::ReadAllBytes($f.FullName)
    $uri = 'data:' + $mime[$ext] + ';base64,' + [Convert]::ToBase64String($data)
    if (-not $first) { [void]$map.Append(',') }; $first = $false
    [void]$map.Append('"').Append($rel).Append('":"').Append($uri).Append('"')
    $count++; $bytes += $data.Length
    # static references in the shell (cover art, arrows, hand, butterfly, icons)
    $html = $html.Replace("`"$rel`"", "`"$uri`"")
  }
}
[void]$map.Append('};')

$scripts = New-Object System.Text.StringBuilder
[void]$scripts.Append("<script>").Append($map.ToString()).Append("</script>`n")
foreach ($js in @('js/layout.js', 'js/audio.js', 'js/story.js', 'js/app.js')) {
  $code = (& $read $js).Replace('</script', '<\/script')
  [void]$scripts.Append("<script>`n").Append($code).Append("`n</script>`n")
}

$html = [regex]::Replace($html, '<link rel="manifest"[^>]*>\s*', '')
$html = [regex]::Replace($html, '<link rel="(?:icon|apple-touch-icon)"[^>]*>\s*', '')
$html = [regex]::Replace($html, '<link rel="stylesheet" href="css/style\.css">', ('<style>' + "`n" + $css + "`n" + '</style>'))
$html = [regex]::Replace($html, '(?:<script src="js/[^"]+"></script>\s*)+', $scripts.ToString())
if ($html -match 'src="(js|assets)/|href="(css|assets)/') { throw 'bundle still references an external file' }
$single = Join-Path $dist 'a-feijoa-on-monday.html'
[IO.File]::WriteAllText($single, $html, $utf8)

# ---------- the zip ----------
foreach ($item in @('index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'assets')) {
  Copy-Item (Join-Path $repo $item) (Join-Path $stageDir $item) -Recurse
}
[IO.File]::WriteAllText((Join-Path $stageDir 'README.txt'), "A Feijoa on Monday`r`n`r`nOpen index.html in a web browser. Turn the sound on, and hold a phone sideways.`r`n", $utf8)
$zip = Join-Path $dist 'a-feijoa-on-monday.zip'
Compress-Archive -Path $stageDir -DestinationPath $zip -CompressionLevel Optimal
Remove-Item $stageDir -Recurse -Force

"{0,-28} {1,8:N0} KB  ({2} assets inlined, {3:N0} KB raw)" -f 'a-feijoa-on-monday.html', ((Get-Item $single).Length / 1KB), $count, ($bytes / 1KB)
"{0,-28} {1,8:N0} KB" -f 'a-feijoa-on-monday.zip', ((Get-Item $zip).Length / 1KB)
