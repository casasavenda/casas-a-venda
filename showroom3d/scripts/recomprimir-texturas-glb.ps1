param(
  [Parameter(Mandatory = $true)] [string] $Entrada,
  [Parameter(Mandatory = $true)] [string] $Saida,
  [int] $Qualidade = 82
)

Add-Type -AssemblyName System.Drawing

function Align4([int] $valor) {
  return ($valor + 3) -band (-4)
}

function Read-UInt32LE([byte[]] $dados, [int] $offset) {
  return [BitConverter]::ToUInt32($dados, $offset)
}

$arquivo = [IO.File]::ReadAllBytes($Entrada)
if ([Text.Encoding]::ASCII.GetString($arquivo, 0, 4) -ne 'glTF' -or (Read-UInt32LE $arquivo 4) -ne 2) {
  throw 'O arquivo de entrada não é um GLB 2.0 válido.'
}

$jsonLength = [int](Read-UInt32LE $arquivo 12)
$json = [Text.Encoding]::UTF8.GetString($arquivo, 20, $jsonLength).Trim() | ConvertFrom-Json
$binStart = 20 + $jsonLength + 8
$jpegCodec = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
$encoderParameters = [Drawing.Imaging.EncoderParameters]::new(1)
$encoderParameters.Param[0] = [Drawing.Imaging.EncoderParameter]::new([Drawing.Imaging.Encoder]::Quality, [long]$Qualidade)

$recomprimidas = @{}
$bytesAntesTexturas = 0
$bytesDepoisTexturas = 0

for ($indiceImagem = 0; $indiceImagem -lt $json.images.Count; $indiceImagem++) {
  $imagem = $json.images[$indiceImagem]
  if ($null -eq $imagem.bufferView) { continue }

  $view = $json.bufferViews[[int]$imagem.bufferView]
  $offset = if ($null -eq $view.byteOffset) { 0 } else { [int]$view.byteOffset }
  $tamanho = [int]$view.byteLength
  $bytesImagem = New-Object byte[] $tamanho
  [Array]::Copy($arquivo, $binStart + $offset, $bytesImagem, 0, $tamanho)
  $bytesAntesTexturas += $tamanho

  $streamEntrada = [IO.MemoryStream]::new($bytesImagem, $false)
  try {
    $bitmap = [Drawing.Bitmap]::new($streamEntrada)
    $temTransparencia = $false
    for ($x = 0; $x -lt $bitmap.Width -and -not $temTransparencia; $x += 8) {
      for ($y = 0; $y -lt $bitmap.Height; $y += 8) {
        if ($bitmap.GetPixel($x, $y).A -lt 255) {
          $temTransparencia = $true
          break
        }
      }
    }

    if ($temTransparencia) {
      $recomprimidas[$indiceImagem] = $bytesImagem
      $bytesDepoisTexturas += $tamanho
      continue
    }

    $streamSaida = [IO.MemoryStream]::new()
    $bitmap.Save($streamSaida, $jpegCodec, $encoderParameters)
    $novoBytes = $streamSaida.ToArray()
    $recomprimidas[$indiceImagem] = $novoBytes
    $bytesDepoisTexturas += $novoBytes.Length
    $imagem.mimeType = 'image/jpeg'
    $streamSaida.Dispose()
  } finally {
    if ($null -ne $bitmap) { $bitmap.Dispose() }
    $streamEntrada.Dispose()
  }
}

$partesBin = [Collections.Generic.List[byte[]]]::new()
$tamanhoBinNovo = 0
for ($indiceView = 0; $indiceView -lt $json.bufferViews.Count; $indiceView++) {
  $view = $json.bufferViews[$indiceView]
  $offset = if ($null -eq $view.byteOffset) { 0 } else { [int]$view.byteOffset }
  $tamanho = [int]$view.byteLength
  $bytesView = New-Object byte[] $tamanho
  [Array]::Copy($arquivo, $binStart + $offset, $bytesView, 0, $tamanho)

  $payload = $bytesView
  for ($indiceImagem = 0; $indiceImagem -lt $json.images.Count; $indiceImagem++) {
    if ($null -ne $json.images[$indiceImagem].bufferView -and [int]$json.images[$indiceImagem].bufferView -eq $indiceView -and $recomprimidas.ContainsKey($indiceImagem)) {
      $payload = $recomprimidas[$indiceImagem]
      break
    }
  }

  $alinhado = Align4 $tamanhoBinNovo
  if ($alinhado -gt $tamanhoBinNovo) { $partesBin.Add((New-Object byte[] ($alinhado - $tamanhoBinNovo))) }
  $partesBin.Add($payload)
  $view.byteOffset = $alinhado
  $view.byteLength = $payload.Length
  $tamanhoBinNovo = $alinhado + $payload.Length
}

$binNovoStream = [IO.MemoryStream]::new()
foreach ($parte in $partesBin) { $binNovoStream.Write($parte, 0, $parte.Length) }
$binNovo = $binNovoStream.ToArray()
$binNovoStream.Dispose()
$json.buffers[0].byteLength = $binNovo.Length

$jsonBytes = [Text.Encoding]::UTF8.GetBytes(($json | ConvertTo-Json -Depth 100 -Compress))
$jsonPaddedLength = Align4 $jsonBytes.Length
$jsonPadded = New-Object byte[] $jsonPaddedLength
[Array]::Copy($jsonBytes, $jsonPadded, $jsonBytes.Length)
for ($i = $jsonBytes.Length; $i -lt $jsonPaddedLength; $i++) { $jsonPadded[$i] = 0x20 }

$binPaddedLength = Align4 $binNovo.Length
$binPadded = New-Object byte[] $binPaddedLength
[Array]::Copy($binNovo, $binPadded, $binNovo.Length)
$totalLength = 12 + 8 + $jsonPadded.Length + 8 + $binPadded.Length

$diretorio = Split-Path -Parent $Saida
if ($diretorio) { [IO.Directory]::CreateDirectory($diretorio) | Out-Null }
$streamGlb = [IO.FileStream]::new($Saida, [IO.FileMode]::Create, [IO.FileAccess]::Write)
$writer = [IO.BinaryWriter]::new($streamGlb)
$writer.Write([Text.Encoding]::ASCII.GetBytes('glTF'))
$writer.Write([uint32]2)
$writer.Write([uint32]$totalLength)
$writer.Write([uint32]$jsonPadded.Length)
$writer.Write([uint32]0x4e4f534a)
$writer.Write($jsonPadded)
$writer.Write([uint32]$binPadded.Length)
$writer.Write([uint32]0x004e4942)
$writer.Write($binPadded)
$writer.Flush()
$writer.Dispose()
$streamGlb.Dispose()

$originalBytes = (Get-Item -LiteralPath $Entrada).Length
$newBytes = (Get-Item -LiteralPath $Saida).Length
[pscustomobject]@{
  entrada = $Entrada
  saida = $Saida
  tamanhoOriginal = $originalBytes
  tamanhoNovo = $newBytes
  reducaoPercentual = [math]::Round((1 - ($newBytes / $originalBytes)) * 100, 1)
  texturasAntes = $bytesAntesTexturas
  texturasDepois = $bytesDepoisTexturas
  qualidadeJpeg = $Qualidade
} | ConvertTo-Json
