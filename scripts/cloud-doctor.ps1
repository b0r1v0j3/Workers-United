param(
    [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
if (Get-Variable -Name ProgressPreference -ErrorAction SilentlyContinue) {
    $ProgressPreference = "SilentlyContinue"
}

function Add-Result {
    param(
        [string]$Service,
        [string]$Status,
        [string]$Details
    )
    [PSCustomObject]@{
        Service = $Service
        Status = $Status
        Details = $Details
    }
}

function Load-EnvFile {
    param([string]$EnvFilePath)
    if (-not (Test-Path $EnvFilePath)) {
        return
    }

    Get-Content -Path $EnvFilePath | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $eqIndex = $line.IndexOf("=")
        if ($eqIndex -le 0) { return }
        $name = $line.Substring(0, $eqIndex).Trim()
        $value = $line.Substring($eqIndex + 1).Trim().Trim('"')
        if (-not [string]::IsNullOrWhiteSpace($name) -and -not [string]::IsNullOrWhiteSpace($value)) {
            if (-not [Environment]::GetEnvironmentVariable($name, "Process")) {
                [Environment]::SetEnvironmentVariable($name, $value, "Process")
            }
        }
    }
}

function Get-EnvValue {
    param([string]$Name)
    $value = [Environment]::GetEnvironmentVariable($Name, "Process")
    if ($value) { return $value }
    $value = [Environment]::GetEnvironmentVariable($Name, "User")
    if ($value) { return $value }
    $value = [Environment]::GetEnvironmentVariable($Name, "Machine")
    return $value
}

function Get-SupabaseToken {
    $token = Get-EnvValue -Name "SUPABASE_ACCESS_TOKEN"
    if ($token) { return $token }

    $tokenFile = Join-Path $ProjectPath ".supabase-token"
    if (-not (Test-Path $tokenFile)) { return $null }

    $raw = Get-Content -Path $tokenFile -Raw
    $match = [regex]::Match($raw, "sbp_[A-Za-z0-9]+")
    if ($match.Success) {
        return $match.Value
    }
    return $null
}

function Normalize-OutputLine {
    param([string]$Line)
    if (-not $Line) { return "" }
    return $Line.Trim()
}

$results = @()

Load-EnvFile -EnvFilePath (Join-Path $ProjectPath ".env.local")

# Git
try {
    git -C $ProjectPath fetch origin --prune --quiet
    $results += Add-Result -Service "GitHub" -Status "OK" -Details "Remote fetch works"
} catch {
    $results += Add-Result -Service "GitHub" -Status "FAIL" -Details $_.Exception.Message
}

# Vercel
try {
    $vercelToken = Get-EnvValue -Name "VERCEL_TOKEN"
    if (-not $vercelToken) {
        throw "VERCEL_TOKEN is not set"
    }
    $who = cmd /d /s /c "vercel whoami --token=$vercelToken 2>&1"
    $vercelOutput = @($who | ForEach-Object { Normalize-OutputLine -Line $_.ToString() } | Where-Object { $_ })
    $vercelUser = $vercelOutput | Where-Object {
        $_ -notmatch "^Vercel CLI" -and $_ -notmatch "^WARN!" -and $_ -notmatch "^(Error|error):"
    } | Select-Object -First 1

    if ($LASTEXITCODE -ne 0 -and -not $vercelUser) {
        $reason = ($vercelOutput | Select-Object -First 4) -join " | "
        if (-not $reason) { $reason = "Unknown Vercel CLI failure" }
        throw $reason
    }

    if (-not $vercelUser) { $vercelUser = "unknown" }
    $results += Add-Result -Service "Vercel" -Status "OK" -Details "Authenticated as $vercelUser"
} catch {
    $results += Add-Result -Service "Vercel" -Status "FAIL" -Details $_.Exception.Message
}

# Supabase
try {
    $supabaseToken = Get-SupabaseToken
    if (-not $supabaseToken) {
        throw "SUPABASE_ACCESS_TOKEN not found"
    }
    [Environment]::SetEnvironmentVariable("SUPABASE_ACCESS_TOKEN", $supabaseToken, "Process")
    $projectList = cmd /d /s /c "npx supabase projects list 2>&1"
    if ($LASTEXITCODE -ne 0) {
        throw ($projectList | Out-String).Trim()
    }
    $results += Add-Result -Service "Supabase" -Status "OK" -Details "CLI auth and project listing works"
} catch {
    $results += Add-Result -Service "Supabase" -Status "FAIL" -Details $_.Exception.Message
}

# Stripe
try {
    $stripeKey = Get-EnvValue -Name "STRIPE_SECRET_KEY"
    if (-not $stripeKey) {
        throw "STRIPE_SECRET_KEY is not set"
    }
    $stripe = Invoke-RestMethod -Uri "https://api.stripe.com/v1/account" -Method Get -Headers @{
        Authorization = "Bearer $stripeKey"
    }
    $details = "Connected account $($stripe.id); charges_enabled=$($stripe.charges_enabled)"
    $results += Add-Result -Service "Stripe" -Status "OK" -Details $details
} catch {
    $results += Add-Result -Service "Stripe" -Status "FAIL" -Details $_.Exception.Message
}

# Production /api/health check (optional)
try {
    $baseUrl = Get-EnvValue -Name "NEXT_PUBLIC_BASE_URL"
    if (-not $baseUrl) {
        $results += Add-Result -Service "App Health" -Status "WARN" -Details "NEXT_PUBLIC_BASE_URL is not set"
    } else {
        $healthUrl = "$($baseUrl.TrimEnd('/'))/api/health"
        $cronSecret = Get-EnvValue -Name "CRON_SECRET"
        $headers = @{}
        if ($cronSecret) {
            $headers["Authorization"] = "Bearer $cronSecret"
        }

        try {
            $health = Invoke-RestMethod -Uri $healthUrl -Method Get -Headers $headers -TimeoutSec 20
            $statusText = if ($health.status) { $health.status } else { "unknown" }
            if ($statusText -eq "healthy") {
                $results += Add-Result -Service "App Health" -Status "OK" -Details "/api/health status=healthy"
            } elseif ($statusText -eq "degraded") {
                $results += Add-Result -Service "App Health" -Status "WARN" -Details "/api/health status=degraded"
            } else {
                $results += Add-Result -Service "App Health" -Status "WARN" -Details "/api/health returned status=$statusText"
            }
        } catch {
            $results += Add-Result -Service "App Health" -Status "FAIL" -Details $_.Exception.Message
        }
    }
} catch {
    $results += Add-Result -Service "App Health" -Status "FAIL" -Details $_.Exception.Message
}

$results | Format-Table -AutoSize

$failed = @($results | Where-Object { $_.Status.ToString().Trim().ToUpper() -eq "FAIL" }).Count
if ($failed -gt 0) {
    Write-Host ""
    Write-Host "Cloud doctor finished with $failed failure(s)." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Cloud doctor finished successfully." -ForegroundColor Green
exit 0
