[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $root '.env'
$credentialsPath = Join-Path $root '.demo-credentials'

if (Test-Path $envPath) {
    throw 'O arquivo .env já existe. A configuração local não foi alterada.'
}

function New-RandomHex([int]$byteCount) {
    $bytes = [byte[]]::new($byteCount)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
    } finally {
        $rng.Dispose()
    }
    return (([BitConverter]::ToString($bytes) -replace '-', '').ToLowerInvariant())
}

$databasePassword = New-RandomHex 24
$secretKey = New-RandomHex 48
$adminPassword = New-RandomHex 24
$adminEmail = 'demo-admin@example.com'

@"
APP_ENV=local
DATABASE_URL=postgresql+asyncpg://x9_local:$databasePassword@db:5432/x9_local
DATABASE_URL_SYNC=postgresql+psycopg2://x9_local:$databasePassword@db:5432/x9_local
POSTGRES_DB=x9_local
POSTGRES_USER=x9_local
POSTGRES_PASSWORD=$databasePassword
REDIS_URL=redis://redis:6379/0
SECRET_KEY=$secretKey
SUPERADMIN_EMAIL=$adminEmail
SUPERADMIN_PASSWORD=$adminPassword
SUPERADMIN_NOME=Administrador Demo
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=http://127.0.0.1:8310,http://localhost:8310
DATABASE_BOOTSTRAP_SCHEMA=false
BOOTSTRAP_LEGACY_ADMIN=false
DISABLE_EXTERNAL_INTEGRATIONS=true
OIDC_ENABLED=false
OIDC_ISSUER=
OIDC_CLIENT_ID=x9-web
OIDC_CLIENT_SECRET=
OIDC_REDIRECT_URI=
OIDC_COOKIE_SECURE=false
CENTRAL_BASE_URL=
CENTRAL_M2M_CLIENT_ID=x9-governance
CENTRAL_M2M_CLIENT_SECRET=
UAZAPI_BASE_URL=
UAZAPI_ADMIN_TOKEN=
UAZAPI_CREDENTIAL_KEY=
UAZAPI_WEBHOOK_URL=
OPENAI_API_KEY=
SMTP_HOST=
SMTP_USER=
SMTP_PASSWORD=
FRONTEND_URL=http://127.0.0.1:8310
"@ | Set-Content -LiteralPath $envPath -Encoding UTF8

@"
email=$adminEmail
password=$adminPassword
"@ | Set-Content -LiteralPath $credentialsPath -Encoding UTF8

Write-Output 'Configuração local criada. As credenciais estão somente em .demo-credentials (arquivo ignorado pelo Git).'
