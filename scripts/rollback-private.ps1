param(
  [Parameter(Mandatory = $true)][string]$ImageTag,
  [string]$EnvFile = ".env",
  [string]$ComposeFile = "docker/docker-compose.release.yml"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

if (!(Test-Path $EnvFile)) { throw "Missing env file: $EnvFile" }

$lines = Get-Content $EnvFile
$found = $false
$next = foreach ($line in $lines) {
  if ($line -like "IMAGE_TAG=*") {
    $found = $true
    "IMAGE_TAG=$ImageTag"
  } else {
    $line
  }
}
if (!$found) { $next += "IMAGE_TAG=$ImageTag" }
$next | Set-Content -Encoding UTF8 $EnvFile

docker compose --env-file $EnvFile -f $ComposeFile pull backend frontend
docker compose --env-file $EnvFile -f $ComposeFile up -d backend frontend
python scripts/doctor.py --env $EnvFile --compose $ComposeFile --wait 60
