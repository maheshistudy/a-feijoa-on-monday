<#
  serve.ps1 - serve the book over http://localhost:8080 for local testing.

  Opening index.html straight from the file system works too, but the service worker only
  registers over http, so use this when testing offline/installable behaviour.

      .\tools\serve.ps1              # http://localhost:8080
      .\tools\serve.ps1 -Port 9000
      .\tools\serve.ps1 -Dist        # serve dist/ instead, to try the downloadable copies

  Ctrl+C to stop.
#>
param([int]$Port = 8080, [switch]$Dist, [switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if ($Dist) { $root = Join-Path $root 'dist' }
if (-not (Test-Path $root)) { throw "nothing to serve at $root (run tools\bundle.ps1 first?)" }
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
            '.json'='application/json'; '.webmanifest'='application/manifest+json'; '.png'='image/png';
            '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.svg'='image/svg+xml'; '.mp3'='audio/mpeg';
            '.zip'='application/zip'; '.txt'='text/plain; charset=utf-8'; '.md'='text/plain; charset=utf-8' }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() } catch { throw "could not listen on port $Port - is something already using it? Try -Port 9000." }
"Serving $root"
"  http://localhost:$Port/                        the book"
"  http://localhost:$Port/?selftest=1             the self-test (watch the page title)"
"  http://localhost:$Port/?page=7                 jump to a page (0-based)"
"  http://localhost:$Port/?envelope=1             word timeline, to check the highlight by ear"
"  http://localhost:$Port/?boxes=1                outline the detected word boxes"
"Ctrl+C to stop."
if (-not $NoOpen) { Start-Process "http://localhost:$Port/" | Out-Null }
try {
  while ($listener.IsListening) {
    $ar = $listener.BeginGetContext($null, $null)
    while (-not $ar.AsyncWaitHandle.WaitOne(300)) { }
    $ctx = $listener.EndGetContext($ar)
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq '') { $rel = 'index.html' }
    if ($ctx.Request.HttpMethod -eq 'POST') {      # an in-page test reporting its result
      $reader = New-Object IO.StreamReader($ctx.Request.InputStream, [Text.Encoding]::UTF8)
      $body = $reader.ReadToEnd(); $reader.Close()
      [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'out\post.txt'), $body)
      $body
      $ctx.Response.StatusCode = 204; $ctx.Response.Close(); continue
    }
    $path = Join-Path $root ($rel -replace '/', '\')
    $full = [IO.Path]::GetFullPath($path)
    if ((-not $full.StartsWith([IO.Path]::GetFullPath($root))) -or (-not (Test-Path $full -PathType Leaf))) {
      $ctx.Response.StatusCode = 404; $ctx.Response.Close()
      "404 $rel"; continue
    }
    $bytes = [IO.File]::ReadAllBytes($full)
    $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
    $ctx.Response.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
    $ctx.Response.Headers.Add('Cache-Control', 'no-store')    # always serve what is on disk
    $ctx.Response.ContentLength64 = $bytes.Length
    try { $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length) } catch { }
    $ctx.Response.Close()
  }
} finally { $listener.Stop() }