class RXFPlayer {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.options = {
            width: options.width || 800,
            height: options.height || 600,
            bgColor: options.bgColor || '#ffffff',
            fps: options.fps || 24,
            autoplay: options.autoplay !== false,
            loop: options.loop || false
        };
        this.canvas = null;
        this.ctx = null;
        this.currentFrame = 0;
        this.totalFrames = 0;
        this.playing = false;
        this.animationId = null;
        this.sprites = new Map();
        this.instances = [];
        this.vars = {};
        this.init();
    }
    
    init() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.canvas.style.backgroundColor = this.options.bgColor;
        this.canvas.style.border = '1px solid #3c3c3c';
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);
        if (this.options.autoplay) this.play();
    }
    
    async load(url) {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        this.parseRXF(buffer);
        return this;
    }
    
    loadFromData(data) {
        this.parseRXF(data);
        return this;
    }
    
    parseRXF(buffer) {
        const view = new DataView(buffer);
        if (view.getUint32(0) !== 0x52584600) throw new Error('Invalid RXF');
        this.parseScene(buffer, 24);
    }
    
    parseScene(buffer, offset) {
        const view = new DataView(buffer);
        this.totalFrames = view.getUint32(offset + 4, true);
        let pos = offset + 16;
        while (pos < buffer.byteLength) {
            const tagHeader = view.getUint16(pos, true);
            const tagType = tagHeader >> 10;
            let tagLen = tagHeader & 0x3FF;
            pos += 2;
            if (tagLen === 1023) {
                tagLen = view.getUint32(pos, true);
                pos += 4;
            }
            const tagData = buffer.slice(pos, pos + tagLen);
            this.processTag(tagType, tagData);
            pos += tagLen;
        }
    }
    
    processTag(type, data) {
        const view = new DataView(data);
        switch(type) {
            case 1:
                const color = view.getUint16(0, true);
                const r = ((color >> 11) & 0x1F) << 3;
                const g = ((color >> 5) & 0x3F) << 2;
                const b = (color & 0x1F) << 3;
                this.options.bgColor = 'rgb(' + r + ',' + g + ',' + b + ')';
                this.canvas.style.backgroundColor = this.options.bgColor;
                break;
            case 2:
                this.sprites.set(view.getUint16(0, true), data.slice(2));
                break;
            case 3:
                this.instances.push({
                    spriteId: view.getUint16(0, true),
                    x: view.getInt16(2, true),
                    y: view.getInt16(4, true),
                    name: new TextDecoder().decode(data.slice(6)).replace(/\0/g, '')
                });
                break;
            case 4:
                const name = new TextDecoder().decode(data).replace(/\0/g, '');
                this.instances = this.instances.filter(i => i.name !== name);
                break;
            case 5:
                const target = new TextDecoder().decode(data.slice(0, data.indexOf(0))).replace(/\0/g, '');
                const inst = this.instances.find(i => i.name === target);
                if (inst) {
                    inst.x = view.getInt16(data.indexOf(0) + 1, true);
                    inst.y = view.getInt16(data.indexOf(0) + 3, true);
                }
                break;
            case 6:
                this.drawCommands(data);
                break;
            case 11:
                this.executeXFC(new TextDecoder().decode(data));
                break;
        }
    }
    
    drawCommands(data) {
        const view = new DataView(data);
        let pos = 0;
        while (pos < data.byteLength) {
            const cmd = view.getUint8(pos++);
            if (cmd === 0x01) {
                this.ctx.moveTo(view.getInt16(pos, true), view.getInt16(pos + 2, true));
                pos += 4;
            } else if (cmd === 0x02) {
                this.ctx.lineTo(view.getInt16(pos, true), view.getInt16(pos + 2, true));
                pos += 4;
            } else if (cmd === 0x03) {
                this.ctx.fillRect(view.getInt16(pos, true), view.getInt16(pos + 2, true), view.getUint16(pos + 4, true), view.getUint16(pos + 6, true));
                pos += 8;
            } else if (cmd === 0x04) {
                this.ctx.beginPath();
                this.ctx.arc(view.getInt16(pos, true), view.getInt16(pos + 2, true), view.getUint16(pos + 4, true), 0, Math.PI * 2);
                this.ctx.fill();
                pos += 6;
            }
        }
    }
    
    executeXFC(code) {
        const lines = code.split('\n');
        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('//')) continue;
            if (line.startsWith('var ')) {
                const match = line.match(/var (\w+) = (.+)/);
                if (match) this.vars[match[1]] = eval(match[2]);
            } else if (line.startsWith('draw.')) {
                const match = line.match(/draw\.(\w+)\((.*)\)/);
                if (match && this.ctx[match[1]]) {
                    const args = match[2].split(',').map(a => {
                        a = a.trim();
                        return this.vars[a] !== undefined ? this.vars[a] : eval(a);
                    });
                    this.ctx[match[1]](...args);
                }
            } else if (line.includes('=')) {
                const eq = line.indexOf('=');
                const varName = line.substring(0, eq).trim();
                const val = line.substring(eq + 1).trim();
                if (this.vars[varName] !== undefined) {
                    this.vars[varName] = eval(val);
                }
            }
        }
    }
    
    render() {
        if (!this.ctx) return;
        this.ctx.fillStyle = this.options.bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        for (let inst of this.instances) {
            const spriteData = this.sprites.get(inst.spriteId);
            if (spriteData) {
                this.ctx.save();
                this.ctx.translate(inst.x, inst.y);
                this.drawCommands(spriteData);
                this.ctx.restore();
            }
        }
        this.ctx.fillStyle = 'black';
        this.ctx.font = '12px monospace';
        this.ctx.fillText(this.currentFrame + '/' + this.totalFrames, 10, 20);
    }
    
    play() {
        if (this.playing) return;
        this.playing = true;
        const frameTime = 1000 / this.options.fps;
        let lastTime = performance.now();
        const animate = (now) => {
            if (!this.playing) return;
            if (now - lastTime >= frameTime) {
                this.currentFrame++;
                if (this.currentFrame >= this.totalFrames) {
                    if (this.options.loop) this.currentFrame = 0;
                    else { this.stop(); return; }
                }
                this.render();
                lastTime = now;
            }
            this.animationId = requestAnimationFrame(animate);
        };
        this.animationId = requestAnimationFrame(animate);
    }
    
    stop() {
        this.playing = false;
        if (this.animationId) cancelAnimationFrame(this.animationId);
    }
    
    destroy() {
        this.stop();
        if (this.canvas && this.container.contains(this.canvas)) {
            this.container.removeChild(this.canvas);
        }
    }
}