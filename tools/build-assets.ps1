$ErrorActionPreference = 'Stop'
$sp = $PSScriptRoot
$repo = Split-Path $PSScriptRoot -Parent
Add-Type -Path "$sp\ImgTool.cs" -ReferencedAssemblies System.Drawing
$P = "$repo\content\pages"
$O = "$repo\assets\img"
New-Item -ItemType Directory -Force $O | Out-Null
Get-ChildItem $O -File | Remove-Item -Force
$manifest = New-Object System.Collections.Generic.List[string]
function Log($tag, $json) { $line = "$tag $json"; $script:manifest.Add($line); Write-Output $line }

$BGW = 1754; $BGH = 1240; $Q = 84
$S = 0.5   # sprite scale

# ---------- backgrounds ----------
Log 'bg-cover'  ([ImgTool]::ResizeJpeg("$P\00-cover\artifacts\Front-page.jpg", "$O\bg-cover.jpg", $BGW, $BGH, 86))
Log 'bg-p3'     ([ImgTool]::ResizeJpeg("$P\03-feijoa\artifacts\Page3-still-image.jpg", "$O\bg-p3.jpg", $BGW, $BGH, $Q))
Log 'bg-p4'     ([ImgTool]::ResizeJpeg("$P\04-tamarillo\artifacts\Page4-still-image.jpg", "$O\bg-p4.jpg", $BGW, $BGH, $Q))
Log 'bg-p5'     ([ImgTool]::ResizeJpeg("$P\05-kiwi\artifacts\Page5-still-image.jpg", "$O\bg-p5.jpg", $BGW, $BGH, $Q))
Log 'bg-p6'     ([ImgTool]::ResizeJpeg("$P\06-nectarine\artifacts\Page6-still-image.jpg", "$O\bg-p6.jpg", $BGW, $BGH, $Q))
Log 'bg-p7'     ([ImgTool]::ResizeJpeg("$P\07-boysenberry\artifacts\Page7-still-image.jpg", "$O\bg-p7.jpg", $BGW, $BGH, $Q))

# ---------- extract + inpaint (object becomes a sprite, background gets the gap filled) ----------
Log 'egg-night'  ([ImgTool]::ExtractInpaint("$P\01-egg-on-leaf\artifacts\Page1.jpg", "$O\egg-night.png", "$O\bg-p1.jpg", 1120,1040,340,460, "egg", 0,0, $S, 4, $BGW,$BGH,$Q))
Log 'egg-day'    ([ImgTool]::ExtractInpaint("$P\02-egg-hatches\artifacts\Page2.jpg", "$O\egg-day.png", "$O\bg-p2.jpg", 1560,1090,540,700, "egg", 0,0, $S, 4, $BGW,$BGH,$Q))
Log 'cat-p8'     ([ImgTool]::ExtractInpaint("$P\08-saturday-treats\artifacts\Page_8-still-image.jpg", "$O\cat-p8.png", "$O\bg-p8.jpg", 1100,850,1100,580, "auto", 10,30, $S, 6, $BGW,$BGH,$Q))
Log 'cat-p9'     ([ImgTool]::ExtractInpaint("$P\09-swan-leaf\artifacts\Page_9-still-image.jpg", "$O\cat-p9.png", "$O\bg-p9.jpg", 1480,1090,1010,690, "auto", 10,30, $S, 6, $BGW,$BGH,$Q))
Log 'cat-p10'    ([ImgTool]::ExtractInpaint("$P\10-full-caterpillar\artifacts\Page_10-still-image.jpg", "$O\cat-p10.png", "$O\bg-p10.jpg", 860,320,1950,1590, "auto", 10,30, $S, 6, $BGW,$BGH,$Q))
# cocoons hang from a dark-green branch: keep the branch in the background
[ImgTool]::ExR = 26; [ImgTool]::ExG = 122; [ImgTool]::ExB = 26; [ImgTool]::ExTol = 60
Log 'cocoon-p11' ([ImgTool]::ExtractInpaint("$P\11-cocoon\artifacts\Page_11-still-image.jpg", "$O\cocoon-p11.png", "$O\bg-p11.jpg", 2010,700,520,820, "auto", 10,30, $S, 6, $BGW,$BGH,$Q))
Log 'cocoon-p12' ([ImgTool]::ExtractInpaint("$P\12-butterfly\artifacts\Page_12-cocoon.jpg", "$O\cocoon-p12.png", "$O\bg-p12.jpg", 100,1100,500,900, "auto", 10,30, $S, 6, $BGW,$BGH,$Q))
[ImgTool]::ExTol = 0

# ---------- sprites keyed from white pages ----------
function Key($tag, $src, $dst, $th=6, $ts=24, $pad=6) { Log $tag ([ImgTool]::KeyCrop($src, $dst, 0,0,0,0, "white", $th, $ts, $S, $pad, 200)) }
Key 'egg-cracked' "$P\02-egg-hatches\artifacts\Page2-egg cracked.jpg" "$O\egg-cracked.png"
Key 'hatched'     "$P\02-egg-hatches\artifacts\Page2-caterpillar out.jpg" "$O\hatched.png"
Key 'butterfly'   "$P\12-butterfly\artifacts\Page_12-butterfly.jpg" "$O\butterfly.png"
Key 'arrow'       "$P\01-egg-on-leaf\artifacts\Arrow.jpg" "$O\arrow.png" 3 10 2
Key 'arrow-cover' "$P\00-cover\artifacts\Front-page-arrow.png" "$O\arrow-cover.png" 3 10 2
Key 'tap-hand'    "$P\00-cover\artifacts\Tap.png" "$O\tap-hand.png"

# fruit pages: full layer + bite mask (same bbox) + number + word
function Fruit($name, $dir, $full, $hole, $num, $word, $numName) {
  $j = [ImgTool]::KeyCrop("$P\$dir\artifacts\$full", "$O\$name-full.png", 0,0,0,0, "white", 6, 24, $S, 6, 200)
  Log "$name-full" $j
  $b = $j | ConvertFrom-Json
  Log "$name-hole" ([ImgTool]::MaskCrop("$P\$dir\artifacts\$full", "$P\$dir\artifacts\$hole", "$O\$name-hole.png", $b.x, $b.y, $b.w, $b.h, 6, 24, $S, 300))
  Key "$numName" "$P\$dir\artifacts\$num" "$O\$numName.png"
  Key "word-$name" "$P\$dir\artifacts\$word" "$O\word-$name.png"
}
Fruit 'feijoa'      '03-feijoa'      'Page3-whole-fruit.jpg' 'Page3-hole-fruit.jpg' 'Page3-number-1.jpg' 'Page3-word.jpg' 'num-1'
Fruit 'tamarillo'   '04-tamarillo'   'Page4-full-fruit.jpg'  'Page4-hole-fruit.jpg' 'Page4-number.jpg'   'Page4-word.jpg' 'num-2'
Fruit 'kiwi'        '05-kiwi'        'Page5-full-fruit.jpg'  'Page5-hole-fruit.jpg' 'Page5-number.jpg'   'Page5-word.jpg' 'num-3'
Fruit 'nectarine'   '06-nectarine'   'Page6-full-fruit.jpg'  'Page6-hole-fruit.jpg' 'Page6-number.jpg'   'Page6-word.jpg' 'num-4'
Fruit 'boysenberry' '07-boysenberry' 'Page7-fruit-full.jpg'  'Page7-fruit-hole.jpg' 'Page7-number.jpg'   'Page7-word.jpg' 'num-5'

# leaf
$j = [ImgTool]::KeyCrop("$P\09-swan-leaf\artifacts\Page_9-full-leaf.jpg", "$O\leaf-full.png", 0,0,0,0, "white", 6, 24, $S, 6, 200)
Log 'leaf-full' $j
$b = $j | ConvertFrom-Json
Log 'leaf-hole' ([ImgTool]::MaskCrop("$P\09-swan-leaf\artifacts\Page_9-full-leaf.jpg", "$P\09-swan-leaf\artifacts\Page_9-half-leaf.jpg", "$O\leaf-hole.png", $b.x, $b.y, $b.w, $b.h, 6, 24, $S, 300))

# Saturday foods: 5x2 grid cells on the sheet (inset to avoid the ruled lines)
$cols = @(@(0,679),@(679,1414),@(1414,2131),@(2131,2849),@(2849,3508))
$rows = @(@(472,1120),@(1242,1890))
$names = @('lamington','hokey-pokey','pineapple-lump','cheese','pepperoni','gummy-bear','mince-pie','sausage','muffin','rockmelon')
$i = 0
foreach ($r in $rows) { foreach ($c in $cols) {
  $n = $names[$i]; $i++
  $rx = $c[0] + 34; $rw = $c[1] - $c[0] - 68; $ry = $r[0] + 22; $rh = $r[1] - $r[0] - 44
  $j = [ImgTool]::KeyCrop("$P\08-saturday-treats\artifacts\Page_8-full-food.jpg", "$O\food-$n-full.png", $rx,$ry,$rw,$rh, "white", 6, 24, $S, 6, 200)
  Log "food-$n-full" $j
  $b = $j | ConvertFrom-Json
  Log "food-$n-hole" ([ImgTool]::MaskCrop("$P\08-saturday-treats\artifacts\Page_8-full-food.jpg", "$P\08-saturday-treats\artifacts\Page_8-food-hole.jpg", "$O\food-$n-hole.png", $b.x, $b.y, $b.w, $b.h, 6, 24, $S, 300))
}}

# icons from the cover caterpillar face
[ImgTool]::CropResizePng("$P\00-cover\artifacts\Front-page.jpg", "$O\icon-512.png", 700,1290,520,520, 512,512) | Out-Null
[ImgTool]::CropResizePng("$P\00-cover\artifacts\Front-page.jpg", "$O\icon-192.png", 700,1290,520,520, 192,192) | Out-Null
Log 'icons' 'ok'

$manifest | Set-Content "$sp\out\manifest.txt" -Encoding utf8
"---- sizes ----"
Get-ChildItem $O | ForEach-Object { "{0,-28} {1,7:N0} KB" -f $_.Name, ($_.Length/1KB) }
