param(
  [string]$Message = "atualiza catalogo pelo painel local"
)

$ErrorActionPreference = "Stop"
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
    throw "Não foi possível consultar o estado do Git."
  }

  if (-not ($changes | Out-String).Trim()) {
    Write-Host "Nenhuma alteração de catálogo, fotos ou modelos 3D para publicar."
    return
  }

  git add -- $paths
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível preparar os arquivos do catálogo."
  }

  git diff --cached --check -- $paths
  if ($LASTEXITCODE -ne 0) {
    throw "Foram encontrados problemas de formatação nos arquivos preparados."
  }

  $branch = (git branch --show-current).Trim()
  if (-not $branch) {
    throw "Não foi possível descobrir a branch atual."
  }

  git commit -m $Message
  if ($LASTEXITCODE -ne 0) {
    throw "O commit não foi criado."
  }

  git push origin $branch
  if ($LASTEXITCODE -ne 0) {
    throw "O push não foi concluído. Verifique a autenticação do GitHub."
  }

  Write-Host "Publicado na branch $branch. Aguarde o GitHub Actions atualizar o Pages."
}
finally {
  Pop-Location
}
