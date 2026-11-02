
param(
    [string]$BaseUrl = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Stop"

# ============================================================
# M18.2.5 - CLASS SESSION API REGRESSION TESTS
# Run only against an isolated test database.
# ============================================================

$script:Passed = 0
$script:Failed = 0
$script:Skipped = 0

$createdSessionIds = @()
$adminToken = $null

function Require-Environment {
    param([string]$Name)

    $value = [Environment]::GetEnvironmentVariable($Name)

    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Missing required environment variable: $Name"
    }

    return $value
}

function To-IsoUtc {
    param([datetime]$Value)

    return $Value.ToUniversalTime().ToString(
        "yyyy-MM-ddTHH:mm:ss'Z'",
        [System.Globalization.CultureInfo]::InvariantCulture
    )
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [string]$Token = "",
        $Body = $null
    )

    $params = @{
        Uri             = "$BaseUrl$Path"
        Method          = $Method
        UseBasicParsing = $true
        ErrorAction     = "Stop"
    }

    if ($Token) {
        $params.Headers = @{
            Authorization = "Bearer $Token"
        }
    }

    if ($null -ne $Body) {
        $params.ContentType = "application/json"
        $params.Body = ConvertTo-Json -InputObject $Body -Depth 10
    }

    try {
        $response = Invoke-WebRequest @params

        $parsedBody = $null

        if ($response.Content) {
            $parsedBody = $response.Content | ConvertFrom-Json
        }

        return [pscustomobject]@{
            Status = [int]$response.StatusCode
            Data   = $parsedBody
        }
    }
    catch {
        $response = $_.Exception.Response

        if ($null -eq $response) {
            throw
        }

        return [pscustomobject]@{
            Status = [int]$response.StatusCode
            Data   = $null
        }
    }
}

function Check-Status {
    param(
        [string]$Name,
        [int]$Actual,
        [int]$Expected
    )

    if ($Actual -eq $Expected) {
        $script:Passed++
        Write-Host "[PASS] $Name ($Actual)" -ForegroundColor Green
        return $true
    }

    $script:Failed++
    Write-Host (
        "[FAIL] {0}: expected {1}, received {2}" -f
        $Name, $Expected, $Actual
    ) -ForegroundColor Red

    return $false
}

function Check-Condition {
    param(
        [string]$Name,
        [bool]$Condition
    )

    if ($Condition) {
        $script:Passed++
        Write-Host "[PASS] $Name" -ForegroundColor Green
        return
    }

    $script:Failed++
    Write-Host "[FAIL] $Name" -ForegroundColor Red
}

function Skip-Case {
    param([string]$Name)

    $script:Skipped++
    Write-Host "[SKIP] $Name" -ForegroundColor Yellow
}

function Get-AuthToken {
    param(
        [string]$Email,
        [string]$Password
    )

    $response = Invoke-Api `
        -Method "POST" `
        -Path "/api/auth/login" `
        -Body @{
        email    = $Email
        password = $Password
    }

    if ($response.Status -ne 200) {
        throw "Authentication failed with HTTP $($response.Status)."
    }

    $token = $response.Data.data.accessToken

    if (-not $token) {
        throw "Authentication response does not contain accessToken."
    }

    return [string]$token
}

# ============================================================
# SAFETY GUARDS
# ============================================================

if ($env:E2E_ALLOW_DB_WRITES -ne "YES") {
    throw "Set E2E_ALLOW_DB_WRITES=YES for an isolated test database."
}

if ($env:E2E_DB_ISOLATED -ne "YES") {
    throw "Set E2E_DB_ISOLATED=YES after verifying the database is isolated."
}

$adminEmail = Require-Environment "E2E_ADMIN_EMAIL"
$adminPassword = Require-Environment "E2E_ADMIN_PASSWORD"
$className = Require-Environment "E2E_CLASS_NAME"

if ($className -notmatch "E2E") {
    throw "Test class name must contain E2E."
}

$BaseUrl = $BaseUrl.TrimEnd("/")

Write-Host ""
Write-Host "CLASSFLOW - M18.2.5 SESSION REGRESSION" -ForegroundColor Cyan
Write-Host "API: $BaseUrl"
Write-Host "Fixture: $className"
Write-Host ""

try {
    # ========================================================
    # SETUP: ADMIN LOGIN AND TEST CLASS
    # ========================================================

    $adminToken = Get-AuthToken `
        -Email $adminEmail `
        -Password $adminPassword

    $me = Invoke-Api `
        -Method "GET" `
        -Path "/api/auth/me" `
        -Token $adminToken

    if ($me.Status -ne 200 -or
        $me.Data.data.user.role -ne "ADMIN") {
        throw "E2E credentials must belong to an ADMIN."
    }

    $encodedName = [uri]::EscapeDataString($className)

    $classes = Invoke-Api `
        -Method "GET" `
        -Path "/api/classes?search=$encodedName&page=1&limit=100" `
        -Token $adminToken

    if ($classes.Status -ne 200) {
        throw "Unable to load test classes."
    }

    $matches = @(
        $classes.Data.data.items |
        Where-Object { $_.name -ceq $className }
    )

    if ($matches.Count -ne 1) {
        throw "Expected exactly one E2E class. Found $($matches.Count)."
    }

    $classId = [string]$matches[0].id
    $listPath = "/api/classes/$classId/sessions"

    Write-Host "Fixture class found: $classId" -ForegroundColor Green
    Write-Host ""

    # Generate a unique future time window.
    # Avoid modifying existing class sessions.

    $futureDays = Get-Random -Minimum 90 -Maximum 400
    $randomMinute = Get-Random -Minimum 0 -Maximum 1440

    $baseTime = [datetime]::UtcNow.Date.
    AddDays($futureDays).
    AddMinutes($randomMinute)

    $startA = $baseTime
    $endA = $baseTime.AddMinutes(90)

    $startB = $baseTime.AddHours(4)
    $endB = $baseTime.AddHours(5)

    $bodyA = @{
        startsAt = To-IsoUtc $startA
        endsAt   = To-IsoUtc $endA
    }

    $bodyB = @{
        startsAt = To-IsoUtc $startB
        endsAt   = To-IsoUtc $endB
    }

    # ========================================================
    # GROUP A: READ AND VALIDATION
    # ========================================================

    Write-Host "GROUP A - READ AND VALIDATION" -ForegroundColor Cyan

    $r = Invoke-Api -Method "GET" -Path $listPath
    Check-Status "List without JWT" $r.Status 401 | Out-Null

    $r = Invoke-Api `
        -Method "GET" `
        -Path "/api/classes/invalid-id/sessions" `
        -Token $adminToken

    Check-Status "Invalid class UUID" $r.Status 400 | Out-Null

    $r = Invoke-Api `
        -Method "GET" `
        -Path "$listPath`?status=INVALID" `
        -Token $adminToken

    Check-Status "Invalid status filter" $r.Status 400 | Out-Null

    $r = Invoke-Api `
        -Method "GET" `
        -Path $listPath `
        -Token $adminToken

    Check-Status "ADMIN lists sessions" $r.Status 200 | Out-Null

    $r = Invoke-Api `
        -Method "GET" `
        -Path "/api/sessions/$([guid]::NewGuid())" `
        -Token $adminToken

    Check-Status "Unknown session ID" $r.Status 404 | Out-Null

    # ========================================================
    # GROUP B: CREATE VALIDATION
    # ========================================================

    Write-Host ""
    Write-Host "GROUP B - CREATE VALIDATION" -ForegroundColor Cyan

    $r = Invoke-Api `
        -Method "POST" `
        -Path $listPath `
        -Token $adminToken `
        -Body @{
        startsAt = To-IsoUtc $endA
        endsAt   = To-IsoUtc $startA
    }

    Check-Status "Reject reversed time range" $r.Status 400 | Out-Null

    $r = Invoke-Api `
        -Method "POST" `
        -Path $listPath `
        -Token $adminToken `
        -Body @{
        startsAt   = To-IsoUtc $startA
        endsAt     = To-IsoUtc $endA
        scheduleId = [guid]::NewGuid().ToString()
    }

    Check-Status "Reject invalid schedule" $r.Status 400 | Out-Null

    $r = Invoke-Api `
        -Method "POST" `
        -Path $listPath `
        -Token $adminToken `
        -Body @{
        startsAt = To-IsoUtc $startA
        endsAt   = To-IsoUtc $endA
        status   = "COMPLETED"
    }

    Check-Status "Reject unknown create field" $r.Status 400 | Out-Null

    # ========================================================
    # GROUP C: CREATE AND READ LIFECYCLE
    # ========================================================

    Write-Host ""
    Write-Host "GROUP C - SESSION LIFECYCLE" -ForegroundColor Cyan

    $createdA = Invoke-Api `
        -Method "POST" `
        -Path $listPath `
        -Token $adminToken `
        -Body $bodyA

    $createSucceeded = Check-Status `
        "Create session A" $createdA.Status 201

    if (-not $createSucceeded) {
        throw "Cannot continue without session A."
    }

    $sessionA = [string]$createdA.Data.data.id

    if (-not $sessionA) {
        throw "Create session A returned no ID."
    }

    $createdSessionIds += $sessionA

    Check-Condition `
        "New session has SCHEDULED status" `
    ($createdA.Data.data.status -eq "SCHEDULED")

    $detailA = Invoke-Api `
        -Method "GET" `
        -Path "/api/sessions/$sessionA" `
        -Token $adminToken

    Check-Status "GET Session Detail" $detailA.Status 200 | Out-Null

    $r = Invoke-Api `
        -Method "GET" `
        -Path "/api/sessions/$sessionA"

    Check-Status "Detail without JWT" $r.Status 401 | Out-Null

    # Verify the session is included in the filtered list.

    $from = [uri]::EscapeDataString(
        (To-IsoUtc $startA.AddMinutes(-1))
    )

    $to = [uri]::EscapeDataString(
        (To-IsoUtc $startA.AddMinutes(1))
    )

    $filteredList = Invoke-Api `
        -Method "GET" `
        -Path "$listPath`?from=$from&to=$to" `
        -Token $adminToken

    Check-Status `
        "GET filtered sessions" $filteredList.Status 200 | Out-Null

    $found = @(
        $filteredList.Data.data.items |
        Where-Object { $_.id -eq $sessionA }
    )

    Check-Condition `
        "Created session appears in list" `
    ($found.Count -eq 1)

    # ========================================================
    # GROUP D: OVERLAP AND UPDATE
    # ========================================================

    Write-Host ""
    Write-Host "GROUP D - OVERLAP AND UPDATE" -ForegroundColor Cyan

    $r = Invoke-Api `
        -Method "POST" `
        -Path $listPath `
        -Token $adminToken `
        -Body @{
        startsAt = To-IsoUtc $startA.AddMinutes(30)
        endsAt   = To-IsoUtc $startA.AddMinutes(60)
    }

    Check-Status "Reject overlapping create" $r.Status 409 | Out-Null

    $createdB = Invoke-Api `
        -Method "POST" `
        -Path $listPath `
        -Token $adminToken `
        -Body $bodyB

    $createBSucceeded = Check-Status `
        "Create session B" $createdB.Status 201

    if (-not $createBSucceeded) {
        throw "Cannot continue without session B."
    }

    $sessionB = [string]$createdB.Data.data.id

    if (-not $sessionB) {
        throw "Create session B returned no ID."
    }

    $createdSessionIds += $sessionB

    $updatedA = Invoke-Api `
        -Method "PATCH" `
        -Path "/api/sessions/$sessionA" `
        -Token $adminToken `
        -Body @{
        startsAt = To-IsoUtc $startA.AddMinutes(15)
        endsAt   = To-IsoUtc $endA.AddMinutes(15)
    }

    Check-Status "Update scheduled session" $updatedA.Status 200 |
    Out-Null

    $r = Invoke-Api `
        -Method "PATCH" `
        -Path "/api/sessions/$sessionA" `
        -Token $adminToken `
        -Body @{
        startsAt = To-IsoUtc $startB.AddMinutes(10)
        endsAt   = To-IsoUtc $startB.AddMinutes(40)
    }

    Check-Status "Reject overlapping update" $r.Status 409 | Out-Null

    # ========================================================
    # GROUP E: TEACHER AUTHORIZATION
    # ========================================================

    Write-Host ""
    Write-Host "GROUP E - TEACHER AUTHORIZATION" -ForegroundColor Cyan

    $teacherEmail = $env:E2E_TEACHER_EMAIL
    $teacherPassword = $env:E2E_TEACHER_PASSWORD

    if ($teacherEmail -and $teacherPassword) {
        $teacherToken = Get-AuthToken `
            -Email $teacherEmail `
            -Password $teacherPassword

        $teacherMe = Invoke-Api `
            -Method "GET" `
            -Path "/api/auth/me" `
            -Token $teacherToken

        if ($teacherMe.Status -ne 200 -or
            $teacherMe.Data.data.user.role -ne "TEACHER") {
            throw "E2E_TEACHER_EMAIL is not a TEACHER account."
        }

        $r = Invoke-Api `
            -Method "GET" `
            -Path $listPath `
            -Token $teacherToken

        Check-Status `
            "Assigned TEACHER lists sessions" $r.Status 200 |
        Out-Null

        $r = Invoke-Api `
            -Method "GET" `
            -Path "/api/sessions/$sessionA" `
            -Token $teacherToken

        Check-Status `
            "Assigned TEACHER reads detail" $r.Status 200 |
        Out-Null

        $r = Invoke-Api `
            -Method "POST" `
            -Path $listPath `
            -Token $teacherToken `
            -Body $bodyA

        Check-Status `
            "TEACHER cannot create" $r.Status 403 | Out-Null

        $r = Invoke-Api `
            -Method "PATCH" `
            -Path "/api/sessions/$sessionA" `
            -Token $teacherToken `
            -Body @{
            endsAt = To-IsoUtc $endA.AddMinutes(30)
        }

        Check-Status `
            "TEACHER cannot update" $r.Status 403 | Out-Null

        $r = Invoke-Api `
            -Method "PATCH" `
            -Path "/api/sessions/$sessionA/cancel" `
            -Token $teacherToken

        Check-Status `
            "TEACHER cannot cancel" $r.Status 403 | Out-Null
    }
    else {
        1..5 | ForEach-Object {
            Skip-Case "Assigned TEACHER test $_"
        }
    }

    $otherEmail = $env:E2E_OTHER_TEACHER_EMAIL
    $otherPassword = $env:E2E_OTHER_TEACHER_PASSWORD

    if ($otherEmail -and $otherPassword) {
        $otherToken = Get-AuthToken `
            -Email $otherEmail `
            -Password $otherPassword

        $otherMe = Invoke-Api `
            -Method "GET" `
            -Path "/api/auth/me" `
            -Token $otherToken

        if ($otherMe.Status -ne 200 -or
            $otherMe.Data.data.user.role -ne "TEACHER") {
            throw "E2E_OTHER_TEACHER_EMAIL is not a TEACHER."
        }

        $r = Invoke-Api `
            -Method "GET" `
            -Path $listPath `
            -Token $otherToken

        Check-Status `
            "Other TEACHER cannot list sessions" $r.Status 403 |
        Out-Null

        $r = Invoke-Api `
            -Method "GET" `
            -Path "/api/sessions/$sessionA" `
            -Token $otherToken

        Check-Status `
            "Other TEACHER cannot read detail" $r.Status 403 |
        Out-Null
    }
    else {
        Skip-Case "Other TEACHER cannot list sessions"
        Skip-Case "Other TEACHER cannot read detail"
    }

    # ========================================================
    # GROUP F: CANCEL AND INVALID STATE TRANSITIONS
    # ========================================================

    Write-Host ""
    Write-Host "GROUP F - CANCEL AND STATE TRANSITIONS" -ForegroundColor Cyan

    $cancelA = Invoke-Api `
        -Method "PATCH" `
        -Path "/api/sessions/$sessionA/cancel" `
        -Token $adminToken

    Check-Status "Cancel scheduled session" $cancelA.Status 200 |
    Out-Null

    $r = Invoke-Api `
        -Method "PATCH" `
        -Path "/api/sessions/$sessionA/cancel" `
        -Token $adminToken

    Check-Status "Reject repeated cancellation" $r.Status 409 |
    Out-Null

    $r = Invoke-Api `
        -Method "PATCH" `
        -Path "/api/sessions/$sessionA" `
        -Token $adminToken `
        -Body @{
        endsAt = To-IsoUtc $endA.AddMinutes(20)
    }

    Check-Status "Reject update after cancellation" $r.Status 409 |
    Out-Null

}
catch {
    $script:Failed++

    Write-Host ""
    Write-Host "[ERROR] Regression interrupted." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
finally {
    # ========================================================
    # BEST-EFFORT CLEANUP
    # ========================================================

    Write-Host ""
    Write-Host "CLEANUP - CANCEL TEST SESSIONS" -ForegroundColor Cyan

    foreach ($id in $createdSessionIds) {
        try {
            $current = Invoke-Api `
                -Method "GET" `
                -Path "/api/sessions/$id" `
                -Token $adminToken

            if ($current.Status -ne 200) {
                Write-Host "[WARN] Cannot inspect $id" `
                    -ForegroundColor Yellow
                $script:Failed++
                continue
            }

            if ($current.Data.data.status -eq "SCHEDULED") {
                $cleanup = Invoke-Api `
                    -Method "PATCH" `
                    -Path "/api/sessions/$id/cancel" `
                    -Token $adminToken

                if ($cleanup.Status -ne 200) {
                    Write-Host "[WARN] Cannot cancel $id" `
                        -ForegroundColor Yellow
                    $script:Failed++
                }
                else {
                    Write-Host "[CLEANUP] Cancelled $id"
                }
            }
        }
        catch {
            Write-Host "[WARN] Cleanup failed for $id" `
                -ForegroundColor Yellow
            $script:Failed++
        }
    }
}

# ============================================================
# FINAL SUMMARY
# ============================================================

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "M18.2.5 - REGRESSION SUMMARY"
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "PASSED : $script:Passed" -ForegroundColor Green
Write-Host "FAILED : $script:Failed" -ForegroundColor Red
Write-Host "SKIPPED: $script:Skipped" -ForegroundColor Yellow

if ($script:Failed -gt 0) {
    Write-Host "RESULT: FAILED" -ForegroundColor Red
    exit 1
}

if ($script:Skipped -gt 0) {
    Write-Host "RESULT: PASS WITH SKIPPED CASES" `
        -ForegroundColor Yellow
    exit 0
}

Write-Host "RESULT: ALL TESTS PASSED" -ForegroundColor Green
exit 0
