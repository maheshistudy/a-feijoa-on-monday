<#
  build-assets.ps1 — turn the designer's sheets and the recorded voice into the book's assets.

  Reads   content/pages/NN-slug/artifacts/            (never modified)
  Writes  assets/img/      backgrounds (1754 x 1240 JPEG) and sprites (PNG, half sheet scale)
          assets/audio/    the recordings, renamed canonically
          js/layout.js     GENERATED: every measured rectangle, bite cell, word box and word timing
          tools/out/       build log, word-box and envelope debug images

  Windows PowerShell 5.1 + System.Drawing (tools/ImgTool.cs compiled on the fly) + headless Edge
  for the audio analysis. Local only — CI cannot run this; the outputs are committed.

  Re-runnable: delete assets/ and js/layout.js, run again, get the same tree.

  Options:  -SkipAudio   reuse the timings already in js/layout.js (fast image-only rebuild)
#>
param([switch]$SkipAudio)

$ErrorActionPreference = 'Stop'
$sp   = $PSScriptRoot
$repo = Split-Path $PSScriptRoot -Parent
Add-Type -Path "$sp\ImgTool.cs" -ReferencedAssemblies System.Drawing

$P    = "$repo\content\pages"
$IMG  = "$repo\assets\img"
$AUD  = "$repo\assets\audio"
$OUT  = "$sp\out"
foreach ($d in @($IMG, $AUD, $OUT)) { New-Item -ItemType Directory -Force $d | Out-Null }
Get-ChildItem $IMG -File | Remove-Item -Force
Get-ChildItem $AUD -File | Remove-Item -Force
Get-ChildItem $OUT -File | Where-Object { $_.Name -ne '.gitkeep' } | Remove-Item -Force

$log = New-Object System.Collections.Generic.List[string]
function Log($tag, $msg) { $line = "{0,-22} {1}" -f $tag, $msg; $script:log.Add($line); Write-Output $line }
function Fail($msg) { Log 'FAIL' $msg; $script:log | Set-Content "$OUT\build-log.txt" -Encoding utf8; throw $msg }

$BGW = 1754; $BGH = 1240; $Q = 84; $S = 0.5
$layout = [ordered]@{ sheet = [ordered]@{ w = 3508; h = 2480 }; img = [ordered]@{}; holes = [ordered]@{}; captions = [ordered]@{}; audio = [ordered]@{}; timings = [ordered]@{}; text = [ordered]@{}; flags = [ordered]@{} }

function Rect($tag, $json) {
  Log $tag $json
  $j = $json | ConvertFrom-Json
  if ($j.error) { Fail "$tag -> $($j.error)" }
  $script:layout.img[$tag] = [ordered]@{ file = $j.file; x = $j.x; y = $j.y; w = $j.w; h = $j.h }
  return $j
}
function Bg($tag, $src) {
  $j = [ImgTool]::ResizeJpeg($src, "$IMG\$tag.jpg", $BGW, $BGH, $Q) | ConvertFrom-Json
  Log $tag "$($j.file) $($j.w)x$($j.h)"
  $script:layout.img[$tag] = [ordered]@{ file = $j.file }
}
function Key($tag, $src, $th = 6, $ts = 24, $pad = 6, $bg = 'white') {
  return Rect $tag ([ImgTool]::KeyCrop($src, "$IMG\$tag.png", 0,0,0,0, $bg, $th, $ts, $S, $pad, 200))
}

# =====================================================================
# 1. Backgrounds
# =====================================================================
Bg 'bg-cover' "$P\00-cover\artifacts\FrontPage-still.jpg"
Bg 'bg-p01'   "$P\01-egg-on-leaf\artifacts\Page1-still-image.jpg"
Bg 'bg-p02'   "$P\02-egg-hatches\artifacts\Page2-still-image.jpg"
Bg 'bg-p03'   "$P\03-feijoa\artifacts\Page3-still-image.jpg"
Bg 'bg-p04'   "$P\04-tamarillo\artifacts\Page4-still-image.jpg"
Bg 'bg-p05'   "$P\05-kiwi\artifacts\Page5-still-image.jpg"
Bg 'bg-p06'   "$P\06-nectarine\artifacts\Page6-still-image.jpg"
Bg 'bg-p07'   "$P\07-boysenberry\artifacts\Page7-still-image.jpg"
Bg 'bg-p08'   "$P\08-saturday-treats\artifacts\Page_8-background.jpg"
Bg 'bg-p09'   "$P\09-swan-leaf\artifacts\Page_9-stillimage.jpg"
Bg 'bg-p10'   "$P\10-full-caterpillar\artifacts\Page_10-stillimage.jpg"
Bg 'bg-p11'   "$P\11-cocoon\artifacts\Page_11-stillimage.jpg"

# Page 12: no separate still was supplied. If the sheet is a flat sky outside the branch+cocoon,
# the background becomes that sky and the branch and cocoon are lifted off so the cocoon can crack.
$p12 = "$P\12-butterfly\artifacts\Page_12-cocoon.jpg"
$flat = [ImgTool]::FlatCheck($p12, 0, 900, 900, 1300, 12) | ConvertFrom-Json
Log 'p12-flat-check' ("sky {0},{1},{2}  off-colour {3:P2}  max dist {4}  flat={5}" -f $flat.r, $flat.g, $flat.b, $flat.off, $flat.max, $flat.flat)
$layout.flags['p12Layered'] = [bool]$flat.flat
if ($flat.flat) {
  $j = [ImgTool]::FillJpeg("$IMG\bg-p12.jpg", $flat.r, $flat.g, $flat.b, $BGW, $BGH, $Q) | ConvertFrom-Json
  Log 'bg-p12' "$($j.file) flat sky"
  $layout.img['bg-p12'] = [ordered]@{ file = $j.file }
} else {
  Bg 'bg-p12' $p12
}

# =====================================================================
# 2. Chrome shared across pages (identical on every page; taken from page 1 / the cover)
# =====================================================================
Key 'arrow-next'  "$P\01-egg-on-leaf\artifacts\Forward-arrow.jpg"  3 10 2 | Out-Null
Key 'arrow-back'  "$P\01-egg-on-leaf\artifacts\Backward-arrow.jpg" 3 10 2 | Out-Null
Key 'cover-arrow' "$P\00-cover\artifacts\FrontPage-arrow.png"      3 10 2 | Out-Null
Key 'tap-hand'    "$P\01-egg-on-leaf\artifacts\Tap.png"                    | Out-Null
$point = [ImgTool]::KeyCrop("$P\00-cover\artifacts\FrontPage-point.jpg", "$OUT\cover-point.png", 0,0,0,0, 'white', 6, 24, $S, 6, 200) | ConvertFrom-Json
Log 'cover-point' "hand hint on the cover sits at $($point.x),$($point.y)"
$layout.img['cover-point'] = [ordered]@{ file = 'tap-hand.png'; x = $point.x; y = $point.y; w = $point.w; h = $point.h }
foreach ($d in Get-ChildItem $P -Directory | Where-Object { $_.Name -ne '00-cover' }) {
  foreach ($f in @('Forward-arrow.jpg', 'Backward-arrow.jpg', 'Tap.png')) {
    $a = "$P\01-egg-on-leaf\artifacts\$f"; $b = "$($d.FullName)\artifacts\$f"
    if ((Test-Path $b) -and ([ImgTool]::Md5($a) -ne [ImgTool]::Md5($b))) { Log 'WARN' "$($d.Name)\$f differs from page 1's copy — using page 1's" }
  }
}

# =====================================================================
# 3. Objects
# =====================================================================
Key 'egg-p01'         "$P\01-egg-on-leaf\artifacts\Page1-egg.jpg" | Out-Null
Key 'egg-p02'         "$P\02-egg-hatches\artifacts\Page2-egg.jpg" | Out-Null
Key 'egg-cracked-p02' "$P\02-egg-hatches\artifacts\Page2-egg cracked.jpg" | Out-Null
Key 'hatched-p02'     "$P\02-egg-hatches\artifacts\Page2-caterpillar out.jpg" | Out-Null

# fruit pages: whole fruit + bite mask (same box, one cell per hole) + number + word
function Fruit($name, $dir, $full, $hole, $num, $word, $n) {
  $b = Key "fruit-$name" "$P\$dir\artifacts\$full"
  $m = [ImgTool]::MaskCrop("$P\$dir\artifacts\$full", "$P\$dir\artifacts\$hole", "$IMG\fruit-$name-hole.png", $b.x, $b.y, $b.w, $b.h, 6, 24, $S, 300) | ConvertFrom-Json
  Log "fruit-$name-hole" (($m.holes | ForEach-Object { "($($_.cx),$($_.cy))" }) -join ' ')
  $script:layout.img["fruit-$name-hole"] = [ordered]@{ file = $m.file }
  if ($m.holes.Count -ne $n) { Fail "fruit-${name}: expected $n bite holes, found $($m.holes.Count)" }
  $script:layout.holes["fruit-$name"] = @($m.holes | ForEach-Object { ,@($_.cx, $_.cy) })
  Key "num-$n"     "$P\$dir\artifacts\$num"  | Out-Null
  Key "word-$name" "$P\$dir\artifacts\$word" | Out-Null
}
Fruit 'feijoa'      '03-feijoa'      'Page3-whole-fruit.jpg' 'Page3-hole-fruit.jpg' 'Page3-number-1.jpg' 'Page3-word.jpg' 1
Fruit 'tamarillo'   '04-tamarillo'   'Page4-full-fruit.jpg'  'Page4-hole-fruit.jpg' 'Page4-number.jpg'   'Page4-word.jpg' 2
Fruit 'kiwi'        '05-kiwi'        'Page5-full-fruit.jpg'  'Page5-hole-fruit.jpg' 'Page5-number.jpg'   'Page5-word.jpg' 3
Fruit 'nectarine'   '06-nectarine'   'Page6-full-fruit.jpg'  'Page6-hole-fruit.jpg' 'Page6-number.jpg'   'Page6-word.jpg' 4
Fruit 'boysenberry' '07-boysenberry' 'Page7-fruit-full.jpg'  'Page7-fruit-hole.jpg' 'Page7-number.jpg'   'Page7-word.jpg' 5

# Saturday: the caterpillar is its own layer; the ten treats come on a 5 x 2 contact sheet
Key 'cat-p08' "$P\08-saturday-treats\artifacts\Page_8-caterpiller.jpg" | Out-Null
$cols  = @(@(0,679),@(679,1414),@(1414,2131),@(2131,2849),@(2849,3508))
$rows  = @(@(472,1120),@(1242,1890))
$foods = @('lamington','hokey-pokey','pineapple-lump','cheese','pepperoni','gummy-bear','mince-pie','sausage','muffin','rockmelon')
$i = 0
foreach ($r in $rows) { foreach ($c in $cols) {
  $n = $foods[$i]; $i++
  $rx = $c[0] + 34; $rw = $c[1] - $c[0] - 68; $ry = $r[0] + 22; $rh = $r[1] - $r[0] - 44
  $b = Rect "food-$n" ([ImgTool]::KeyCrop("$P\08-saturday-treats\artifacts\Page_8-full-food.jpg", "$IMG\food-$n.png", $rx,$ry,$rw,$rh, 'white', 6, 24, $S, 6, 200))
  $m = [ImgTool]::MaskCrop("$P\08-saturday-treats\artifacts\Page_8-full-food.jpg", "$P\08-saturday-treats\artifacts\Page_8-food-hole.jpg", "$IMG\food-$n-hole.png", $b.x, $b.y, $b.w, $b.h, 6, 24, $S, 300) | ConvertFrom-Json
  Log "food-$n-hole" (($m.holes | ForEach-Object { "($($_.cx),$($_.cy))" }) -join ' ')
  $script:layout.img["food-$n-hole"] = [ordered]@{ file = $m.file }
  if ($m.holes.Count -lt 1) { Fail "food-${n}: no bite hole found" }
  $script:layout.holes["food-$n"] = @($m.holes | Select-Object -First 1 | ForEach-Object { ,@($_.cx, $_.cy) })
}}

# Sunday: caterpillar layer + the bitten leaf backed with sky (see ImgTool.BiteComposite)
Key 'cat-p09' "$P\09-swan-leaf\artifacts\Page_9-caterpiller.jpg" | Out-Null
$bite = Rect 'leaf-bitten-p09' ([ImgTool]::BiteComposite("$P\09-swan-leaf\artifacts\Page_9-stillimage.jpg", "$P\09-swan-leaf\artifacts\Page_9-bite.jpg", "$IMG\leaf-bitten-p09.png", 0,1000,2100,1000, 6, 24, 3, $S, 6))
if ($bite.uncovered -gt 500) { Fail "leaf-bitten-p09: $($bite.uncovered) leaf pixels would still show through the bite — the bite sheet does not line up with the still" }

Key 'cat-p10' "$P\10-full-caterpillar\artifacts\Page_10-caterpiller.jpg" | Out-Null

# Cocoons hang from a dark-green branch; the branch stays still while the cocoon moves
$s11 = [ImgTool]::SplitByColor("$P\11-cocoon\artifacts\Page_11-cocoon.jpg", "$IMG\cocoon-p11.png", "$IMG\branch-p11.png", 'white', 6, 24, 27,135,24, 45, 4, $S, 6, 200) | ConvertFrom-Json
Rect 'cocoon-p11' ($s11.main | ConvertTo-Json -Compress) | Out-Null
Rect 'branch-p11' ($s11.color | ConvertTo-Json -Compress) | Out-Null
if ($flat.flat) {
  $s12 = [ImgTool]::SplitByColor($p12, "$IMG\cocoon-p12.png", "$IMG\branch-p12.png", 'auto', 8, 30, 26,136,24, 45, 4, $S, 6, 200) | ConvertFrom-Json
  Rect 'cocoon-p12' ($s12.main | ConvertTo-Json -Compress) | Out-Null
  Rect 'branch-p12' ($s12.color | ConvertTo-Json -Compress) | Out-Null
}
Key 'butterfly-p12' "$P\12-butterfly\artifacts\Page_12-butterfly.jpg" | Out-Null

# icons from the cover caterpillar's face
[ImgTool]::CropResizePng("$P\00-cover\artifacts\FrontPage-still.jpg", "$IMG\icon-512.png", 700,1290,520,520, 512,512) | Out-Null
[ImgTool]::CropResizePng("$P\00-cover\artifacts\FrontPage-still.jpg", "$IMG\icon-192.png", 700,1290,520,520, 192,192) | Out-Null
Log 'icons' 'icon-192.png icon-512.png'

# =====================================================================
# 4. Caption panels: the designer's typeset text, cropped to the cream band, with word boxes
# =====================================================================
# The transcription of each panel, used only to validate the box count and to weight the timings.
$TEXT = [ordered]@{
  p01  = 'In the light of the moon a little egg lay on a leaf.'
  p02  = 'One Sunday morning the warm sun came up and pop! Out of the egg came a tiny and very hungry caterpillar. He started to look for some food.'
  p03  = 'On Monday he ate through one Feijoa. But he was still hungry.'
  p04  = 'On Tuesday he ate through two Tamarillo. But he was still hungry.'
  p05  = 'On Wednesday he ate through three Kiwi fruit. But he was still hungry.'
  p06  = 'On Thursday he ate through four Nectarines. But he was still hungry.'
  p07  = 'On Friday he ate through five Boysenberry. But he was still hungry.'
  p08a = 'On Saturday he ate through one piece of Lamington, Hokey Pokey cone, one pineapple lump, one slice of Cheddar cheese, One slice of Peperoni.'
  p08b = 'One Gummybear, one piece of mince pie, one cocktail sausage, one blueberry muffin and one slice of Rock melon. That night he had a stomachache!'
  p09  = 'The next day was Sunday again. The caterpillar ate through one nice Swan leaf after that. He felt much better.'
  p10  = "Now he wasn't hungry anymore and he wasn't a little caterpillar anymore. He was a big fat caterpillar."
  p11  = 'He built a small house, called a cocoon around himself. He stayed inside for more than two weeks.'
  p12  = 'Then he nibbled a hole in the cocoon, pushed his way out and...... He was a beautiful Monarch butterfly!'
}
$GAP = @{ }   # per-panel override of the word-gap fraction (of the line height), default 0.18
$PANELS = [ordered]@{
  p01 = '01-egg-on-leaf\artifacts\P1.jpg';  p02 = '02-egg-hatches\artifacts\P2.jpg';  p03 = '03-feijoa\artifacts\P3.jpg'
  p04 = '04-tamarillo\artifacts\P4.jpg';    p05 = '05-kiwi\artifacts\P5.jpg';         p06 = '06-nectarine\artifacts\P6.jpg'
  p07 = '07-boysenberry\artifacts\P7.jpg';  p08a = '08-saturday-treats\artifacts\p8-1.jpg'; p08b = '08-saturday-treats\artifacts\p8-2.jpg'
  p09 = '09-swan-leaf\artifacts\P9.jpg';    p10 = '10-full-caterpillar\artifacts\P10.jpg'; p11 = '11-cocoon\artifacts\P11.jpg'
  p12 = '12-butterfly\artifacts\P12.jpg'
}
foreach ($k in $PANELS.Keys) {
  $src = "$P\$($PANELS[$k])"
  $band = [ImgTool]::KeyCrop($src, "$IMG\text-$k.png", 0,0,0,0, 'white', 6, 24, $S, 0, 200) | ConvertFrom-Json
  if ($band.error) { Fail "text-$k -> $($band.error)" }
  $frac = if ($GAP.ContainsKey($k)) { $GAP[$k] } else { 0.18 }
  $wb = [ImgTool]::WordBoxes($src, $band.x, $band.y, $band.w, $band.h, 80, $frac, "$OUT\boxes-$k.png") | ConvertFrom-Json
  $words = @($TEXT[$k] -split '\s+' | Where-Object { $_ })
  Log "text-$k" ("{0},{1} {2}x{3}  lines={4} boxes={5} words={6}" -f $band.x, $band.y, $band.w, $band.h, $wb.lines, $wb.words.Count, $words.Count)
  if ($wb.words.Count -ne $words.Count) { Fail "text-${k}: detected $($wb.words.Count) word boxes but the text has $($words.Count) words — see tools/out/boxes-$k.png; adjust `$GAP['$k']" }
  $layout.captions[$k] = [ordered]@{ file = "text-$k.png"; x = $band.x; y = $band.y; w = $band.w; h = $band.h; words = @($wb.words | ForEach-Object { ,@($_[0], $_[1], $_[2], $_[3]) }) }
  $layout.text[$k] = $words
}

# =====================================================================
# 5. Audio: copy + rename (source filenames, typos included, are never touched)
# =====================================================================
$AUDIO = [ordered]@{
  'cover-narration'      = '00-cover\artifacts\voice\narration-front_page.mp3'
  'p01-narration'        = '01-egg-on-leaf\artifacts\voice\narration-page_1.mp3'
  'p02-narration'        = '02-egg-hatches\artifacts\voice\narration-page_2.mp3'
  'p03-narration'        = '03-feijoa\artifacts\voice\narration-page_3.mp3'
  'p03-number'           = '03-feijoa\artifacts\voice\number_one.mp3'
  'p03-word'             = '03-feijoa\artifacts\voice\feijoa.mp3'
  'p04-narration'        = '04-tamarillo\artifacts\voice\narration-page_4.mp3'
  'p04-number'           = '04-tamarillo\artifacts\voice\number_two.mp3'
  'p04-word'             = '04-tamarillo\artifacts\voice\tamarillo.mp3'
  'p05-narration'        = '05-kiwi\artifacts\voice\narration-page_5.mp3'
  'p05-number'           = '05-kiwi\artifacts\voice\number_three.mp3'
  'p05-word'             = '05-kiwi\artifacts\voice\kiwi_fruit.mp3'
  'p06-narration'        = '06-nectarine\artifacts\voice\narration-page_6.mp3'
  'p06-number'           = '06-nectarine\artifacts\voice\number_four.mp3'
  'p06-word'             = '06-nectarine\artifacts\voice\nectarine.mp3'
  'p07-narration'        = '07-boysenberry\artifacts\voice\narration-page_7.mp3'
  'p07-number'           = '07-boysenberry\artifacts\voice\numer_five.mp3'
  'p07-word'             = '07-boysenberry\artifacts\voice\boysonberry.mp3'
  'p08-narration'        = '08-saturday-treats\artifacts\voice\narration-page_8.mp3'
  'p08-food-lamington'   = '08-saturday-treats\artifacts\voice\lamington.mp3'
  'p08-food-hokey-pokey' = '08-saturday-treats\artifacts\voice\hokey_pokey.mp3'
  'p08-food-pineapple-lump' = '08-saturday-treats\artifacts\voice\pineapple_lump.mp3'
  'p08-food-cheese'      = '08-saturday-treats\artifacts\voice\cheddar_cheese.mp3'
  'p08-food-pepperoni'   = '08-saturday-treats\artifacts\voice\pepperoni.mp3'
  'p08-food-gummy-bear'  = '08-saturday-treats\artifacts\voice\gummy_bear.mp3'
  'p08-food-mince-pie'   = '08-saturday-treats\artifacts\voice\mince_pie.mp3'
  'p08-food-sausage'     = '08-saturday-treats\artifacts\voice\cocktail_sousage.mp3'
  'p08-food-muffin'      = '08-saturday-treats\artifacts\voice\blueberry_muffin.mp3'
  'p08-food-rockmelon'   = '08-saturday-treats\artifacts\voice\rock_melon.mp3'
  'p09-narration'        = '09-swan-leaf\artifacts\voice\narration-page_9.mp3'
  'p10-narration'        = '10-full-caterpillar\artifacts\voice\narration-page_10.mp3'
  'p11-narration'        = '11-cocoon\artifacts\voice\narration-page_11.mp3'
  'p12-narration'        = '12-butterfly\artifacts\voice\narration-page_12.mp3'
}
$seen = @{}
foreach ($k in $AUDIO.Keys) {
  $src = "$P\$($AUDIO[$k])"
  if (-not (Test-Path $src)) { Fail "missing recording $($AUDIO[$k])" }
  Copy-Item $src "$AUD\$k.mp3" -Force
  $md5 = [ImgTool]::Md5($src)
  if ($seen.ContainsKey($md5)) { Log 'WARN' "$k is byte-identical to $($seen[$md5]) — a recording was probably copied twice" }
  $seen[$md5] = $k
  $layout.audio[$k] = "$k.mp3"
}
Log 'audio' "$($AUDIO.Count) recordings copied"

# =====================================================================
# 6. Word timings: decode each narration in headless Edge and fit the words to its envelope
# =====================================================================
# Narration → the words it reads (page 8 is one recording across both panels)
$NARR = [ordered]@{
  p01 = @('p01'); p02 = @('p02'); p03 = @('p03'); p04 = @('p04'); p05 = @('p05'); p06 = @('p06'); p07 = @('p07')
  p08 = @('p08a', 'p08b'); p09 = @('p09'); p10 = @('p10'); p11 = @('p11'); p12 = @('p12')
}
$prev = $null
if ($SkipAudio -and (Test-Path "$repo\js\layout.js")) {
  $raw = Get-Content "$repo\js\layout.js" -Raw
  $m = [regex]::Match($raw, '(?s)const LAYOUT = (\{.*\});')
  if ($m.Success) { $prev = ($m.Groups[1].Value | ConvertFrom-Json).timings; Log 'audio-analysis' 'skipped — reusing timings from js/layout.js' }
}
if ($prev) {
  foreach ($k in $NARR.Keys) { if ($prev.$k) { $layout.timings[$k] = [ordered]@{ duration = $prev.$k.duration; words = @($prev.$k.words | ForEach-Object { ,@($_[0], $_[1]) }) } } }
  foreach ($extra in @('cover')) { if ($prev.$extra) { $layout.timings[$extra] = [ordered]@{ duration = $prev.$extra.duration; words = @() } } }
} else {
  $jobs = @()
  $jobs += [ordered]@{ id = 'cover'; b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("$AUD\cover-narration.mp3")); words = @() }
  foreach ($k in $NARR.Keys) {
    $words = @(); foreach ($pk in $NARR[$k]) { $words += $layout.text[$pk] }
    $jobs += [ordered]@{ id = $k; b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("$AUD\$k-narration.mp3")); words = $words }
  }
  # single-word recordings: duration only (they play whole on tap)
  foreach ($k in $AUDIO.Keys) { if ($k -notmatch 'narration$') { $jobs += [ordered]@{ id = $k; b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("$AUD\$k.mp3")); words = @() } } }

  # Headless Edge cannot finish an async MP3 decode under a virtual-time budget, so the analysis page is
  # served from a tiny local HTTP listener and posts its results back; Edge is then closed.
  $js = Get-Content "$sp\analyze-audio.js" -Raw
  $jobsJson = ConvertTo-Json -InputObject @($jobs) -Compress -Depth 5
  $page = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>analysis</title></head><body><pre id='result'></pre>" +
          "<script>window.JOBS=$jobsJson;</script><script>$js</script>" +
          "<script>(function(){var t=setInterval(function(){if(!window.RESULT)return;clearInterval(t);fetch('/result',{method:'POST',body:JSON.stringify(window.RESULT)});},100);})();</script></body></html>"
  $port = 8765 + (Get-Random -Maximum 200)
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add("http://localhost:$port/")
  $listener.Start()
  $edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  if (-not (Test-Path $edge)) { $edge = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe" }
  $proc = Start-Process $edge -PassThru -ArgumentList @('--headless=new','--disable-gpu','--no-first-run','--autoplay-policy=no-user-gesture-required',"--user-data-dir=`"$env:TEMP\edge-feijoa-analysis`"","http://localhost:$port/analyze.html")
  $result = $null
  $deadline = (Get-Date).AddSeconds(150)
  try {
    while ((Get-Date) -lt $deadline -and -not $result) {
      $ar = $listener.BeginGetContext($null, $null)
      while (-not $ar.AsyncWaitHandle.WaitOne(500)) { if ((Get-Date) -gt $deadline -or $proc.HasExited) { break } }
      if (-not $ar.IsCompleted) { break }
      $ctx = $listener.EndGetContext($ar)
      if ($ctx.Request.HttpMethod -eq 'POST') {
        $reader = New-Object IO.StreamReader($ctx.Request.InputStream, [Text.Encoding]::UTF8)
        $result = $reader.ReadToEnd(); $reader.Close()
        $ctx.Response.StatusCode = 204; $ctx.Response.Close()
      } else {
        $bytes = [Text.Encoding]::UTF8.GetBytes($page)
        $ctx.Response.ContentType = 'text/html; charset=utf-8'
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length); $ctx.Response.Close()
      }
    }
  } finally {
    $listener.Stop()
    if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  }
  if (-not $result) { Fail 'audio analysis produced no result (headless Edge did not post back within 120 s)' }
  $an = $result | ConvertFrom-Json
  foreach ($job in $jobs) {
    $id = $job.id; $r = $an.$id
    if (-not $r) { Fail "no analysis for $id" }
    if ($r.error) { Fail "analysis of $id failed: $($r.error)" }
    if ($job.words.Count) {
      $ok = $true; $last = 0
      foreach ($w in $r.words) { if ($w[0] -lt $last - 0.001 -or $w[1] -le $w[0] -or $w[1] -gt $r.duration + 0.001) { $ok = $false }; $last = $w[1] }
      if (-not $ok -or $r.words.Count -ne $job.words.Count) { Fail "timings for $id are not monotonic or do not cover $($job.words.Count) words" }
      $layout.timings[$id] = [ordered]@{ duration = $r.duration; words = @($r.words | ForEach-Object { ,@($_[0], $_[1]) }) }
      if ($r.env) { [IO.File]::WriteAllBytes("$OUT\envelope-$id.png", [Convert]::FromBase64String(($r.env -replace '^data:image/png;base64,', ''))) }
      Log "timing-$id" ("{0:F2}s, {1} words, {2} speech segments, first word at {3:F2}s" -f $r.duration, $r.words.Count, $r.segments.Count, $r.words[0][0])
    } else {
      $layout.timings[$id] = [ordered]@{ duration = $r.duration; words = @() }
    }
  }
}

# =====================================================================
# 7. Emit js/layout.js
# =====================================================================
$json = ConvertTo-Json -InputObject $layout -Depth 8 -Compress
# ConvertTo-Json escapes apostrophes and non-ASCII as ' etc — valid JS, but keep the file readable
$json = $json -replace '\\u0027', "'"
$header = @"
/* GENERATED by tools/build-assets.ps1 — do not edit by hand; re-run the pipeline instead.
   Every rectangle is in pixels of the 3508 x 2480 sheet (js/story.js converts to %).
   Word boxes are % of their caption panel; word timings are seconds into the recording. */
const LAYOUT = $json;
"@
[IO.File]::WriteAllText("$repo\js\layout.js", $header, (New-Object Text.UTF8Encoding($false)))
Log 'layout' "js/layout.js written ($([math]::Round((Get-Item "$repo\js\layout.js").Length / 1KB)) KB)"

$log | Set-Content "$OUT\build-log.txt" -Encoding utf8
"---- sizes ----"
"{0,-10} {1,8:N0} KB  ({2} files)" -f 'img',   ((Get-ChildItem $IMG | Measure-Object Length -Sum).Sum / 1KB), (Get-ChildItem $IMG).Count
"{0,-10} {1,8:N0} KB  ({2} files)" -f 'audio', ((Get-ChildItem $AUD | Measure-Object Length -Sum).Sum / 1KB), (Get-ChildItem $AUD).Count
