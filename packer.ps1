Param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$Version
)

$Out = "PocketPicker-v$Version.zip"
$Include = @('icons','background.js','content.js','manifest.json','picker.css','picker.html','picker.js')

Compress-Archive -Path $Include -DestinationPath $Out
