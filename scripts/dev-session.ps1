# Keeps the BeyondSAT dev server running while this Windows user is signed in.
# Sign-in starts it. Waking from sleep starts it again if it has stopped.
# Sign-out, shutdown, and restart stop it.

param(
  [switch]$Install
)

$ErrorActionPreference = "Continue"
$Root = Split-Path $PSScriptRoot -Parent
$LogDir = Join-Path $env:LOCALAPPDATA "BeyondSAT"
$LogFile = Join-Path $LogDir "dev-session.log"
$Node = "C:\Program Files\nodejs\node.exe"
$Vite = Join-Path $Root "node_modules\vite\bin\vite.js"

function Write-Log([string]$Message) {
  if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
  }
  $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -Path $LogFile -Value $line -Encoding utf8
}

function Install-DevSession {
  $startup = [Environment]::GetFolderPath("Startup")
  $lnkPath = Join-Path $startup "BeyondSAT Dev Server.lnk"
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($lnkPath)
  $shortcut.TargetPath = Join-Path $PSHOME "powershell.exe"
  $shortcut.Arguments = "-NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  $shortcut.WorkingDirectory = $Root
  $shortcut.WindowStyle = 7
  $shortcut.Description = "Start the BeyondSAT dev server"
  $shortcut.Save()
  Write-Log "installed startup shortcut $lnkPath"

  $schedule = Get-Service Schedule -ErrorAction SilentlyContinue
  if ($schedule -and $schedule.Status -ne "Running") {
    try {
      Set-Service Schedule -StartupType Automatic -ErrorAction Stop
      Start-Service Schedule -ErrorAction Stop
    } catch {
      Write-Log "Task Scheduler is off ($($_.Exception.Message)). The Startup shortcut is the wake task."
      return
    }
  }

  try {
    $arg = "-NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    $action = New-ScheduledTaskAction -Execute (Join-Path $PSHOME "powershell.exe") -Argument $arg -WorkingDirectory $Root
    $logon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero)
    Register-ScheduledTask -TaskName "BeyondSAT Dev Server" -Action $action -Trigger $logon -Settings $settings -Force | Out-Null
    Write-Log "registered scheduled task BeyondSAT Dev Server"
  } catch {
    Write-Log "scheduled task was not created: $($_.Exception.Message)"
  }
}

if ($Install) {
  Install-DevSession
  exit 0
}

if ([System.Threading.Thread]::CurrentThread.GetApartmentState() -ne "STA") {
  Start-Process -FilePath (Join-Path $PSHOME "powershell.exe") -ArgumentList @(
    "-NoProfile", "-STA", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", $PSCommandPath
  ) -WindowStyle Hidden
  exit 0
}

$mutex = New-Object System.Threading.Mutex($false, "Local\BeyondSAT-dev-session")
if (-not $mutex.WaitOne(0)) {
  exit 0
}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
namespace BeyondSat {
  public static class ProcessJob {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);
    [DllImport("kernel32.dll")]
    public static extern bool SetInformationJobObject(IntPtr hJob, int JobObjectInfoClass, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength);
    [DllImport("kernel32.dll")]
    public static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);
    [DllImport("kernel32.dll")]
    public static extern bool CloseHandle(IntPtr hObject);

    [StructLayout(LayoutKind.Sequential)]
    struct BasicLimits {
      public long PerProcessUserTimeLimit;
      public long PerJobUserTimeLimit;
      public uint LimitFlags;
      public UIntPtr MinimumWorkingSetSize;
      public UIntPtr MaximumWorkingSetSize;
      public uint ActiveProcessLimit;
      public UIntPtr Affinity;
      public uint PriorityClass;
      public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct IoCounters {
      public ulong ReadOperationCount;
      public ulong WriteOperationCount;
      public ulong OtherOperationCount;
      public ulong ReadTransferCount;
      public ulong WriteTransferCount;
      public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct ExtendedLimits {
      public BasicLimits BasicLimitInformation;
      public IoCounters IoInfo;
      public UIntPtr ProcessMemoryLimit;
      public UIntPtr JobMemoryLimit;
      public UIntPtr PeakProcessMemoryUsed;
      public UIntPtr PeakJobMemoryUsed;
    }

    public static IntPtr CreateKillOnCloseJob() {
      IntPtr job = CreateJobObject(IntPtr.Zero, null);
      if (job == IntPtr.Zero) return IntPtr.Zero;
      ExtendedLimits info = new ExtendedLimits();
      info.BasicLimitInformation.LimitFlags = 0x2000;
      int length = Marshal.SizeOf(typeof(ExtendedLimits));
      IntPtr ptr = Marshal.AllocHGlobal(length);
      try {
        Marshal.StructureToPtr(info, ptr, false);
        SetInformationJobObject(job, 9, ptr, (uint)length);
      } finally {
        Marshal.FreeHGlobal(ptr);
      }
      return job;
    }
  }
}
"@

$state = @{
  Stop = $false
  Process = $null
  ProcessId = 0
  Announced = $false
  PortBusyLogged = $false
  Job = [BeyondSat.ProcessJob]::CreateKillOnCloseJob()
  Root = $Root
}

function Stop-DevServer([hashtable]$State) {
  $target = [int]$State.ProcessId
  $taskkill = Join-Path $env:SystemRoot "System32\taskkill.exe"
  if ($target -gt 0) {
    & $taskkill /PID $target /T /F 2>$null | Out-Null
  }
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.CommandLine -like "*beyond-sat*vite.js*") {
      & $taskkill /PID $_.ProcessId /T /F 2>$null | Out-Null
    }
  }
  if ($State.Job -ne [IntPtr]::Zero) {
    [BeyondSat.ProcessJob]::CloseHandle($State.Job) | Out-Null
    $State.Job = [IntPtr]::Zero
  }
  $State.ProcessId = 0
  $State.Process = $null
  Write-Log "stopped dev server"
}

function Update-DevServer([hashtable]$State) {
  if ($State.Process -and -not $State.Process.HasExited) { return }

  $owner = $null
  try {
    $owner = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty OwningProcess
  } catch {
    $owner = $null
  }

  if ($owner) {
    $cmd = ""
    try {
      $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $owner" -ErrorAction SilentlyContinue).CommandLine
    } catch {
      $cmd = ""
    }
    if ($cmd -like "*beyond-sat*vite.js*") {
      $State.Process = Get-Process -Id $owner -ErrorAction SilentlyContinue
      $State.ProcessId = [int]$owner
      $State.PortBusyLogged = $false
      if (-not $State.Announced) {
        Write-Log "dev server already running (pid $owner)"
        $State.Announced = $true
      }
      return
    }
    if (-not $State.PortBusyLogged) {
      Write-Log "port 8080 is taken by pid $owner"
      $State.PortBusyLogged = $true
    }
    return
  }

  if (-not (Test-Path $Vite)) {
    Write-Log "vite is not installed at $Vite"
    return
  }

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $Node
  $psi.Arguments = "`"$Vite`" dev"
  $psi.WorkingDirectory = $State.Root
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $proc = [System.Diagnostics.Process]::Start($psi)
  if ($State.Job -ne [IntPtr]::Zero) {
    [BeyondSat.ProcessJob]::AssignProcessToJobObject($State.Job, $proc.Handle) | Out-Null
  }
  $State.Process = $proc
  $State.ProcessId = $proc.Id
  $State.Announced = $true
  $State.PortBusyLogged = $false
  Write-Log "started dev server (pid $($proc.Id))"
}

Add-Type -AssemblyName System.Windows.Forms
Write-Log "watching $Root"

Register-ObjectEvent -InputObject ([Microsoft.Win32.SystemEvents]) -EventName SessionEnding -MessageData $state -SupportEvent -Action {
  $current = $Event.MessageData
  $current.Stop = $true
  $taskkill = Join-Path $env:SystemRoot "System32\taskkill.exe"
  $target = [int]$current.ProcessId
  if ($target -gt 0) {
    & $taskkill /PID $target /T /F | Out-Null
  }
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.CommandLine -like "*beyond-sat*vite.js*") {
      & $taskkill /PID $_.ProcessId /T /F | Out-Null
    }
  }
} | Out-Null

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000
$timer.Add_Tick({
  if ($state.Stop) {
    [System.Windows.Forms.Application]::Exit()
    return
  }
  try {
    Update-DevServer $state
  } catch {
    Write-Log $_.Exception.Message
  }
})
$timer.Start()
[System.Windows.Forms.Application]::Run()
$timer.Stop()
Stop-DevServer $state
$mutex.ReleaseMutex() | Out-Null
$mutex.Dispose()
