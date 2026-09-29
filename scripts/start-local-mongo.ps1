$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$data = Join-Path $root ".data\mongo"
$log = Join-Path $root ".data\mongod.log"
New-Item -ItemType Directory -Force -Path $data | Out-Null

function Test-Port([int]$Port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ok = $async.AsyncWaitHandle.WaitOne(400)
    if ($ok) { $client.EndConnect($async) }
    $client.Close()
    return $ok
  } catch {
    return $false
  }
}

if (Test-Port 27018) {
  Write-Host "MongoDB replica set already listening on 27018"
  exit 0
}

$mongod = "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe"
if (-not (Test-Path $mongod)) {
  throw "mongod.exe not found. Install MongoDB 7 or start Docker Desktop and run docker compose up -d mongo redis mongo-init"
}

# A single quoted string is required. Start-Process splits an argument array
# and drops quotes, so a db path that contains spaces never reaches mongod.
$mongodArgs = "--replSet rs0 --port 27018 --bind_ip 127.0.0.1 --dbpath `"$data`" --logpath `"$log`" --logappend"
Start-Process -FilePath $mongod -ArgumentList $mongodArgs -WindowStyle Hidden

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 500
  if (Test-Port 27018) {
    $ready = $true
    break
  }
}
if (-not $ready) {
  throw "MongoDB did not start on 27018. Check $log"
}

Write-Host "MongoDB replica set process started on 27018"

Push-Location $root
try {
  node -e "const {MongoClient}=require('mongodb'); (async()=>{ const c=new MongoClient('mongodb://127.0.0.1:27018/?directConnection=true',{serverSelectionTimeoutMS:8000}); await c.connect(); const admin=c.db('admin'); try { await admin.command({replSetGetStatus:1}); } catch { await admin.command({replSetInitiate:{_id:'rs0', members:[{_id:0, host:'127.0.0.1:27018'}]}}); } await c.close(); })().catch((error)=>{ console.error(error.message); process.exit(1); })"
} finally {
  Pop-Location
}
