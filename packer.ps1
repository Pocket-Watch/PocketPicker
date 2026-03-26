Param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$Version,
  [Parameter(Position=1)]
  [ValidateSet('2','3')]
  [string]$ManifestVersion = '2'
)

$Common = @('icons','background.js','content.js','picker.css','picker.html','picker.js')

if ($ManifestVersion -eq '3') {
  $Out = "PocketPicker-v$Version-mv3.zip"
  # Stage files in a temp directory so manifest_v3.json becomes manifest.json
  $TmpDir = Join-Path ([System.IO.Path]::GetTempPath()) "pocketpicker_mv3_$(Get-Random)"
  New-Item -ItemType Directory -Path $TmpDir | Out-Null
  foreach ($item in $Common) { Copy-Item -Recurse $item $TmpDir }
  Copy-Item 'manifest_v3.json' (Join-Path $TmpDir 'manifest.json')
  Compress-Archive -Path (Join-Path $TmpDir '*') -DestinationPath $Out
  Remove-Item -Recurse -Force $TmpDir
} else {
  $Out = "PocketPicker-v$Version.zip"
  Compress-Archive -Path ($Common + 'manifest.json') -DestinationPath $Out
}

Write-Host "Created: $Out"
