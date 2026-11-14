# Verifies an MP4 opens and plays in the Windows 11 media stack (WinRT MediaPlayer),
# the same engine behind the Media Player / Movies & TV apps. Catches 0xc10100be problems.
#
# Usage: powershell -NoProfile -File check-windows-playback.ps1 -Path docs\tactical-board-demo.mp4
param([Parameter(Mandatory = $true)][string]$Path)

[Windows.Media.Playback.MediaPlayer, Windows.Media.Playback, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Core.MediaSource, Windows.Media.Core, ContentType = WindowsRuntime] | Out-Null

$full = (Resolve-Path $Path).Path
$uri = New-Object System.Uri($full)
$player = New-Object Windows.Media.Playback.MediaPlayer
$player.Source = [Windows.Media.Core.MediaSource]::CreateFromUri($uri)
Start-Sleep -Milliseconds 600
$player.Play()
Start-Sleep -Milliseconds 800
$s = $player.PlaybackSession
Write-Host "State=$($s.PlaybackState) Size=$($s.NaturalVideoWidth)x$($s.NaturalVideoHeight) Position=$($s.Position) Duration=$($s.NaturalDuration)"
if ($s.PlaybackState -ne 'Playing' -or $s.NaturalVideoWidth -eq 0) { Write-Host 'FAIL: not playable'; exit 1 }
Write-Host 'OK: playable'
