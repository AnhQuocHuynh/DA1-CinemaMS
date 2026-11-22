[CmdletBinding()]
param(
    [ValidateSet("showtime", "gateway", "all")]
    [string]$Profile = "showtime",

    [string]$Script,
    [switch]$Build,
    [switch]$KeepRunning
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Build forward arguments to pass through to specific script
$forwardArgs = @{}
if ($Build) { $forwardArgs["Build"] = $true }
if ($KeepRunning) { $forwardArgs["KeepRunning"] = $true }
if ($Script) { $forwardArgs["Script"] = $Script }

switch ($Profile) {
    "showtime" {
        $targetScript = Join-Path $ScriptDir "run-showtime-test.ps1"
        & $targetScript @forwardArgs
    }
    "gateway" {
        $targetScript = Join-Path $ScriptDir "run-gateway-test.ps1"
        & $targetScript @forwardArgs
    }
    "all" {
        $targetScript = Join-Path $ScriptDir "run-gateway-test.ps1"
        & $targetScript @forwardArgs
    }
}
