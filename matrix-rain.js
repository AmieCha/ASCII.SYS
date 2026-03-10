(function () {
    const canvas = document.getElementById('matrix-rain');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Katakana + Latin + digits for authentic Matrix look
    const chars = 'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*<>{}[]|/\\';
    const charArr = chars.split('');

    const FONT_SIZE = 13;
    let columns, drops, speeds, brightness;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        columns = Math.floor(canvas.width / FONT_SIZE);

        drops     = new Array(columns).fill(0).map(() => Math.random() * -canvas.height / FONT_SIZE);
        speeds    = new Array(columns).fill(0).map(() => 0.3 + Math.random() * 0.7);
        brightness = new Array(columns).fill(0).map(() => Math.random());
    }

    resize();
    window.addEventListener('resize', resize);

    function draw() {
        // Fade trail — very dark green tint
        ctx.fillStyle = 'rgba(0, 5, 0, 0.055)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = FONT_SIZE + 'px "Share Tech Mono", monospace';

        for (let i = 0; i < drops.length; i++) {
            const y = drops[i] * FONT_SIZE;
            if (y < 0) { drops[i] += speeds[i]; continue; }

            const char = charArr[Math.floor(Math.random() * charArr.length)];
            const x = i * FONT_SIZE;

            // Bright white head character
            if (drops[i] * FONT_SIZE < canvas.height) {
                ctx.fillStyle = '#ccffcc';
                ctx.shadowColor = '#00FF41';
                ctx.shadowBlur = 8;
                ctx.fillText(char, x, y);
                ctx.shadowBlur = 0;
            }

            // Draw slightly dimmer character just behind the head
            if (drops[i] > 1) {
                const prevChar = charArr[Math.floor(Math.random() * charArr.length)];
                const b = brightness[i];
                ctx.fillStyle = b > 0.7 ? '#00FF41' : b > 0.4 ? '#00cc33' : '#008822';
                ctx.fillText(prevChar, x, y - FONT_SIZE);
            }

            if (y > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
                speeds[i] = 0.3 + Math.random() * 0.7;
                brightness[i] = Math.random();
            }

            drops[i] += speeds[i];
        }
    }

    setInterval(draw, 40);
})();
