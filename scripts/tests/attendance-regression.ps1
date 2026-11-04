#requires -Version 5.1
# Run against a dedicated, disposable E2E API/database. Historical rows are retained.
param([string]$BaseUrl = "http://127.0.0.1:3000")
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$passed = $failed = $skipped = 0
$admin = ""
$BaseUrl = $BaseUrl.TrimEnd("/")
if ($env:E2E_DB_ISOLATED -cne "YES" -or $env:E2E_ALLOW_DB_WRITES -cne "YES") {
    throw "Verify the E2E API database and set both E2E_DB_ISOLATED=YES and E2E_ALLOW_DB_WRITES=YES."
}

function Request($method, $path, $body = $null, $token = $admin) {
    $argsMap = @{ Uri = "$BaseUrl/api$path"; Method = $method; UseBasicParsing = $true
        MaximumRedirection = 0; TimeoutSec = 20 
    }
    if ($token) { $argsMap.Headers = @{ Authorization = "Bearer $token" } }
    if ($null -ne $body) {
        $argsMap.ContentType = "application/json"
        $argsMap.Body = ConvertTo-Json $body -Depth 6 -Compress
    }
    if ($PSVersionTable.PSVersion.Major -ge 7) { $argsMap.SkipHttpErrorCheck = $true }
    try { Invoke-WebRequest @argsMap }
    catch [System.Net.WebException] {
        $response = $_.Exception.Response
        if (!$response) { throw }
        $content = $_.ErrorDetails.Message
        if (!$content) {
            $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
            try { $content = $reader.ReadToEnd() } finally { $reader.Dispose() }
        }
        return @{StatusCode = [int]$response.StatusCode; Content = $content }
    }
}
function Expect($name, $method, $path, $status, $body = $null, $token = $admin, $code = "") {
    $r = Request $method $path $body $token
    if ($r.StatusCode -ne $status) { throw "$name expected HTTP $status, received $($r.StatusCode)" }
    $jsonArgs = @{InputObject = $r.Content }
    if ($PSVersionTable.PSVersion -ge [version]"7.5") { $jsonArgs.DateKind = "String" }
    $json = ConvertFrom-Json @jsonArgs
    if ($code -and $json.error.code -cne $code) { throw "$name expected $code, received $($json.error.code)" }
    $script:passed++
    Write-Host "[PASS] $name"
    if ($status -lt 300) { return $json.data }
}
function Check($name, [bool]$condition) {
    if (!$condition) { throw $name }
    $script:passed++
    Write-Host "[PASS] $name"
}
function Skip($name) { $script:skipped++; Write-Host "[SKIP] $name" }
function Login($prefix, $role) {
    $email = [Environment]::GetEnvironmentVariable("E2E_${prefix}_EMAIL")
    $password = [Environment]::GetEnvironmentVariable("E2E_${prefix}_PASSWORD")
    if (!$email -or !$password) { throw "Missing credentials for $prefix" }
    $login = Expect "$prefix login" POST /auth/login 200 @{email = $email; password = $password } ""
    $me = Expect "$prefix profile" GET /auth/me 200 $null $login.accessToken
    Check "$prefix role" ($me.user.role -ceq $role)
    return $login
}
function Session($classId, [datetimeoffset]$start) {
    $body = @{startsAt = $start.ToString("o"); endsAt = $start.AddMilliseconds(1).ToString("o") }
    $s = Expect "Create fixture session" POST "/classes/$classId/sessions" 201 $body
    return "/sessions/$($s.id)"
}
function Read-Mark($expected) {
    $d = Expect "Read attendance" GET $att 200
    Check "Single eligible enrollment" ($d.students.Count -eq 1 -and $d.students[0].enrollmentId -eq $en.id)
    Check "Persisted attendance and summary" ($d.students[0].attendanceStatus -ceq $expected -and
        $d.summary.unmarked -eq [int]($null -eq $expected) -and $d.summary.present -eq [int]($expected -eq "PRESENT") -and
        $d.summary.absent -eq [int]($expected -eq "ABSENT"))
}

$class = $student = $en = $null
$dropped = $false
try {
    $admin = (Login ADMIN ADMIN).accessToken
    $teachers = @(Expect "Teacher options" GET /classes/teacher-options 200)
    if (!$teachers.Count) { throw "At least one teacher profile is required to create a class" }
    $teacherId = $teachers[0].id
    $assigned = $null
    if ($env:E2E_TEACHER_EMAIL -or $env:E2E_TEACHER_PASSWORD) {
        $assigned = Login TEACHER TEACHER
        $teacherId = $assigned.user.teacherId
    }
    $other = $null
    if ($env:E2E_OTHER_TEACHER_EMAIL -or $env:E2E_OTHER_TEACHER_PASSWORD) {
        $other = Login OTHER_TEACHER TEACHER
        if (!$assigned) {
            $candidate = $teachers | Where-Object id -ne $other.user.teacherId | Select-Object -First 1
            if (!$candidate) { throw "The unassigned teacher test requires a second teacher profile" }
            $teacherId = $candidate.id
        }
        Check "Assigned and unassigned teachers are distinct" ($teacherId -ne $other.user.teacherId)
    }
    $tag = [guid]::NewGuid().ToString("N")
    $class = Expect "Create private E2E class" POST /classes 201 @{name = "E2E Attendance $tag"; teacherId = $teacherId }
    $student = Expect "Create fixture student" POST /students 201 @{fullName = "E2E $tag"; studentCode = "STU$([BitConverter]::ToUInt64([guid]::NewGuid().ToByteArray(),0))" }
    $en = (Expect "Enroll fixture student" POST /enrollments 201 @{classId = $class.id; studentId = $student.id }).enrollment
    $start = [datetimeoffset]$en.enrolledAt
    $session = Session $class.id $start
    $att = "$session/attendance"
    $complete = "$session/complete"
    $present = @{enrollmentId = $en.id; status = "PRESENT" }
    $absent = @{enrollmentId = $en.id; status = "ABSENT" }
    $mark = @{records = @($present) }
    foreach ($op in @(@("GET", $att), @("PUT", $att), @("PATCH", $complete))) {
        $body = if ($op[0] -eq "PUT") { $mark }
        Expect "$($op[0]) without JWT" $op[0] $op[1] 401 $body ""
    }
    if ($other) {
        foreach ($op in @(@("GET", $att), @("PUT", $att), @("PATCH", $complete))) {
            $body = if ($op[0] -eq "PUT") { $mark }
            Expect "Unassigned teacher $($op[0])" $op[0] $op[1] 403 $body $other.accessToken
        }
    }
    else { Skip "Unassigned TEACHER authorization (no credentials)" }
    $actor = $admin
    if ($assigned) {
        $actor = $assigned.accessToken
        $null = Expect "Assigned teacher reads session" GET $att 200 $null $actor
    }
    else { Skip "Assigned TEACHER lifecycle (no credentials)" }
    Expect "Malformed session ID" GET /sessions/invalid/attendance 400
    foreach ($invalid in @(@{records = @() }, @{records = @($present, $present) }, @{records = @(@{enrollmentId = $en.id; status = "LATE" }) })) {
        Expect "Invalid attendance batch" PUT $att 400 $invalid $admin VALIDATION_ERROR
    }
    $before = Session $class.id $start.AddMilliseconds(-1)
    $empty = Expect "Read before period starts" GET "$before/attendance" 200
    Check "Before start is ineligible" ($empty.students.Count -eq 0)
    Expect "Complete with zero eligible" PATCH "$before/complete" 409 $null $admin NO_ELIGIBLE_STUDENTS
    $null = Expect "Drop own enrollment" PATCH "/enrollments/$($en.id)/drop" 200
    $dropped = $true
    $after = Session $class.id $start.AddDays(1)
    $empty = Expect "Read after period closes" GET "$after/attendance" 200
    Check "After end is ineligible" ($empty.students.Count -eq 0)
    Read-Mark $null
    Expect "Complete with unmarked student" PATCH $complete 409 $null $actor ATTENDANCE_INCOMPLETE
    $null = Expect "Mark PRESENT" PUT $att 200 $mark $actor
    Read-Mark "PRESENT"
    $mixed = @{records = @($absent, @{enrollmentId = [guid]::NewGuid().ToString(); status = "ABSENT" }) }
    Expect "Reject mixed eligible/ineligible batch" PUT $att 400 $mixed $admin INVALID_ENROLLMENTS
    Read-Mark "PRESENT"
    foreach ($label in "Update to ABSENT", "Repeat ABSENT upsert") {
        $null = Expect $label PUT $att 200 @{records = @($absent) } $actor
        Read-Mark "ABSENT"
    }
    $detail = Expect "Read persisted row count" GET $session 200
    Check "Upsert kept one attendance row" ($detail.attendanceCount -eq 1)
    $done = Expect "Complete marked session" PATCH $complete 200 $null $actor
    Check "Completed with one absent" ($done.status -ceq "COMPLETED" -and $done.summary.absent -eq 1)
    Expect "Repeated complete" PATCH $complete 409 $null $actor INVALID_SESSION_STATUS
    Expect "Attendance locked" PUT $att 409 $mark $actor INVALID_SESSION_STATUS
    Read-Mark "ABSENT"
    $detail = Expect "Read final session" GET $session 200
    Check "Session remains completed" ($detail.status -ceq "COMPLETED")
}
catch {
    $failed++
    Write-Host "[FAIL] $($_.Exception.Message)"
}
finally {
    $cleanup = @()
    if ($en -and !$dropped) { $cleanup += "/enrollments/$($en.id)/drop" }
    if ($student) { $cleanup += "/students/$($student.id)/archive" }
    if ($class) { $cleanup += "/classes/$($class.id)/archive" }
    foreach ($path in $cleanup) {
        try { $null = Expect "Cleanup $path" PATCH $path 200 }
        catch { $failed++; Write-Host "[FAIL] Cleanup $path" }
    }
    Write-Host "PASS=$passed FAIL=$failed SKIP=$skipped"
}
if ($failed) { exit 1 }
