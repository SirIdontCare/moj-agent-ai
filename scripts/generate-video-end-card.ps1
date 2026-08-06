param(
  [string]$LogoPath = (Join-Path $PSScriptRoot "..\public\brand-mark.png"),
  [string]$OutputPath = (Join-Path $PSScriptRoot "..\public\video-storyboard\04-agent-ai-end-card.png")
)

Add-Type -AssemblyName System.Drawing

$width = 1920
$height = 1080
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$background = [System.Drawing.Color]::FromArgb(255, 8, 9, 13)
$graphics.Clear($background)

function Add-Glow {
  param(
    [System.Drawing.Graphics]$Canvas,
    [System.Drawing.Rectangle]$Bounds,
    [System.Drawing.Color]$Color
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse($Bounds)
  $brush = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
  $brush.CenterColor = [System.Drawing.Color]::FromArgb(48, $Color.R, $Color.G, $Color.B)
  $brush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $Color.R, $Color.G, $Color.B))
  $Canvas.FillEllipse($brush, $Bounds)
  $brush.Dispose()
  $path.Dispose()
}

Add-Glow -Canvas $graphics -Bounds (New-Object System.Drawing.Rectangle(390, 70, 650, 650)) -Color ([System.Drawing.Color]::FromArgb(141, 114, 246))
Add-Glow -Canvas $graphics -Bounds (New-Object System.Drawing.Rectangle(880, 70, 650, 650)) -Color ([System.Drawing.Color]::FromArgb(66, 216, 239))

$logo = [System.Drawing.Image]::FromFile((Resolve-Path $LogoPath))
$logoSize = 310
$logoX = [int](($width - $logoSize) / 2)
$logoY = 115
$graphics.DrawImage($logo, $logoX, $logoY, $logoSize, $logoSize)

$titleFont = New-Object System.Drawing.Font("Segoe UI", 66, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$taglineFont = New-Object System.Drawing.Font("Segoe UI", 29, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$urlFont = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$center = New-Object System.Drawing.StringFormat
$center.Alignment = [System.Drawing.StringAlignment]::Center
$center.LineAlignment = [System.Drawing.StringAlignment]::Center

$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(250, 250, 252))
$violet = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(174, 150, 255))
$muted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(151, 157, 177))

$graphics.DrawString("AGENT AI", $titleFont, $white, (New-Object System.Drawing.RectangleF(0, 472, $width, 98)), $center)
$graphics.DrawString("ZLEĆ CEL. AGENT ZROBI RESZTĘ.", $taglineFont, $violet, (New-Object System.Drawing.RectangleF(0, 590, $width, 56)), $center)

$linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(65, 141, 114, 246), 2)
$graphics.DrawLine($linePen, 790, 684, 1130, 684)
$graphics.DrawString("ZACZNIJ ZA DARMO", $urlFont, $muted, (New-Object System.Drawing.RectangleF(0, 728, $width, 48)), $center)

$directory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$linePen.Dispose()
$white.Dispose()
$violet.Dispose()
$muted.Dispose()
$center.Dispose()
$titleFont.Dispose()
$taglineFont.Dispose()
$urlFont.Dispose()
$logo.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Output $OutputPath
