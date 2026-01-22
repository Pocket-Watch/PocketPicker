Param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$Version
)

$Out = "PocketPicker-v$Version.zip"
$Include = @('icons','background.js','content.js','manifest.json','picker.css','picker.html','picker.js')

$Tmp = Join-Path (Get-Location) '.packer_tmp'
if (-not (Test-Path $Tmp)) { New-Item -ItemType Directory -Path $Tmp | Out-Null }

function Remove-Tmp {
  if (Test-Path $Tmp) { Remove-Item $Tmp -Recurse }
}
# Ensure cleanup on script exit
Register-EngineEvent PowerShell.Exiting -Action { Remove-Tmp } | Out-Null

try {
  foreach ($item in $Include) {
    if (Test-Path $item) {
      $parent = Split-Path -Path $item -Parent
      if ([string]::IsNullOrEmpty($parent)) {
        $dest = $Tmp
      } else {
        $dest = Join-Path $Tmp $parent
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
      }
      Copy-Item -Path $item -Destination $dest -Recurse
    } else {
      Write-Warning "$item not found, skipping"
    }
  }

  if (Test-Path $Out) { Remove-Item $Out }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $outFull = Join-Path (Get-Location) $Out
  [System.IO.Compression.ZipFile]::CreateFromDirectory($Tmp, $outFull, [System.IO.Compression.CompressionLevel]::Optimal, $false)

  Write-Output "Created: $Out"
}
finally {
  Remove-Tmp
}
