param([Parameter(Mandatory=$true)][string]$SymbolPath,[Parameter(Mandatory=$true)][string]$OriginalPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$brandDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'web/assets'
New-Item -ItemType Directory -Force -Path $brandDir | Out-Null
# The source cutout is generated separately. This only encodes application icon sizes.
function Write-BrandPng([System.Drawing.Image]$image,[int]$size,[string]$target) {
    $bitmap = New-Object System.Drawing.Bitmap($size,$size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $ratio = [Math]::Min(($size*0.90)/$image.Width,($size*0.90)/$image.Height)
    $width = [int]($image.Width*$ratio); $height = [int]($image.Height*$ratio)
    $graphics.DrawImage($image,[int](($size-$width)/2),[int](($size-$height)/2),$width,$height)
    $bitmap.Save($target,[System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose(); $bitmap.Dispose()
}
$source = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $SymbolPath))
try {
    Write-BrandPng $source 256 (Join-Path $brandDir 'sirocco-symbol.png')
    Write-BrandPng $source 64 (Join-Path $brandDir 'sirocco-favicon.png')
    $sizes = @(16,32,48,256)
    $frames = @()
    foreach($size in $sizes) {
        $tempPng = Join-Path $brandDir "icon-frame-$size.png"
        Write-BrandPng $source $size $tempPng
        $frames += ,([System.IO.File]::ReadAllBytes($tempPng))
        Remove-Item -LiteralPath $tempPng
    }
    $stream = [System.IO.File]::Create((Join-Path $brandDir 'sirocco.ico'))
    $writer = New-Object System.IO.BinaryWriter($stream)
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
    $offset = 6 + 16*$sizes.Count
    for($i=0;$i -lt $sizes.Count;$i++) {
        $dimension = if($sizes[$i] -eq 256){0}else{$sizes[$i]}
        $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
        $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([uint16]1); $writer.Write([uint16]32)
        $writer.Write([uint32]$frames[$i].Length); $writer.Write([uint32]$offset)
        $offset += $frames[$i].Length
    }
    foreach($frame in $frames){$writer.Write([byte[]]$frame)}
    $writer.Dispose(); $stream.Dispose()
} finally { $source.Dispose() }
Copy-Item -LiteralPath $OriginalPath -Destination (Join-Path $brandDir 'sirocco-original.png') -Force
Write-Output 'Sirocco brand assets encoded: PNG, favicon and Windows ICO.'
