import { unzipSync } from 'fflate';

async function bytesDeEntrada(arquivoOuUrl) {
  if (arquivoOuUrl instanceof Uint8Array) return arquivoOuUrl;
  if (arquivoOuUrl instanceof ArrayBuffer) return new Uint8Array(arquivoOuUrl);
  if (ArrayBuffer.isView(arquivoOuUrl)) return new Uint8Array(arquivoOuUrl.buffer, arquivoOuUrl.byteOffset, arquivoOuUrl.byteLength);
  if (arquivoOuUrl && typeof arquivoOuUrl.arrayBuffer === 'function') return new Uint8Array(await arquivoOuUrl.arrayBuffer());
  if (typeof arquivoOuUrl === 'string' || arquivoOuUrl instanceof URL) {
    const resposta = await fetch(arquivoOuUrl);
    if (!resposta.ok) throw new Error(`Não foi possível abrir o arquivo (${resposta.status}).`);
    return new Uint8Array(await resposta.arrayBuffer());
  }
  throw new TypeError('carregarSh3d espera File, URL, ArrayBuffer ou Uint8Array.');
}

export async function abrirArquivoSh3d(arquivoOuUrl) {
  const bytes = await bytesDeEntrada(arquivoOuUrl);
  let arquivos;
  try {
    arquivos = unzipSync(bytes);
  } catch (erro) {
    throw new Error(`O arquivo não é um .sh3d ZIP válido: ${erro.message}`);
  }

  const homeBytes = arquivos['Home.xml'];
  if (!homeBytes) throw new Error('O .sh3d não contém a entrada Home.xml.');

  return {
    homeXml: new TextDecoder('utf-8').decode(homeBytes),
    arquivos,
  };
}
