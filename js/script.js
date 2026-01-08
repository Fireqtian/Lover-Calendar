// 数字星尘 - 粒子系统核心逻辑

// 全局变量
let canvas, ctx;
let particles = [];
let mouse = { x: 0, y: 0, radius: 100, isDown: false, genTick: 0 };
let animationId;
let settings = {
    particleCount: 150,
    gravity: 1.3,        // 鼠标引力强度（滑块控制）
    worldGravity: 0.1,   // 环境向下重力（固定）
    speed: 5,
    colorMode: 'rainbow',
    mode: 'attract', // 'attract' or 'repel'
    mouseRadiusBase: 100, // 鼠标交互半径基值
    mouseRadiusScale: 6.0 // 大幅提高半径缩放系数，让引力强度对范围影响更明显
};

// 颜色映射函数
const colorModes = {
    rainbow: (particle) => {
        const hue = (particle.x / canvas.width * 360 + particle.y / canvas.height * 360 + Date.now() * 0.001) % 360;
        return `hsla(${hue}, 90%, 65%, 0.8)`;
    },
    mono: () => 'rgba(102, 126, 234, 0.8)',
    fire: (particle) => {
        const r = 255;
        const g = Math.floor(50 + particle.life * 100);
        const b = Math.floor(particle.life * 50);
        return `rgba(${r}, ${g}, ${b}, 0.8)`;
    },
    ocean: (particle) => {
        const r = 0;
        const g = Math.floor(150 + particle.life * 50);
        const b = Math.floor(200 + particle.life * 55);
        return `rgba(${r}, ${g}, ${b}, 0.8)`;
    }
};

// 粒子类
class Particle {
    constructor(x, y) {
        this.x = x || Math.random() * canvas.width;
        this.y = y || Math.random() * canvas.height;
        this.size = Math.random() * 4 + 1;
        this.speedX = Math.random() * 4 - 2;
        this.speedY = Math.random() * 4 - 2;
        this.life = 1.0;
        this.decay = Math.random() * 0.005 + 0.002;
        this.color = '#667eea';
        this.trail = [];
        this.maxTrail = 8;
    }

    update() {
        // 动态计算鼠标交互半径（基于引力强度）
        const effectiveRadius = settings.mouseRadiusBase * (1 + (settings.gravity - 1) * settings.mouseRadiusScale);
        mouse.radius = effectiveRadius;
        
        // 应用鼠标引力/斥力
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 使用平方反比衰减，让远处粒子也能感受到微弱引力
        if (distance < effectiveRadius * 2) {
            // 计算归一化距离（0-1）
            const normalizedDistance = Math.min(distance / effectiveRadius, 2);
            // 平方反比衰减：力 = 1 / (距离^2 + 1)
            const force = 1 / (normalizedDistance * normalizedDistance + 1);
            const angle = Math.atan2(dy, dx);
            
            // 根据模式应用力（引力或斥力）
            const forceMultiplier = force * settings.gravity * 0.2;
            
            if (settings.mode === 'attract') {
                this.speedX += Math.cos(angle) * forceMultiplier;
                this.speedY += Math.sin(angle) * forceMultiplier;
            } else {
                this.speedX -= Math.cos(angle) * forceMultiplier;
                this.speedY -= Math.sin(angle) * forceMultiplier;
            }
        }
        
        // 应用重力
        this.speedY += settings.gravity * 0.01;
        
        // 更新位置
        this.x += this.speedX * settings.speed * 0.1;
        this.y += this.speedY * settings.speed * 0.1;
        
        // 边界反弹
        if (this.x <= 0 || this.x >= canvas.width) {
            this.speedX *= -0.8;
            this.x = this.x <= 0 ? 0 : canvas.width;
        }
        if (this.y <= 0 || this.y >= canvas.height) {
            this.speedY *= -0.8;
            this.y = this.y <= 0 ? 0 : canvas.height;
        }
        
        // 更新生命周期
        this.life -= this.decay;
        
        // 更新轨迹
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrail) {
            this.trail.shift();
        }
        
        // 更新颜色
        this.color = colorModes[settings.colorMode](this);
    }

    draw() {
        if (this.life <= 0) return;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        
        // 绘制轨迹
        if (this.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.strokeStyle = this.color.replace('0.8', '0.3');
            ctx.lineWidth = this.size * 0.5;
            ctx.stroke();
        }
        
        // 绘制光晕
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.size * 3
        );
        gradient.addColorStop(0, this.color.replace('0.8', '0.6'));
        gradient.addColorStop(1, this.color.replace('0.8', '0'));
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }
}

// 初始化 Canvas
function initCanvas() {
    canvas = document.getElementById('stardustCanvas');
    ctx = canvas.getContext('2d');
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // 初始粒子生成
    generateParticles(settings.particleCount);
}

// 调整 Canvas 大小
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// 生成粒子
function generateParticles(count) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle());
    }
}

// 清除所有粒子
function clearParticles() {
    particles = [];
}

// 创建粒子爆炸效果
function createExplosion(x, y, count = 30, speedMultiplier = 1) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 5 + 2) * speedMultiplier;
        const particle = new Particle(x, y);
        particle.speedX = Math.cos(angle) * speed;
        particle.speedY = Math.sin(angle) * speed;
        particle.size = Math.random() * 3 + 1;
        particle.decay = Math.random() * 0.01 + 0.005;
        particles.push(particle);
    }
}

// 动画循环
function animate() {
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制半透明黑色背景（产生拖尾效果）
    ctx.fillStyle = 'rgba(10, 10, 46, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 更新并绘制粒子
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();
        
        // 移除死亡的粒子
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
    
    // 补充粒子到目标数量
    if (particles.length < settings.particleCount) {
        generateParticles(settings.particleCount - particles.length);
    }
    
    // 如果鼠标按下，创建新粒子（每5帧生成一次，降低频率）
    if (mouse.isDown) {
        mouse.genTick++;
        if (mouse.genTick >= 5) {
            createExplosion(mouse.x, mouse.y, 2);
            mouse.genTick = 0;
        }
    } else {
        mouse.genTick = 0; // 重置计数器
    }
    
    animationId = requestAnimationFrame(animate);
}

// 初始化事件监听
function initEventListeners() {
    // 鼠标移动 - 全局监听
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });
    
    // 鼠标按下 - 全局监听，添加UI过滤逻辑
    window.addEventListener('mousedown', (e) => {
        // 检查是否点击了UI元素（按钮、输入框、选择框等）
        const target = e.target;
        const isUIElement = target.closest('button, input, select, .btn, .controls, .modal-content, .hero-buttons');
        
        // 如果不是UI元素，才触发粒子交互
        if (!isUIElement) {
            e.preventDefault(); // 阻止文本选择和默认行为
            mouse.isDown = true;
            mouse.genTick = 0; // 重置生成计数器
            
            if (e.button === 2) { // 右键 - 仅爆炸一次，不持续生成
                createExplosion(mouse.x, mouse.y, 50, 2.5); // 增加爆炸速度
                // 右键不设置 mouse.isDown = true，以免动画循环持续生成粒子
                mouse.isDown = false;
            } else if (e.button === 0) { // 左键
                createExplosion(mouse.x, mouse.y, 5, 1.2); // 左键点击时立即生成少量粒子
            }
        }
    });
    
    // 鼠标抬起 - 全局监听
    window.addEventListener('mouseup', () => {
        mouse.isDown = false;
    });
    
    // 鼠标离开窗口 - 全局监听
    document.addEventListener('mouseleave', () => {
        mouse.x = -1000;
        mouse.y = -1000;
        mouse.isDown = false;
    });
    
    // 阻止右键菜单 - 全局监听
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
    
    // 触摸事件 - 全局监听，添加UI过滤逻辑
    window.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        mouse.x = touch.clientX;
        mouse.y = touch.clientY;
    });
    
    window.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const target = e.target;
        const isUIElement = target.closest('button, input, select, .btn, .controls, .modal-content, .hero-buttons');
        
        if (!isUIElement) {
            mouse.x = touch.clientX;
            mouse.y = touch.clientY;
            mouse.isDown = true;
        }
    });
    
    window.addEventListener('touchend', (e) => {
        e.preventDefault();
        mouse.isDown = false;
    });
}

// 初始化控制面板
function initControls() {
    // 粒子数量滑块
    const particleCountSlider = document.getElementById('particleCount');
    const countValue = document.getElementById('countValue');
    
    particleCountSlider.value = settings.particleCount;
    countValue.textContent = settings.particleCount;
    
    particleCountSlider.addEventListener('input', (e) => {
        settings.particleCount = parseInt(e.target.value);
        countValue.textContent = settings.particleCount;
        
        // 如果当前粒子数量超过新设置，移除多余的粒子
        if (particles.length > settings.particleCount) {
            particles.length = settings.particleCount;
        }
    });
    
    // 引力强度滑块
    const gravitySlider = document.getElementById('gravity');
    const gravityValue = document.getElementById('gravityValue');
    
    gravitySlider.value = settings.gravity;
    gravityValue.textContent = settings.gravity;
    
    gravitySlider.addEventListener('input', (e) => {
        settings.gravity = parseFloat(e.target.value);
        gravityValue.textContent = settings.gravity.toFixed(1);
    });
    
    // 运动速度滑块
    const speedSlider = document.getElementById('speed');
    const speedValue = document.getElementById('speedValue');
    
    speedSlider.value = settings.speed;
    speedValue.textContent = settings.speed;
    
    speedSlider.addEventListener('input', (e) => {
        settings.speed = parseInt(e.target.value);
        speedValue.textContent = settings.speed;
    });
    
    // 色彩模式选择
    const colorModeSelect = document.getElementById('colorMode');
    colorModeSelect.value = settings.colorMode;
    
    colorModeSelect.addEventListener('change', (e) => {
        settings.colorMode = e.target.value;
    });
    
    // 切换模式按钮
    const modeToggleBtn = document.getElementById('modeToggle');
    
    // 设置初始状态
    modeToggleBtn.innerHTML = `<i class="fas fa-magnet"></i> 心动引力`;
    
    modeToggleBtn.addEventListener('click', () => {
        settings.mode = settings.mode === 'attract' ? 'repel' : 'attract';
        const isAttract = settings.mode === 'attract';
        const icon = isAttract ? 'magnet' : 'star';
        const text = isAttract ? '心动引力' : '新星爆发';
        modeToggleBtn.innerHTML = `<i class="fas fa-${icon}"></i> ${text}`;
    });
    
    // 关于按钮
    const infoBtn = document.getElementById('infoBtn');
    const modal = document.getElementById('infoModal');
    const closeBtn = document.querySelector('.close');
    
    infoBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
    });
    
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// 页面加载完成后初始化
window.addEventListener('load', () => {
    initCanvas();
    initEventListeners();
    initControls();
    animate();
    
    // 添加一些初始效果
    setTimeout(() => {
        createExplosion(canvas.width / 2, canvas.height / 2, 100);
    }, 500);
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
});
