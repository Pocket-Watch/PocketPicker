param(
  [Parameter(Mandatory=$true, Position=0)]
  [string] $Version,
  [switch] $mv3
)

$Out = "PocketPicker-v$Version.zip"
$Include = @('icons','background.js','content.js','picker.css','picker.html','picker.js')

if ($mv3) {
  New-Item -ItemType Directory -Path 'tmp' -Force
  $TmpManifest = 'tmp/manifest.json'
  Copy-Item -Path 'manifest_v3.json' -Destination $TmpManifest -Force
  $Include += $tmpManifest
} else {
  $Include += 'manifest.json'
}

Compress-Archive -Path $Include -DestinationPath $Out
Write-Host "Created: $Out"
if ($mv3) {
  Remove-Item -Path 'tmp' -Recurse -Force
}

