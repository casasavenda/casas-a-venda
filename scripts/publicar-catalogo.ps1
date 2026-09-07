param(
  [string]$Message = "atualiza catalogo pelo painel local"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$paths = @(
  "apps/web/src/data/houses.json",
  "apps/web/public/fotos",
  "apps/web/public/showroom3d/modelos"
)

Push-Location $repoRoot
try {
  $changes = git status --porcelain -- $paths
  if ($LASTEXITCODE -ne 0) {
    throw "Nao foi possivel consultar o estado do Git."
  }

  if (-not ($changes | Out-String).Trim()) {
    Write-Host "Nenhuma alteracao de catalogo, fotos ou modelos 3D para publicar."
    return
  }

  git add -- $paths
  if ($LASTEXITCODE -ne 0) {
    throw "Nao foi possivel preparar os arquivos do catalogo."
  }

  git diff --cached --check -- $paths
  if ($LASTEXITCODE -ne 0) {
    throw "Foram encontrados problemas de formatacao nos arquivos preparados."
  }

  $branch = (git branch --show-current).Trim()
  if (-not $branch) {
    throw "Nao foi possivel descobrir a branch atual."
  }

  git commit -m $Message
  if ($LASTEXITCODE -ne 0) {
    throw "O commit nao foi criado."
  }

  git push origin $branch
  if ($LASTEXITCODE -ne 0) {
    throw "O push nao foi concluido. Verifique a autenticacao do GitHub."
  }

  Write-Host "Publicado na branch $branch. Aguarde o GitHub Actions atualizar o Pages."
}
finally {
  Pop-Location
}
