import { buildShareText, encodeLine, formatScore } from './score.js';

export function challengeUrl(result, href = window.location.href) {
  const url = new URL(href);
  url.hash = '';
  url.search = '';
  url.searchParams.set('line', encodeLine(result));
  return url.toString();
}

export function xIntentUrl(text, pageUrl) {
  const intent = new URL('https://x.com/intent/post');
  intent.searchParams.set('text', text);
  intent.searchParams.set('url', pageUrl);
  return intent.toString();
}

export function initialShareStatus(hostname) {
  const host = hostname || '';
  const local = host === '' || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  if (local) {
    return 'Save the card to attach the picture. Others can open the link after this game is hosted.';
  }
  return 'Save the card if you want the picture attached to the post.';
}

export function drawShareCard(result) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, 1200, 630);

  ctx.strokeStyle = 'rgba(125, 164, 212, 0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 42; i++) {
    const x = (i * 53) % 1200;
    const y = (i * 97) % 630;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 16, y + 42);
    ctx.stroke();
  }

  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 6;
  ctx.strokeRect(28, 28, 1144, 574);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#00f0ff';
  ctx.font = '700 22px sans-serif';
  ctx.fillText('NEO-MUMBAI  2088', 600, 108);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 62px sans-serif';
  ctx.fillText('MONSOON ROOFTOPS', 600, 186);

  ctx.fillStyle = '#ffc14d';
  ctx.font = '800 28px sans-serif';
  const headline = result.victory ? `RANK ${result.rank} · ${result.title}` : `DOWNED AT ${Math.floor(result.distance)}m`;
  ctx.fillText(headline, 600, 246);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 96px monospace';
  ctx.fillText(formatScore(result.score), 600, 370);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 26px sans-serif';
  const dist = Math.floor(result.distance);
  ctx.fillText(`${result.cells}/5 CELLS    ·    ${result.razors} RAZORS    ·    ${dist}m`, 600, 440);

  ctx.fillStyle = '#00f0ff';
  ctx.font = '800 24px sans-serif';
  ctx.fillText('BEAT THIS LINE', 600, 528);

  return canvas;
}

export function downloadShareCard(result) {
  const canvas = drawShareCard(result);
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = 'monsoon-rooftops-line.png';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function shareRun(result) {
  const url = challengeUrl(result);
  const text = buildShareText(result);
  let file = null;
  try {
    const canvas = drawShareCard(result);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) file = new File([blob], 'monsoon-rooftops-line.png', { type: 'image/png' });
  } catch (e) {
    file = null;
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      const withFile = file && navigator.canShare && navigator.canShare({ files: [file] });
      if (withFile) {
        await navigator.share({ title: 'Monsoon Rooftops', text, url, files: [file] });
      } else {
        await navigator.share({ title: 'Monsoon Rooftops', text, url });
      }
      return { status: 'shared', text, url };
    } catch (e) {
      if (e && e.name === 'AbortError') return { status: 'cancelled', text, url };
    }
  }

  const opened = window.open(xIntentUrl(text, url), '_blank', 'noopener,noreferrer');
  if (!opened) return { status: 'copy', text, url };
  return { status: 'opened', text, url };
}
