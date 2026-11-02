
param(
    [Parameter(Mandatory = $true)]
    [string]$Token,

    [Parameter(Mandatory = $true)]
    [string]$ClassId,

    [string]$BaseUrl = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Stop"

$BaseUrl = $BaseUrl.TrimEnd("/")
$results = [System.Collections.Generic.List[object]]::new()

# ============================================================
# HTTP REQUEST HELPER
# ============================================================

function Get-HttpStatus {
    param(
        [string]$Method,
        [string]$Path,
        [bool]$Authorized = $true,
        [object]$Payload = $null
    )

    $headers = @{}

    if ($Authorized) {
        $headers["Authorization"] = "Bearer $Token"
    }

    $request = @{
        Uri         = "$BaseUrl$Path"
        Method      = $Method
        Headers     = $headers
        ErrorAction = "Stop"
    }

    if ($null -ne $Payload) {
        $request["ContentType"] = "application/json"
        $request["Body"] = $Payload | ConvertTo-Json -Depth 10
    }

    try {
        $response = Invoke-WebRequest @request

        return [int]$response.StatusCode
    }
    catch {
        if ($null -ne $_.Exception.Response) {
            return [int]$_.Exception.Response.StatusCode
        }

        throw
    }
}

# ============================================================
# TEST ASSERTION
# ============================================================

function Assert-Status {
    param(
        [string]$Name,
        [int]$Expected,
        [string]$Method,
        [string]$Path,
        [bool]$Authorized = $true,
        [object]$Payload = $null
    )

    $actual = Get-HttpStatus `
        -Method $Method `
        -Path $Path `
        -Authorized $Authorized `
        -Payload $Payload

    $passed = $actual -eq $Expected

    $results.Add(
        [PSCustomObject]@{
            Test     = $Name
            Expected = $Expected
            Actual   = $actual
            Result   = if ($passed) { "PASS" } else { "FAIL" }
        }
    )
}

# ============================================================
# AUTHENTICATION PRECHECK
# ============================================================

Write-Host ""
Write-Host "ClassFlow Enrollment Regression Tests"
Write-Host "====================================="

$headers = @{
    Authorization = "Bearer $Token"
}

$me = Invoke-RestMethod `
    -Uri "$BaseUrl/api/auth/me" `
    -Headers $headers

if ($me.data.user.role -ne "ADMIN") {
    throw "An ADMIN token is required."
}

Write-Host "Authenticated as ADMIN" -ForegroundColor Green

# ============================================================
# TEST GROUP 1 - GET ENROLLMENTS
# ============================================================

Assert-Status `
    -Name "GET active enrollments" `
    -Expected 200 `
    -Method "GET" `
    -Path "/api/enrollments?classId=$ClassId&status=ACTIVE"

Assert-Status `
    -Name "GET dropped enrollments" `
    -Expected 200 `
    -Method "GET" `
    -Path "/api/enrollments?classId=$ClassId&status=DROPPED"

Assert-Status `
    -Name "GET with pagination" `
    -Expected 200 `
    -Method "GET" `
    -Path "/api/enrollments?classId=$ClassId&page=1&limit=5"

# ============================================================
# TEST GROUP 2 - VALIDATION
# ============================================================

Assert-Status `
    -Name "Missing classId" `
    -Expected 400 `
    -Method "GET" `
    -Path "/api/enrollments"

Assert-Status `
    -Name "Invalid status" `
    -Expected 400 `
    -Method "GET" `
    -Path "/api/enrollments?classId=$ClassId&status=INVALID"

Assert-Status `
    -Name "Invalid class UUID" `
    -Expected 400 `
    -Method "GET" `
    -Path "/api/enrollments?classId=invalid-uuid"

Assert-Status `
    -Name "Invalid page" `
    -Expected 400 `
    -Method "GET" `
    -Path "/api/enrollments?classId=$ClassId&page=-1"

# ============================================================
# TEST GROUP 3 - AUTHENTICATION
# ============================================================

Assert-Status `
    -Name "GET without JWT" `
    -Expected 401 `
    -Method "GET" `
    -Path "/api/enrollments?classId=$ClassId" `
    -Authorized $false

Assert-Status `
    -Name "POST without JWT" `
    -Expected 401 `
    -Method "POST" `
    -Path "/api/enrollments" `
    -Authorized $false `
    -Payload @{
    studentId = [guid]::NewGuid().ToString()
    classId   = $ClassId
}

# ============================================================
# TEST GROUP 4 - NOT FOUND
# ============================================================

$unknownClassId = [guid]::NewGuid().ToString()
$unknownEnrollmentId = [guid]::NewGuid().ToString()

Assert-Status `
    -Name "Class not found" `
    -Expected 404 `
    -Method "GET" `
    -Path "/api/enrollments?classId=$unknownClassId"

Assert-Status `
    -Name "Enrollment not found" `
    -Expected 404 `
    -Method "PATCH" `
    -Path "/api/enrollments/$unknownEnrollmentId/drop"

# ============================================================
# TEST GROUP 5 - DROP VALIDATION
# ============================================================

Assert-Status `
    -Name "Invalid drop UUID" `
    -Expected 400 `
    -Method "PATCH" `
    -Path "/api/enrollments/invalid-uuid/drop"

# ============================================================
# TEST GROUP 6 - DUPLICATE ENROLLMENT
# ============================================================

$active = Invoke-RestMethod `
    -Uri "$BaseUrl/api/enrollments?classId=$ClassId&status=ACTIVE&limit=1" `
    -Headers $headers

if (@($active.data.items).Count -gt 0) {
    $studentId = $active.data.items[0].student.id

    Assert-Status `
        -Name "Duplicate active enrollment" `
        -Expected 409 `
        -Method "POST" `
        -Path "/api/enrollments" `
        -Payload @{
        studentId = $studentId
        classId   = $ClassId
    }
}
else {
    Write-Host "SKIP duplicate test: no ACTIVE enrollment found."
}

# ============================================================
# RESULTS
# ============================================================

Write-Host ""
Write-Host "REGRESSION TEST RESULTS"
Write-Host "======================="

$results | Format-Table -AutoSize

$passed = @($results | Where-Object {
        $_.Result -eq "PASS"
    }).Count

$failed = @($results | Where-Object {
        $_.Result -eq "FAIL"
    }).Count

Write-Host "Passed: $passed" -ForegroundColor Green

if ($failed -gt 0) {
    Write-Host "Failed: $failed" -ForegroundColor Red
    throw "Enrollment regression tests failed."
}

Write-Host ""
Write-Host "Enrollment API regression PASSED!" -ForegroundColor Green
