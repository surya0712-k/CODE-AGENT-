# Builds FolderPicker.exe using .NET Framework csc (no dotnet SDK required)
$ErrorActionPreference = 'Stop'

$here = $PSScriptRoot

Get-Process -Name 'FolderPicker' -ErrorAction SilentlyContinue | Stop-Process -Force
$outExe = Join-Path $here 'FolderPicker.exe'
$coreDll = Join-Path $here 'Microsoft.WindowsAPICodePack.dll'
$shellDll = Join-Path $here 'Microsoft.WindowsAPICodePack.Shell.dll'

function Get-NuGetDll {
    param(
        [string]$PackageId,
        [string]$Version,
        [string]$DllName
    )

    $nupkg = Join-Path $here "$PackageId.$Version.nupkg"
    $zip = Join-Path $here "$PackageId.$Version.zip"
    $extract = Join-Path $here ".$PackageId-$Version"

    if (-not (Test-Path $nupkg)) {
        $url = "https://www.nuget.org/api/v2/package/$PackageId/$Version"
        Write-Host "Downloading $PackageId $Version..."
        Invoke-WebRequest -Uri $url -OutFile $nupkg -UseBasicParsing
    }

    if (-not (Test-Path $extract)) {
        Copy-Item $nupkg $zip -Force
        if (Test-Path $extract) {
            Remove-Item $extract -Recurse -Force
        }
        Expand-Archive $zip $extract -Force
    }

    $dll = Get-ChildItem -Path $extract -Recurse -Filter $DllName | Select-Object -First 1
    if (-not $dll) {
        throw "Could not find $DllName in $PackageId package."
    }

    return $dll.FullName
}

$coreRef = Get-NuGetDll -PackageId 'WindowsAPICodePack-Core' -Version '1.1.0' -DllName 'Microsoft.WindowsAPICodePack.dll'
$shellRef = Get-NuGetDll -PackageId 'WindowsAPICodePack-Shell' -Version '1.1.0' -DllName 'Microsoft.WindowsAPICodePack.Shell.dll'

Copy-Item $coreRef $coreDll -Force
Copy-Item $shellRef $shellDll -Force

$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) {
    throw 'csc.exe not found. Install .NET Framework 4.x.'
}

Write-Host 'Compiling FolderPicker.exe...'
& $csc `
    /nologo `
    /target:exe `
    /platform:anycpu `
    /out:$outExe `
    /reference:$coreDll `
    /reference:$shellDll `
    /reference:System.Windows.Forms.dll `
    (Join-Path $here 'Program.netfx.cs')

if (-not (Test-Path $outExe)) {
    throw 'Build failed: FolderPicker.exe was not created.'
}

Write-Host "Built: $outExe"
