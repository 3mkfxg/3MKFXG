// ==========================================================================
// 3MK F X G WORLD - Matrix Digital Rain Background Animation
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('matrix-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Handle Resize
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Characters: Japanese Katakana + Alphanumeric
  const charSource = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ#$@%&*';
  const alphabet = charSource.split('');

  const fontSize = 14;
  let columns = Math.floor(canvas.width / fontSize) + 1;

  // Initialize raindrops
  let rainDrops = [];
  for (let x = 0; x < columns; x++) {
    rainDrops[x] = Math.random() * -100; // Stagger entry times so they don't fall as a single solid wave
  }

  // Handle columns adjustment on resize
  window.addEventListener('resize', () => {
    const newColumns = Math.floor(canvas.width / fontSize) + 1;
    if (newColumns > columns) {
      for (let x = columns; x < newColumns; x++) {
        rainDrops[x] = Math.random() * -100;
      }
    }
    columns = newColumns;
  });

  // Animation draw loop
  function draw() {
    // Semi-transparent black block to create trailing blur tail effect
    ctx.fillStyle = 'rgba(5, 5, 8, 0.07)'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `bold ${fontSize}px monospace`;

    for (let i = 0; i < columns; i++) {
      // Skip draw if raindrop is still waiting above the fold
      if (rainDrops[i] < 0) {
        rainDrops[i]++;
        continue;
      }

      // Pick random character
      const text = alphabet[Math.floor(Math.random() * alphabet.length)];
      
      const x = i * fontSize;
      const y = rainDrops[i] * fontSize;

      // Draw first character with bright white to represent the glowing head
      // and others with standard hacker-green shades
      if (Math.random() > 0.98) {
        ctx.fillStyle = '#ffffff'; // White lightning head
      } else if (Math.random() > 0.90) {
        ctx.fillStyle = '#a7f3d0'; // Light emerald highlight
      } else {
        ctx.fillStyle = '#00ff66'; // Cyber green main body
      }

      ctx.fillText(text, x, y);

      // Reset to top with a slight delay once it reaches bottom
      if (y > canvas.height && Math.random() > 0.98) {
        rainDrops[i] = 0;
      }
      
      rainDrops[i]++;
    }
  }

  // 30 FPS throttle makes matrix rain look incredibly smooth and retro-accurate
  setInterval(draw, 33);
});
