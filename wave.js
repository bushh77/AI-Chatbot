const canvas = document.getElementById('waveCanvas');
const ctx = canvas.getContext('2d');

let w, h;

function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

let time = 0;

function animate() {
  time += 0.008;

  ctx.clearRect(0, 0, w, h);

  drawWave('#1e40af', 0.55, 180, 0.003, time * 0.7);
  drawWave('#7c3aed', 0.38, 220, 0.004, time * 1.05 + 2);
  drawWave('#60a5fa', 0.22, 160, 0.0055, time * 1.35 + 4.5);

  requestAnimationFrame(animate);
}

function drawWave(color, opacity, amplitude, frequency, offset) {
  ctx.beginPath();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;

  for (let x = 0; x < w; x += 2) {
    const y = h * 0.68 +
              Math.sin(x * frequency + offset) * amplitude +
              Math.sin(x * frequency * 0.45 + offset * 1.4) * (amplitude * 0.65);
    ctx.lineTo(x, y);
  }

  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha *= 0.32;
  ctx.fill();
  ctx.globalAlpha = opacity;
  ctx.stroke();
}

animate();