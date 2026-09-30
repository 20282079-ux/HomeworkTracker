// confetti.js — canvas particle burst, ported verbatim from js/util.js.
export function launchConfetti() {
  // Respect the OS "reduce motion" preference — skip the burst entirely.
  try {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  } catch {
    /* matchMedia unavailable — play it anyway */
  }
  const canvas = document.getElementById("confetti-canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const particles = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: -10,
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 4 + 2,
    color: ["#7c6af7", "#4ade80", "#facc15", "#f87171", "#fb923c", "#60a5fa"][Math.floor(Math.random() * 6)],
    size: Math.random() * 8 + 4,
    rot: Math.random() * 360,
    rotV: (Math.random() - 0.5) * 6,
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotV;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * (Math.PI / 180));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
    frame++;
    if (frame < 90) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}
